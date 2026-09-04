import { describe, it, expect } from 'vitest';
import { emptyDocument, declareObject, declareMorphism, declareHypothesis, freshId, MathError } from '../context.js';
import { morphism, identity, compose, exprEquals } from '../expr.js';
import { addGoal, addStep, setGoalStatus } from '../proof.js';
import { serializeDocument, deserializeDocument } from '../serialize.js';

function richDocument() {
  let doc = emptyDocument();
  for (const o of ['A', 'B', 'C', 'D']) [doc] = declareObject(doc, { name: o }, o);
  [doc] = declareMorphism(doc, { name: 'f', source: 'A', target: 'B', properties: ['mono'] }, 'f');
  [doc] = declareMorphism(doc, { name: 'g', source: 'A', target: 'C' }, 'g');
  [doc] = declareMorphism(doc, { name: 'h', source: 'B', target: 'D', lean: { kind: 'const', name: 'Prod.fst' } }, 'h');
  [doc] = declareMorphism(doc, { name: 'k', source: 'C', target: 'D' }, 'k');
  [doc] = declareMorphism(doc, { name: 'h \\circ f', source: 'A', target: 'D', definition: compose(morphism('f'), morphism('h')) }, 'hf');
  const f = morphism('f'), g = morphism('g'), h = morphism('h'), k = morphism('k');
  [doc] = declareHypothesis(doc, { name: 'sq', prop: { kind: 'eq', left: compose(f, h), right: compose(g, k) } });
  let g1: string, g3: string, g4: string, s1: string;
  [doc, g1] = addGoal(doc, { kind: 'eq', left: compose(f, identity('B'), h), right: compose(f, h) });
  [doc] = addGoal(doc, { kind: 'eq', left: compose(f, h), right: compose(g, k) });
  [doc, g3] = addGoal(doc, { kind: 'eq', left: f, right: f });
  [doc, g4] = addGoal(doc, { kind: 'eq', left: g, right: g });
  [doc, s1] = addStep(doc, { kind: 'refl-normalize', inputs: [g1], outputs: [], generatedLean: 'by simp' });
  doc = setGoalStatus(doc, g1, { kind: 'believed', by: s1 });
  doc = setGoalStatus(doc, g3, { kind: 'verified', authority: 'lean', message: 'ok' });
  doc = setGoalStatus(doc, g4, { kind: 'failed', authority: 'lean', message: 'unsolved goals' });
  return doc;
}

describe('serialize / deserialize', () => {
  it('round-trips a document with every declaration kind and goal status', () => {
    const doc = richDocument();
    const back = deserializeDocument(serializeDocument(doc));
    expect(back).toEqual(doc);
    back.goals.forEach((g, i) => {
      expect(exprEquals(g.prop.left, doc.goals[i]!.prop.left)).toBe(true);
      expect(exprEquals(g.prop.right, doc.goals[i]!.prop.right)).toBe(true);
    });
  });

  it('preserves the id counter so new ids do not collide after reload', () => {
    const doc = richDocument();
    const back = deserializeDocument(serializeDocument(doc));
    expect(back.nextId).toBe(doc.nextId);
    const [, id] = freshId(back, 'g');
    const all = new Set([
      ...back.context.declarations.map(d => d.id),
      ...back.goals.map(g => g.id),
      ...back.steps.map(s => s.id),
    ]);
    expect(all.has(id)).toBe(false);
  });

  it('rejects wrong format, wrong version, and missing sections', () => {
    const doc = richDocument();
    const raw = JSON.parse(serializeDocument(doc));
    expect(() => deserializeDocument(JSON.stringify({ ...raw, format: 'cats-diagram' }))).toThrow(MathError);
    expect(() => deserializeDocument(JSON.stringify({ ...raw, version: 2 }))).toThrow(MathError);
    const { context: _drop, ...noContext } = raw;
    expect(() => deserializeDocument(JSON.stringify(noContext))).toThrow(MathError);
    expect(() => deserializeDocument('not json')).toThrow(MathError);
  });

  it('rejects a document with dangling references', () => {
    const doc = richDocument();
    const raw = JSON.parse(serializeDocument(doc));
    raw.context.declarations = raw.context.declarations.filter((d: { id: string }) => d.id !== 'k');
    expect(() => deserializeDocument(JSON.stringify(raw))).toThrow(/invalid document/);
  });
});

describe('serialize with definitions', () => {
  it('keeps a definition through a round-trip', () => {
    const back = deserializeDocument(serializeDocument(richDocument()));
    const hf = back.context.declarations.find(d => d.id === 'hf');
    expect(hf && hf.kind === 'morphism' ? hf.definition : undefined).toEqual(compose(morphism('f'), morphism('h')));
  });

  it('rejects a file with a circular definition', () => {
    const raw = JSON.parse(serializeDocument(richDocument()));
    raw.context.declarations = raw.context.declarations.map((d: { id: string }) =>
      d.id === 'hf' ? { ...d, definition: { kind: 'morphism', ref: 'hf' } } : d);
    expect(() => deserializeDocument(JSON.stringify(raw))).toThrow(/circular/);
  });
});
