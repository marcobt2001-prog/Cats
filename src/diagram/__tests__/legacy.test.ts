import { describe, it, expect } from 'vitest';
import { fromLegacyDiagram } from '../legacy.js';
import { checkInvariants } from '../state.js';
import { isCommuting } from '../commute.js';
import { hypothesesOf } from '../../math/context.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from '../../math/__tests__/fixtures.js';
import { level } from './fixtures.js';

describe('fromLegacyDiagram', () => {
  it('imports the editor defaults and level givens without warnings', () => {
    const d = fromLegacyDiagram(DEFAULT_NODES, DEFAULT_EDGES);
    expect(d.warnings).toEqual([]);
    expect(checkInvariants(d.state)).toEqual([]);
    expect(d.state.layout.edges['f3']?.curve).toBe(-60);
    for (const id of ['I-1', 'I-2', 'I-3', 'I-4']) {
      const { givens } = level(id);
      const r = fromLegacyDiagram(givens.nodes, givens.edges);
      expect(r.warnings).toEqual([]);
      expect(checkInvariants(r.state)).toEqual([]);
    }
  });

  it('defaults missing positions, curves, and types with warnings where data was lost', () => {
    const r = fromLegacyDiagram(
      [{ id: 'A', label: 'A' }, { id: 'B', label: 'B', x: 1, y: 2 }],
      [{ id: 'f', label: 'f', src: 'A', tgt: 'B' }, { id: 'g', label: 'g', src: 'A', tgt: 'B', type: 'weird' }],
    );
    expect(r.state.layout.nodes['A']).toEqual({ x: 0, y: 0 });
    expect(r.state.layout.edges['f']).toEqual({ curve: 0 });
    expect(r.warnings.some(w => w.startsWith("node 'A'"))).toBe(true);
    expect(r.warnings.some(w => w.includes("unknown type 'weird'"))).toBe(true);
    expect(checkInvariants(r.state)).toEqual([]);
  });

  it('honours commutative flags that cover a full pair of paths', () => {
    const { givens } = level('I-4');
    const flagged = givens.edges.map(e => ({ ...e, commutative: true }));
    const r = fromLegacyDiagram(givens.nodes, flagged);
    expect(r.warnings).toEqual([]);
    expect(hypothesesOf(r.state.doc.context)).toHaveLength(1);
    expect(isCommuting(r.state, 'A', 'D')).toBe(true);
  });

  it('warns about a lone flagged edge and emits no equation', () => {
    const { givens } = level('I-4');
    const flagged = givens.edges.map(e => (e.id === 'f' ? { ...e, commutative: true } : e));
    const r = fromLegacyDiagram(givens.nodes, flagged);
    expect(hypothesesOf(r.state.doc.context)).toEqual([]);
    expect(r.warnings).toEqual(["edge 'f': commutative flag dropped (no fully flagged pair of paths)"]);
  });

  it('drops a dangling edge from both document and layout, and warns on stale groups', () => {
    const r = fromLegacyDiagram(
      [{ id: 'A', label: 'A', x: 0, y: 0 }, { id: 'B', label: 'B', x: 1, y: 1 }],
      [{ id: 'f', label: 'f', src: 'A', tgt: 'B' }, { id: 'z', label: 'z', src: 'A', tgt: 'Q' }],
      { 'A|B': ['f'] },
    );
    expect(Object.keys(r.state.layout.edges)).toEqual(['f']);
    expect(r.warnings.some(w => w.startsWith("edge 'z'"))).toBe(true);
    expect(r.warnings.some(w => w.startsWith("commGroup 'A|B'"))).toBe(true);
    expect(checkInvariants(r.state)).toEqual([]);
  });
});
