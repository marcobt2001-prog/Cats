import { describe, it, expect } from 'vitest';
import {
  emptyDocument, freshId, declareObject, declareMorphism, declareHypothesis,
  removeDeclarations, renameDeclaration, setMorphismProperties,
  objectsOf, morphismsOf, hypothesesOf, getMorphism, validateContext, validateDocument, MathError,
} from '../context.js';
import { morphism, identity, compose, mentions } from '../expr.js';
import { addGoal } from '../proof.js';

function square() {
  let doc = emptyDocument();
  [doc] = declareObject(doc, { name: 'A' }, 'A');
  [doc] = declareObject(doc, { name: 'B' }, 'B');
  [doc] = declareObject(doc, { name: 'C' }, 'C');
  [doc] = declareObject(doc, { name: 'D' }, 'D');
  [doc] = declareMorphism(doc, { name: 'f', source: 'A', target: 'B' }, 'f');
  [doc] = declareMorphism(doc, { name: 'g', source: 'A', target: 'C' }, 'g');
  [doc] = declareMorphism(doc, { name: 'h', source: 'B', target: 'D' }, 'h');
  [doc] = declareMorphism(doc, { name: 'k', source: 'C', target: 'D' }, 'k');
  return doc;
}

describe('freshId', () => {
  it('increments the document counter', () => {
    const [d1, a] = freshId(emptyDocument(), 'o');
    const [d2, b] = freshId(d1, 'o');
    expect(a).toBe('o1');
    expect(b).toBe('o2');
    expect(d2.nextId).toBe(3);
  });

  it('skips ids already supplied by the caller', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'X' }, 'o1');
    const [, id] = freshId(doc, 'o');
    expect(id).toBe('o2');
  });

  it('does not mutate the input document', () => {
    const doc = emptyDocument();
    freshId(doc, 'g');
    expect(doc.nextId).toBe(1);
  });
});

describe('declarations', () => {
  it('generates ids when none are given', () => {
    let doc = emptyDocument();
    let a: string, f: string;
    [doc, a] = declareObject(doc, { name: 'A' });
    [doc, f] = declareMorphism(doc, { name: 'f', source: a, target: a });
    expect(a).toBe('o1');
    expect(f).toBe('m2');
  });

  it('rejects duplicate ids', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A' }, 'A');
    expect(() => declareObject(doc, { name: 'A again' }, 'A')).toThrow(MathError);
  });

  it('rejects a morphism whose endpoints are not declared', () => {
    const doc = emptyDocument();
    expect(() => declareMorphism(doc, { name: 'f', source: 'A', target: 'B' })).toThrow(MathError);
  });

  it('rejects a hypothesis whose sides are not parallel', () => {
    const doc = square();
    expect(() => declareHypothesis(doc, { prop: { kind: 'eq', left: morphism('f'), right: morphism('g') } }))
      .toThrow(/not parallel/);
  });

  it('accepts a well-typed hypothesis and keeps declaration order', () => {
    let doc = square();
    [doc] = declareHypothesis(doc, {
      name: 'sq',
      prop: { kind: 'eq', left: compose(morphism('f'), morphism('h')), right: compose(morphism('g'), morphism('k')) },
    });
    expect(objectsOf(doc.context).map(o => o.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(morphismsOf(doc.context).map(m => m.id)).toEqual(['f', 'g', 'h', 'k']);
    expect(hypothesesOf(doc.context).map(h => h.name)).toEqual(['sq']);
    expect(validateContext(doc.context)).toEqual([]);
  });

  it('stores properties and lean references when given', () => {
    let doc = square();
    let id: string;
    [doc, id] = declareMorphism(doc, {
      name: 'i', source: 'A', target: 'B', properties: ['mono'], lean: { kind: 'const', name: 'Prod.fst' },
    });
    const m = morphismsOf(doc.context).find(m => m.id === id)!;
    expect(m.properties).toEqual(['mono']);
    expect(m.lean).toEqual({ kind: 'const', name: 'Prod.fst' });
  });
});

describe('editing declarations', () => {
  function squareWithHyp() {
    let doc = square();
    [doc] = declareHypothesis(doc, {
      name: 'sq',
      prop: { kind: 'eq', left: compose(morphism('f'), morphism('h')), right: compose(morphism('g'), morphism('k')) },
    }, 'sq');
    return doc;
  }

  it('removing an object cascades to its morphisms and hypotheses', () => {
    const doc = squareWithHyp();
    const next = removeDeclarations(doc, ['B']);
    expect(objectsOf(next.context).map(o => o.id)).toEqual(['A', 'C', 'D']);
    expect(morphismsOf(next.context).map(m => m.id)).toEqual(['g', 'k']);
    expect(hypothesesOf(next.context)).toEqual([]);
    expect(validateContext(next.context)).toEqual([]);
    expect(doc.context.declarations).toHaveLength(9); // input untouched
  });

  it('removing a morphism removes only hypotheses mentioning it', () => {
    let doc = squareWithHyp();
    [doc] = declareHypothesis(doc, { prop: { kind: 'eq', left: morphism('f'), right: morphism('f') } }, 'ff');
    const next = removeDeclarations(doc, ['k']);
    expect(morphismsOf(next.context).map(m => m.id)).toEqual(['f', 'g', 'h']);
    expect(hypothesesOf(next.context).map(h => h.id)).toEqual(['ff']);
  });

  it('removing a morphism drops goals mentioning it', () => {
    let doc = squareWithHyp();
    [doc] = addGoal(doc, { kind: 'eq', left: compose(morphism('f'), morphism('h')), right: compose(morphism('g'), morphism('k')) });
    [doc] = addGoal(doc, { kind: 'eq', left: morphism('f'), right: morphism('f') });
    const next = removeDeclarations(doc, ['h']);
    expect(next.goals).toHaveLength(1);
    expect(validateDocument(next)).toEqual([]);
  });

  it('renames in place and preserves order', () => {
    const next = renameDeclaration(square(), 'f', 'phi');
    expect(morphismsOf(next.context).map(m => m.name)).toEqual(['phi', 'g', 'h', 'k']);
    expect(() => renameDeclaration(square(), 'zzz', 'x')).toThrow(MathError);
  });

  it('sets and clears morphism properties', () => {
    let doc = setMorphismProperties(square(), 'f', ['mono']);
    expect(getMorphism(doc.context, 'f')?.properties).toEqual(['mono']);
    doc = setMorphismProperties(doc, 'f', []);
    expect(getMorphism(doc.context, 'f')?.properties).toBeUndefined();
    expect(() => setMorphismProperties(doc, 'A', ['epi'])).toThrow(MathError);
  });

  it('mentions walks nested expressions', () => {
    const e = compose(morphism('f'), compose(identity('B'), morphism('h')));
    expect(mentions(e, new Set(['h']))).toBe(true);
    expect(mentions(e, new Set(['B']))).toBe(true);
    expect(mentions(e, new Set(['k']))).toBe(false);
  });
});

describe('validateContext / validateDocument', () => {
  it('reports forward references and duplicates on hand-built contexts', () => {
    const errors = validateContext({
      declarations: [
        { kind: 'morphism', id: 'f', name: 'f', source: 'A', target: 'B' },
        { kind: 'object', id: 'A', name: 'A' },
        { kind: 'object', id: 'A', name: 'A2' },
      ],
    });
    expect(errors.some(e => e.includes("unknown source object 'A'"))).toBe(true);
    expect(errors.some(e => e.includes("duplicate id 'A'"))).toBe(true);
  });

  it('reports dangling step references and ill-typed goals', () => {
    const doc = square();
    const bad = {
      ...doc,
      goals: [{ id: 'g1', prop: { kind: 'eq' as const, left: morphism('f'), right: morphism('nope') }, status: { kind: 'open' as const } }],
      steps: [{ id: 's1', kind: 'x', inputs: ['g1'], outputs: ['ghost'] }],
    };
    const errors = validateDocument(bad);
    expect(errors.some(e => e.startsWith("goal 'g1'"))).toBe(true);
    expect(errors.some(e => e.includes("unknown reference 'ghost'"))).toBe(true);
  });
});

describe('validateContext with definitions', () => {
  it('reports a definition whose endpoints do not match the morphism', () => {
    let doc = square();
    [doc] = declareMorphism(doc, { name: 'x', source: 'A', target: 'D', definition: morphism('f') }, 'x');
    expect(validateContext(doc.context)).toEqual([
      "morphism 'x': definition: definition runs A → B but the morphism runs A → D",
    ]);
  });

  it('accepts a definition that references a later declaration', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A' }, 'A');
    [doc] = declareObject(doc, { name: 'B' }, 'B');
    [doc] = declareMorphism(doc, { name: 'x', source: 'A', target: 'B', definition: compose(morphism('f'), identity('B')) }, 'x');
    [doc] = declareMorphism(doc, { name: 'f', source: 'A', target: 'B' }, 'f');
    expect(validateContext(doc.context)).toEqual([]);
  });
});
