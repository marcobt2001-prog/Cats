import { describe, it, expect } from 'vitest';
import {
  createDiagram, addObject, addMorphism, renameObject, renameMorphism, styleOf, setMorphismStyle,
  moveNodes, setCurve, deleteElements, checkInvariants,
} from '../state.js';
import { ARROW_STYLES } from '../types.js';
import { getMorphism, objectsOf, morphismsOf, hypothesesOf } from '../../math/context.js';
import { MathError } from '../../math/expr.js';
import { markCommuting } from '../commute.js';
import { defaults, square } from './fixtures.js';

describe('creation', () => {
  it('starts empty and consistent', () => {
    expect(checkInvariants(createDiagram())).toEqual([]);
  });

  it('adds objects with generated ids and default letter names', () => {
    let s = createDiagram();
    let a: string, b: string;
    [s, a] = addObject(s, { x: 10, y: 20 });
    [s, b] = addObject(s, { x: 30, y: 40 });
    expect([a, b]).toEqual(['o1', 'o2']);
    expect(objectsOf(s.doc.context).map(o => o.name)).toEqual(['A', 'B']);
    expect(s.layout.nodes[a]).toEqual({ x: 10, y: 20 });
    expect(checkInvariants(s)).toEqual([]);
  });

  it('requires declared endpoints for morphisms', () => {
    const s = createDiagram();
    expect(() => addMorphism(s, { src: 'A', tgt: 'B' })).toThrow(MathError);
  });

  it('splits a style into property or decoration on creation', () => {
    let s = square();
    let m: string, d: string;
    [s, m] = addMorphism(s, { src: 'A', tgt: 'D', name: 'm', style: 'mono' });
    [s, d] = addMorphism(s, { src: 'A', tgt: 'D', name: 'd', style: 'dashed' });
    expect(getMorphism(s.doc.context, m)?.properties).toEqual(['mono']);
    expect(s.layout.edges[m]).toEqual({ curve: 0 });
    expect(getMorphism(s.doc.context, d)?.properties).toBeUndefined();
    expect(s.layout.edges[d]).toEqual({ curve: 0, decoration: 'dashed' });
  });
});

describe('style', () => {
  it('round-trips every arrow style with property and decoration never both set', () => {
    for (const style of ARROW_STYLES) {
      const s = setMorphismStyle(square(), 'f', style);
      expect(styleOf(s, 'f')).toBe(style);
      const hasProp = (getMorphism(s.doc.context, 'f')?.properties?.length ?? 0) > 0;
      const hasDeco = s.layout.edges['f']?.decoration !== undefined;
      expect(hasProp && hasDeco).toBe(false);
      expect(checkInvariants(s)).toEqual([]);
    }
  });

  it('switching from a property to a decoration clears the property and vice versa', () => {
    let s = setMorphismStyle(square(), 'f', 'epi');
    s = setMorphismStyle(s, 'f', 'dotted');
    expect(getMorphism(s.doc.context, 'f')?.properties).toBeUndefined();
    expect(s.layout.edges['f']?.decoration).toBe('dotted');
    s = setMorphismStyle(s, 'f', 'iso');
    expect(s.layout.edges['f']?.decoration).toBeUndefined();
    expect(getMorphism(s.doc.context, 'f')?.properties).toEqual(['iso']);
  });
});

describe('layout-only operations', () => {
  it('moveNodes and setCurve leave the document untouched by reference', () => {
    const s = square();
    const moved = moveNodes(s, { A: { x: 999 }, Z: { x: 1 } });
    expect(moved.doc).toBe(s.doc);
    expect(moved.layout.nodes['A']).toEqual({ x: 999, y: 200 });
    expect(moved.layout.nodes['Z']).toBeUndefined();
    const curved = setCurve(moved, 'f', 42);
    expect(curved.doc).toBe(s.doc);
    expect(curved.layout.edges['f']?.curve).toBe(42);
    expect(setCurve(curved, 'nope', 1)).toBe(curved);
  });
});

describe('renaming', () => {
  it('renames objects and morphisms', () => {
    let s = renameObject(square(), 'A', 'X');
    s = renameMorphism(s, 'f', 'phi');
    expect(objectsOf(s.doc.context)[0]?.name).toBe('X');
    expect(morphismsOf(s.doc.context)[0]?.name).toBe('phi');
  });
});

describe('deletion', () => {
  it('cascades from an object to its morphisms, hypotheses, and layout', () => {
    let s = markCommuting(square(), 'A', 'D');
    expect(hypothesesOf(s.doc.context)).toHaveLength(1);
    s = deleteElements(s, { nodeIds: ['B'] });
    expect(objectsOf(s.doc.context).map(o => o.id)).toEqual(['A', 'C', 'D']);
    expect(morphismsOf(s.doc.context).map(m => m.id)).toEqual(['g', 'k']);
    expect(hypothesesOf(s.doc.context)).toEqual([]);
    expect(Object.keys(s.layout.nodes)).toEqual(['A', 'C', 'D']);
    expect(Object.keys(s.layout.edges)).toEqual(['g', 'k']);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('is a no-op for an empty selection', () => {
    const s = square();
    expect(deleteElements(s, {})).toBe(s);
  });
});

describe('invariants across a sequence of operations', () => {
  it('hold on the editor defaults', () => {
    let s = defaults();
    let d: string, m: string;
    [s, d] = addObject(s, { x: 1, y: 1 });
    [s, m] = addMorphism(s, { src: 'C', tgt: d, style: 'mono' });
    s = setMorphismStyle(s, m, 'natural');
    s = moveNodes(s, { [d]: { y: 50 } });
    s = markCommuting(s, 'A', 'C');
    s = deleteElements(s, { edgeIds: ['f3'] });
    expect(checkInvariants(s)).toEqual([]);
    expect(hypothesesOf(s.doc.context)).toEqual([]); // f3 was one side of the equation
  });
});
