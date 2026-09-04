// Public surface of the diagram-state layer: MathDocument + Layout, pure and React-free.

export type {
  ArrowStyle, Decoration, NodeLayout, EdgeLayout, Layout, DiagramState,
  NodeView, EdgeView, DiagramViews,
} from './types.js';
export { ARROW_STYLES, DECORATIONS, isArrowStyle, isDecoration } from './types.js';

export {
  createDiagram, defaultObjectName, addObject, addMorphism, renameObject, renameMorphism,
  styleOf, setMorphismStyle, moveNodes, setCurve, deleteElements, pruneLayout, checkInvariants,
} from './state.js';

export {
  parallelPairs, hypothesesAt, isCommuting, markCommuting, unmarkCommuting, toggleCommuting, commutingEdgeIds,
} from './commute.js';
export type { ParallelPair } from './commute.js';

export { toViews } from './views.js';

export { fromLegacyDiagram } from './legacy.js';
export type { LegacyNode, LegacyEdge, LegacyImportResult } from './legacy.js';

export { extractSubdiagram, mergeDiagram } from './merge.js';

export { CAT_VERSION, serializeCat, deserializeCat } from './serialize.js';
export type { CatMeta, CatLoadResult } from './serialize.js';
