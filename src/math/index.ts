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
  unfold, definitionError, exprKey, exprEquivalentIn, propEquivalentIn, dependentsOf,
} from './unfold.js';

export {
  setMorphismDefinition, labelStatus, syncDefinition, inferDefinitions, reprintDependents,
} from './definitions.js';
export type { LabelStatus } from './definitions.js';

export { entailment, entails } from './entail.js';
export type { Entailment } from './entail.js';

export {
  getGoal, addGoal, addStep, setGoalStatus,
  tryCloseByNormalization, tryCloseByEntailment, STEP_REFL_NORMALIZE, STEP_ENTAIL,
} from './proof.js';

export {
  printExpr, printDiagrammatic, printClassical, printLatex, printProposition, printDecl,
} from './print.js';
export type { PrintStyle } from './print.js';

export {
  nameKey, parseLabel, isPlainName, resolveLabel, resolveLabelText, parsePropositionText,
} from './label.js';
export type { LabelAst, ParseResult, ResolveResult, ResolveOptions } from './label.js';

export { FORMAT_NAME, FORMAT_VERSION, serializeDocument, deserializeDocument } from './serialize.js';

export { fromDiagram, PROPERTY_TYPES } from './fromDiagram.js';
export type { VisualNode, VisualEdge, CommGroups, FromDiagramResult } from './fromDiagram.js';
