import { describe, it, expect } from 'vitest';
import { toViews } from '../views.js';
import { moveNodes, setMorphismStyle } from '../state.js';
import { level, square } from './fixtures.js';

describe('toViews', () => {
  it('reproduces the legacy arrays for level I-4 minus the commutative flag', () => {
    const { givens } = level('I-4');
    const views = toViews(square());
    expect(views.nodes).toEqual(givens.nodes);
    expect(views.edges).toEqual(givens.edges.map(({ commutative: _c, ...e }) => e));
  });

  it('reflects layout moves and style changes', () => {
    let s = moveNodes(square(), { A: { x: 1, y: 2 } });
    s = setMorphismStyle(s, 'f', 'mono');
    s = setMorphismStyle(s, 'g', 'dashed');
    const views = toViews(s);
    expect(views.nodes[0]).toEqual({ id: 'A', label: 'A', x: 1, y: 2 });
    expect(views.edges.find(e => e.id === 'f')?.type).toBe('mono');
    expect(views.edges.find(e => e.id === 'g')?.type).toBe('dashed');
  });
});
