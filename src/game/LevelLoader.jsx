import { useState, useMemo } from 'react';
import { LEVELS } from './levels/index.js';

export function useLevelState(levelId) {
  const level = LEVELS[levelId];
  if (!level) return null;

  // Given nodes/edges are locked
  const givenNodes = useMemo(
    () => level.givens.nodes.map(n => ({ ...n, locked: true })),
    [level],
  );
  const givenEdges = useMemo(
    () => level.givens.edges.map(e => ({ ...e, locked: true })),
    [level],
  );

  // Player-drawn elements (no locked flag)
  const [playerNodes, setPlayerNodes] = useState([]);
  const [playerEdges, setPlayerEdges] = useState([]);

  // Merged view: givens first, then player-drawn
  const nodes = useMemo(() => [...givenNodes, ...playerNodes], [givenNodes, playerNodes]);
  const edges = useMemo(() => [...givenEdges, ...playerEdges], [givenEdges, playerEdges]);

  // Setters that only touch player-drawn elements
  const setNodes = (updater) => {
    setPlayerNodes(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  };

  const setEdges = (updater) => {
    setPlayerEdges(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  };

  return {
    level,
    nodes,
    edges,
    setNodes,
    setEdges,
    givenNodeIds: new Set(givenNodes.map(n => n.id)),
    givenEdgeIds: new Set(givenEdges.map(e => e.id)),
  };
}
