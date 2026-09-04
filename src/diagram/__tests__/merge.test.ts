import { describe, it, expect } from 'vitest';
import { extractSubdiagram, mergeDiagram } from '../merge.js';
import { markCommuting, isCommuting, commutingEdgeIds } from '../commute.js';
import { checkInvariants } from '../state.js';
import { toViews } from '../views.js';
import { objectsOf, morphismsOf, hypothesesOf } from '../../math/context.js';
import { square } from './fixtures.js';

describe('extractSubdiagram', () => {
  it('keeps hypotheses only when all their morphisms are inside the selection', () => {
    const s = markCommuting(square(), 'A', 'D');
    const whole = extractSubdiagram(s, ['A', 'B', 'C', 'D'], []);
    expect(hypothesesOf(whole.doc.context)).toHaveLength(1);
    expect(checkInvariants(whole)).toEqual([]);

    const part = extractSubdiagram(s, ['A', 'B', 'D'], []);
    expect(morphismsOf(part.doc.context).map(m => m.id)).toEqual(['f', 'h']);
    expect(hypothesesOf(part.doc.context)).toEqual([]);
    expect(Object.keys(part.layout.nodes)).toEqual(['A', 'B', 'D']);
    expect(checkInvariants(part)).toEqual([]);
  });

  it('drops a selected edge whose endpoint is not selected', () => {
    const part = extractSubdiagram(square(), ['A'], ['f']);
    expect(morphismsOf(part.doc.context)).toEqual([]);
  });
});

describe('mergeDiagram', () => {
  it('pastes the same fragment twice with fresh ids, offsets, and copied equations', () => {
    const base = markCommuting(square(), 'A', 'D');
    const fragment = extractSubdiagram(base, ['A', 'B', 'C', 'D'], []);

    const [once, ids1] = mergeDiagram(base, fragment, { dx: 40, dy: 40 });
    const [twice, ids2] = mergeDiagram(once, fragment, { dx: 80, dy: 80 });

    expect(checkInvariants(twice)).toEqual([]);
    expect(objectsOf(twice.doc.context)).toHaveLength(12);
    expect(morphismsOf(twice.doc.context)).toHaveLength(12);
    expect(hypothesesOf(twice.doc.context)).toHaveLength(3);

    // Base ids untouched, new ids fresh and distinct.
    expect(objectsOf(twice.doc.context).slice(0, 4).map(o => o.id)).toEqual(['A', 'B', 'C', 'D']);
    const all = [...ids1.nodeIds, ...ids1.edgeIds, ...ids2.nodeIds, ...ids2.edgeIds];
    expect(new Set(all).size).toBe(all.length);
    expect(all.some(id => ['A', 'B', 'C', 'D', 'f', 'g', 'h', 'k'].includes(id))).toBe(false);

    // Offsets applied and the returned ids appear in the views.
    const views = toViews(twice);
    const a2 = views.nodes.find(n => n.id === ids2.nodeIds[0])!;
    expect([a2.x, a2.y]).toEqual([200 + 80, 200 + 80]);
    expect(ids2.edgeIds.every(id => views.edges.some(e => e.id === id))).toBe(true);

    // The pasted copy commutes on its own.
    expect(isCommuting(twice, ids2.nodeIds[0]!, ids2.nodeIds[3]!)).toBe(true);
    expect(commutingEdgeIds(twice).size).toBe(12);
  });

  it('carries style information across the merge', () => {
    let base = square();
    const fragment = extractSubdiagram(base, ['A', 'B'], []);
    fragment.layout.edges['f'] = { curve: 33, decoration: 'dashed' };
    const [merged, ids] = mergeDiagram(base, fragment);
    expect(merged.layout.edges[ids.edgeIds[0]!]).toEqual({ curve: 33, decoration: 'dashed' });
    base = merged;
    expect(checkInvariants(base)).toEqual([]);
  });
});
