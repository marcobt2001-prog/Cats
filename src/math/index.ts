// Public surface of the CATS mathematical core.
//
// Everything here is pure and React-free. The visual layer talks to it through
// ids (see fromDiagram) and documents (see serialize).

export type {
  ObjectId, MorphismId, HypothesisId, GoalId, StepId,
  LeanReference, MorphismExpr, Proposition, MorphismProperty,
  ObjectDecl, MorphismDecl, HypothesisDecl, Declaration, MathContext,
  GoalStatus, ProofGoal, ProofStep, MathDocument,
} from './types.js';
export { assertNever } from './types.js';

export {
  MathError,
  morphism, identity, compose, after,
  typeOf, source, target,
  normalize, exprEquals, exprEquivalent, propEquivalent, mentions,
} from './expr.js';
export type { TypeResult } from './expr.js';

export {
  emptyDocument, freshId, usedIds,
  declareObject, declareMorphism, declareHypothesis,
  removeDeclarations, renameDeclaration, setMorphismProperties,
  getObject, getMorphism, getHypothesis, objectsOf, morphismsOf, hypothesesOf,
  propositionError, validateContext, validateDocument,
} from './context.js';
export type { IdPrefix } from './context.js';

export { allPaths, pathExpr } from './paths.js';

export {
  getGoal, addGoal, addStep, setGoalStatus, tryCloseByNormalization, STEP_REFL_NORMALIZE,
} from './proof.js';

export {
  printExpr, printDiagrammatic, printClassical, printProposition, printDecl,
} from './print.js';
export type { PrintStyle } from './print.js';

export { FORMAT_NAME, FORMAT_VERSION, serializeDocument, deserializeDocument } from './serialize.js';

export { fromDiagram, PROPERTY_TYPES } from './fromDiagram.js';
export type { VisualNode, VisualEdge, CommGroups, FromDiagramResult } from './fromDiagram.js';
