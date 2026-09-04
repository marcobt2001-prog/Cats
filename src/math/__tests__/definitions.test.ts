import { describe, it, expect } from 'vitest';
import { emptyDocument, declareObject, declareMorphism, declareHypothesis, removeDeclarations, validateContext, getMorphism, hypothesesOf, MathError } from '../context.js';
import { morphism, identity, compose, exprEquals, exprEquivalent } from '../expr.js';
import { unfold, definitionError, exprKey, exprEquivalentIn, propEquivalentIn, dependentsOf } from '../unfold.js';
import { setMorphismDefinition } from '../definitions.js';

/** I-4 square plus `gf : A → D` (undefined until a test defines it). */
function square() {
  let doc = emptyDocument();
  for (const o of ['A', 'B', 'C', 'D']) [doc] = declareObject(doc, { name: o }, o);
  [doc] = declareMorphism(doc, { name: 'gf', source: 'A', target: 'D' }, 'gf');
  [doc] = declareMorphism(doc, { name: 'f', source: 'A', target: 'B' }, 'f');
  [doc] = declareMorphism(doc, { name: 'g', source: 'A', target: 'C' }, 'g');
  [doc] = declareMorphism(doc, { name: 'h', source: 'B', target: 'D' }, 'h');
  [doc] = declareMorphism(doc, { name: 'k', source: 'C', target: 'D' }, 'k');
  return doc;
}
const f = morphism('f'), g = morphism('g'), h = morphism('h'), k = morphism('k'), gf = morphism('gf');

describe('setMorphismDefinition', () => {
  it('stores a well-typed parallel definition (forward references allowed)', () => {
    const doc = setMorphismDefinition(square(), 'gf', compose(f, h));
    expect(getMorphism(doc.context, 'gf')?.definition).toEqual(compose(f, h));
    expect(validateContext(doc.context)).toEqual([]);
  });

  it('strips with undefined', () => {
    const doc = setMorphismDefinition(setMorphismDefinition(square(), 'gf', compose(f, h)), 'gf', undefined);
    expect(getMorphism(doc.context, 'gf')).not.toHaveProperty('definition');
  });

  it('rejects endpoint mismatch, ill-typed, self-reference, and unknown morphism', () => {
    expect(() => setMorphismDefinition(square(), 'gf', f)).toThrow(/runs A → B/);
    expect(() => setMorphismDefinition(square(), 'gf', compose(h, f))).toThrow(MathError);
    expect(() => setMorphismDefinition(square(), 'gf', gf)).toThrow(/circular/);
    expect(() => setMorphismDefinition(square(), 'nope', f)).toThrow(/unknown morphism/);
  });

  it('does not mutate the input', () => {
    const doc = square();
    setMorphismDefinition(doc, 'gf', compose(f, h));
    expect(getMorphism(doc.context, 'gf')).not.toHaveProperty('definition');
  });
});

describe('unfold and equivalence in context', () => {
  it('expands definitions recursively', () => {
    let doc = square();
    [doc] = declareMorphism(doc, { name: 'x', source: 'A', target: 'D' }, 'x');
    doc = setMorphismDefinition(doc, 'gf', compose(f, h));
    doc = setMorphismDefinition(doc, 'x', gf);
    expect(exprEquals(unfold(doc.context, morphism('x')), compose(f, h))).toBe(true);
    expect(exprEquals(unfold(doc.context, compose(identity('A'), gf)), compose(identity('A'), compose(f, h)))).toBe(true);
  });

  it('identifies a defined morphism with its unfolding', () => {
    const doc = setMorphismDefinition(square(), 'gf', compose(f, h));
    expect(exprEquivalent(gf, compose(f, h))).toBe(false);
    expect(exprEquivalentIn(doc.context, gf, compose(f, h))).toBe(true);
    expect(exprEquivalentIn(doc.context, gf, compose(f, identity('B'), h))).toBe(true);
    expect(exprEquivalentIn(doc.context, gf, compose(g, k))).toBe(false);
    expect(exprKey(doc.context, gf)).toBe(exprKey(doc.context, compose(f, h)));
    expect(propEquivalentIn(doc.context, { kind: 'eq', left: gf, right: gf }, { kind: 'eq', left: compose(f, h), right: gf })).toBe(true);
  });

  it('a two-step cycle is rejected by validateContext and unfold throws on it', () => {
    let doc = square();
    [doc] = declareMorphism(doc, { name: 'x', source: 'A', target: 'D' }, 'x');
    doc = setMorphismDefinition(doc, 'gf', morphism('x'));
    // Bypass the setter to build a cycle the way a hand-edited file could.
    const cyclic = {
      ...doc,
      context: { declarations: doc.context.declarations.map(d => (d.id === 'x' && d.kind === 'morphism' ? { ...d, definition: gf } : d)) },
    };
    expect(validateContext(cyclic.context).join(';')).toMatch(/circular/);
    expect(() => unfold(cyclic.context, gf)).toThrow(/circular/);
    expect(definitionError(doc.context, 'x', gf)).toMatch(/circular/);
  });

  it('lists dependents by morphism and by object', () => {
    let doc = square();
    [doc] = declareMorphism(doc, { name: 'i', source: 'A', target: 'A', definition: identity('A') }, 'i');
    doc = setMorphismDefinition(doc, 'gf', compose(f, h));
    expect(dependentsOf(doc.context, 'f').map(m => m.id)).toEqual(['gf']);
    expect(dependentsOf(doc.context, 'A').map(m => m.id)).toEqual(['i']);
    expect(dependentsOf(doc.context, 'k')).toEqual([]);
  });
});

describe('removeDeclarations with definitions', () => {
  it('cascades through chained definitions and their hypotheses', () => {
    let doc = square();
    [doc] = declareMorphism(doc, { name: 'x', source: 'A', target: 'D' }, 'x');
    doc = setMorphismDefinition(doc, 'gf', compose(f, h));
    doc = setMorphismDefinition(doc, 'x', gf);
    [doc] = declareHypothesis(doc, { prop: { kind: 'eq', left: morphism('x'), right: compose(g, k) } });
    const after = removeDeclarations(doc, ['f']);
    const ids = after.context.declarations.map(d => d.id);
    expect(ids).toEqual(['A', 'B', 'C', 'D', 'g', 'h', 'k']);
    expect(hypothesesOf(after.context)).toEqual([]);
    expect(validateContext(after.context)).toEqual([]);
  });

  it('removes a morphism defined as an identity when its object goes', () => {
    let doc = square();
    [doc] = declareMorphism(doc, { name: 'i', source: 'B', target: 'B', definition: identity('B') }, 'i');
    const after = removeDeclarations(doc, ['B']);
    expect(after.context.declarations.some(d => d.id === 'i')).toBe(false);
    expect(validateContext(after.context)).toEqual([]);
  });
});
