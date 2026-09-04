import { fromLegacyDiagram } from '../legacy.js';
import type { DiagramState } from '../types.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from '../../math/__tests__/fixtures.js';
import { WORLD1_LEVELS } from '../../game/levels/world1-sets.js';
import type { LegacyEdge, LegacyNode } from '../legacy.js';

type Level = { id: string; givens: { nodes: LegacyNode[]; edges: LegacyEdge[] } };

export function level(id: string): Level {
  const l = (WORLD1_LEVELS as Level[]).find(l => l.id === id);
  if (!l) throw new Error(`no level ${id}`);
  return l;
}

/** Editor defaults: A→B (f1), B→C (f2), A→C (f3). */
export function defaults(): DiagramState {
  return fromLegacyDiagram(DEFAULT_NODES, DEFAULT_EDGES).state;
}

/** Level I-4 square: f: A→B, g: A→C, h: B→D, k: C→D. */
export function square(): DiagramState {
  const { givens } = level('I-4');
  return fromLegacyDiagram(givens.nodes, givens.edges).state;
}
