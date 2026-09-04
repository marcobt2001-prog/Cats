/**
 * Pure snapshot history. Snapshots are immutable states, so storing references
 * is safe. A `key` lets a gesture (drag, slider session) coalesce into one entry:
 * committing with the same key as the last commit replaces the present instead
 * of pushing. Undo and redo clear the key so the next commit always pushes.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey?: string;
}

export const HISTORY_CAP = 50;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function commit<T>(h: History<T>, next: T, key?: string, cap: number = HISTORY_CAP): History<T> {
  if (next === h.present) return h;
  if (key !== undefined && key === h.lastKey) return { ...h, present: next };
  const past = [...h.past, h.present].slice(-cap);
  return key !== undefined ? { past, present: next, future: [], lastKey: key } : { past, present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0];
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1) };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}
