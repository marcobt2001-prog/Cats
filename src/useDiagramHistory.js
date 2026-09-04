import { useCallback, useMemo, useRef, useState } from 'react';
import { createHistory, commit, undo as undoHistory, redo as redoHistory, canUndo, canRedo } from './diagram/history.ts';
import { toViews } from './diagram/index.ts';

/**
 * Undo/redo over an immutable DiagramState.
 *
 * The ref is the source of truth so `apply` can be called several times in one
 * event handler and `getState()` always sees the latest state; `useState` only
 * triggers re-renders. Pass `coalesceKey` for gestures (drag, slider) so a whole
 * gesture is one undo entry.
 */
export function useDiagramHistory(initialState) {
  const ref = useRef(null);
  if (ref.current === null) ref.current = createHistory(initialState);
  const [, bump] = useState(0);
  const rerender = useCallback(() => bump(n => n + 1), []);

  const getState = useCallback(() => ref.current.present, []);

  const apply = useCallback((nextOrFn, opts) => {
    const cur = ref.current.present;
    const next = typeof nextOrFn === 'function' ? nextOrFn(cur) : nextOrFn;
    const h = commit(ref.current, next, opts?.coalesceKey);
    if (h !== ref.current) { ref.current = h; rerender(); }
  }, [rerender]);

  const reset = useCallback((state) => {
    ref.current = createHistory(state);
    rerender();
  }, [rerender]);

  const undo = useCallback(() => {
    const h = undoHistory(ref.current);
    if (h === ref.current) return false;
    ref.current = h; rerender(); return true;
  }, [rerender]);

  const redo = useCallback(() => {
    const h = redoHistory(ref.current);
    if (h === ref.current) return false;
    ref.current = h; rerender(); return true;
  }, [rerender]);

  const state = ref.current.present;
  const views = useMemo(() => toViews(state), [state]);

  return {
    state, views, getState, apply, reset, undo, redo,
    canUndo: canUndo(ref.current),
    canRedo: canRedo(ref.current),
  };
}
