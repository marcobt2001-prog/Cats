import { describe, it, expect } from 'vitest';
import { fromDiagram } from '../fromDiagram.js';
import type { VisualEdge, VisualNode } from '../fromDiagram.js';
import { morphism, compose, propEquivalent } from '../expr.js';
import { objectsOf, morphismsOf, hypothesesOf, validateContext } from '../context.js';
import { printProposition } from '../print.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from './fixtures.js';
import { WORLD1_LEVELS } from '../../game/levels/world1-sets.js';

type Level = { id: string; givens: { nodes: VisualNode[]; edges: VisualEdge[] } };
const levelI4 = (WORLD1_LEVELS as Level[]).find(l => l.id === 'I-4')!;

describe('fromDiagram on the editor defaults', () => {
  it('produces objects and morphisms with the canvas ids and labels', () => {
    const { context, warnings } = fromDiagram(DEFAULT_NODES, DEFAULT_EDGES);
    expect(warnings).toEqual([]);
    expect(validateContext(context)).toEqual([]);
    expect(objectsOf(context).map(o => [o.id, o.name])).toEqual([['A', 'A'], ['B', 'B'], ['C', 'C']]);
    expect(morphismsOf(context).map(m => [m.id, m.name, m.source, m.target])).toEqual([
      ['f1', 'f', 'A', 'B'],
      ['f2', 'g', 'B', 'C'],
      ['f3', 'g \\circ f', 'A', 'C'],
    ]);
    expect(hypothesesOf(context)).toEqual([]);
  });

  it('turns a commGroup into one equality between the two parallel paths', () => {
    const { context, warnings } = fromDiagram(DEFAULT_NODES, DEFAULT_EDGES, { 'A|C': ['f1', 'f2', 'f3'] });
    expect(warnings).toEqual([]);
    const hyps = hypothesesOf(context);
    expect(hyps).toHaveLength(1);
    const expected = { kind: 'eq' as const, left: compose(morphism('f1'), morphism('f2')), right: morphism('f3') };
    const reversed = { kind: 'eq' as const, left: morphism('f3'), right: compose(morphism('f1'), morphism('f2')) };
    expect(propEquivalent(hyps[0]!.prop, expected) || propEquivalent(hyps[0]!.prop, reversed)).toBe(true);
  });
});

describe('fromDiagram on level I-4 (commutative square)', () => {
  const { nodes, edges } = levelI4.givens;

  it('reads the four given morphisms', () => {
    const { context } = fromDiagram(nodes, edges);
    expect(morphismsOf(context).map(m => `${m.name}:${m.source}→${m.target}`)).toEqual([
      'f:A→B', 'g:A→C', 'h:B→D', 'k:C→D',
    ]);
  });

  it('interprets the marked square as h ∘ f = k ∘ g', () => {
    const { context, warnings } = fromDiagram(nodes, edges, { 'A|D': ['f', 'g', 'h', 'k'] });
    expect(warnings).toEqual([]);
    const hyps = hypothesesOf(context);
    expect(hyps).toHaveLength(1);
    const classical = printProposition(context, hyps[0]!.prop, 'classical');
    const diagrammatic = printProposition(context, hyps[0]!.prop, 'diagrammatic');
    expect(['h ∘ f = k ∘ g', 'k ∘ g = h ∘ f']).toContain(classical);
    expect(['f ≫ h = g ≫ k', 'g ≫ k = f ≫ h']).toContain(diagrammatic);
  });

  it('is invariant under moving every node', () => {
    const groups = { 'A|D': ['f', 'g', 'h', 'k'] };
    const moved = nodes.map(n => ({ ...n, x: (n.x ?? 0) + 137, y: (n.y ?? 0) - 137 }));
    const curved = edges.map(e => ({ ...e, curve: 42 }));
    expect(fromDiagram(moved, curved, groups).context).toEqual(fromDiagram(nodes, edges, groups).context);
  });
});

describe('fromDiagram edge cases', () => {
  const A = { id: 'A', label: 'A' }, B = { id: 'B', label: 'B' };

  it('keeps mono/epi/iso as properties and drops decorative types', () => {
    const { context } = fromDiagram([A, B], [
      { id: 'm', label: 'm', src: 'A', tgt: 'B', type: 'mono' },
      { id: 'd', label: 'd', src: 'A', tgt: 'B', type: 'dashed' },
      { id: 'p', label: 'p', src: 'A', tgt: 'B' },
    ]);
    const [m, d, p] = morphismsOf(context);
    expect(m!.properties).toEqual(['mono']);
    expect(d!.properties).toBeUndefined();
    expect(p!.properties).toBeUndefined();
  });

  it('skips an edge whose endpoint is missing and warns', () => {
    const { context, warnings } = fromDiagram([A], [{ id: 'f', label: 'f', src: 'A', tgt: 'Z' }]);
    expect(morphismsOf(context)).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("'f'");
  });

  it('does not invent an equation from a stale group', () => {
    // Two paths A→B exist, but the group only lists one of them.
    const { context, warnings } = fromDiagram([A, B], [
      { id: 'f', label: 'f', src: 'A', tgt: 'B' },
      { id: 'g', label: 'g', src: 'A', tgt: 'B' },
    ], { 'A|B': ['f'] });
    expect(hypothesesOf(context)).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it('chains three parallel paths into two equations', () => {
    const { context, warnings } = fromDiagram([A, B], [
      { id: 'f', label: 'f', src: 'A', tgt: 'B' },
      { id: 'g', label: 'g', src: 'A', tgt: 'B' },
      { id: 'h', label: 'h', src: 'A', tgt: 'B' },
    ], { 'A|B': ['f', 'g', 'h'] });
    expect(warnings).toEqual([]);
    const hyps = hypothesesOf(context);
    expect(hyps).toHaveLength(2);
    expect(hyps.map(h => h.id)).toEqual(['comm:A|B:1', 'comm:A|B:2']);
    // Chained against the first path: both equations share a left side.
    expect(hyps[1]!.prop.left).toEqual(hyps[0]!.prop.left);
    expect(hyps[0]!.prop.right).not.toEqual(hyps[1]!.prop.right);
    expect(validateContext(context)).toEqual([]);
  });
});
