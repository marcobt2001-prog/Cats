import { describe, it, expect } from 'vitest';
import { createHistory, commit, undo, redo, canUndo, canRedo } from '../history.js';

describe('history', () => {
  it('commits, undoes, and redoes', () => {
    let h = createHistory(0);
    expect(canUndo(h)).toBe(false);
    h = commit(h, 1);
    h = commit(h, 2);
    expect(h.present).toBe(2);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(false);
    expect(undo(undo(undo(h))).present).toBe(0);
    expect(undo(createHistory(0))).toEqual(createHistory(0));
  });

  it('is a no-op when the state is unchanged', () => {
    const h = commit(createHistory(0), 1);
    expect(commit(h, 1)).toBe(h);
  });

  it('coalesces commits that share a key into one entry', () => {
    let h = createHistory(0);
    h = commit(h, 1, 'drag');
    h = commit(h, 2, 'drag');
    h = commit(h, 3, 'drag');
    expect(h.past).toEqual([0]);
    expect(h.present).toBe(3);
    h = commit(h, 4, 'other');
    expect(h.past).toEqual([0, 3]);
    h = commit(h, 5);
    expect(h.past).toEqual([0, 3, 4]);
    h = commit(h, 6, 'other'); // a key never coalesces with a keyless commit
    expect(h.past).toEqual([0, 3, 4, 5]);
  });

  it('undo clears the coalescing key', () => {
    let h = commit(createHistory(0), 1, 'drag');
    h = undo(h);
    h = redo(h);
    h = commit(h, 2, 'drag');
    expect(h.past).toEqual([0, 1]);
  });

  it('clears redo on commit and respects the cap', () => {
    let h = createHistory(0);
    h = commit(h, 1);
    h = undo(h);
    h = commit(h, 9);
    expect(h.future).toEqual([]);
    let capped = createHistory(0);
    for (let i = 1; i <= 60; i += 1) capped = commit(capped, i, undefined, 5);
    expect(capped.past).toEqual([55, 56, 57, 58, 59]);
  });
});
