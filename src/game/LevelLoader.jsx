import { useCallback, useMemo } from 'react';
import { LEVELS } from './levels/index.js';
import { fromLegacyDiagram, createDiagram } from '../diagram/index.ts';
import { useDiagramHistory } from '../useDiagramHistory.js';

/**
 * Diagram state for one level. The givens become the initial DiagramState;
 * their ids are reported as locked so the canvas treats them as read-only.
 * Hooks run unconditionally; `level` is null for an unknown id.
 */
export function useLevelDiagram(levelId) {
  const level = LEVELS[levelId] ?? null;

  const initial = useMemo(
    () => (level ? fromLegacyDiagram(level.givens.nodes, level.givens.edges).state : createDiagram()),
    [level],
  );
  const lockedNodeIds = useMemo(() => new Set(level ? level.givens.nodes.map(n => n.id) : []), [level]);
  const lockedEdgeIds = useMemo(() => new Set(level ? level.givens.edges.map(e => e.id) : []), [level]);

  const history = useDiagramHistory(initial);
  const { reset: resetHistory } = history;
  const reset = useCallback(() => resetHistory(initial), [resetHistory, initial]);

  return { level, history, lockedNodeIds, lockedEdgeIds, reset };
}
