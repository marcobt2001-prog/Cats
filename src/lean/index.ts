// Public surface of the Lean layer.
//
// Pure and React-free: it maps the mathematical IR to Lean source, reads Lean's
// output back, and writes the verdict into a document. It imports `src/math`;
// nothing in `src/math` imports it. Running Lean is a Node concern and lives in
// `server/lean/`.

export { CATEGORY_VAR, isLeanIdent, leanIdent, assignLeanNames } from './names.js';
export type { LeanNames } from './names.js';

export { generateLean, leanExpr, leanProp, definitionOrder } from './generate.js';
export type { GeneratedLean, GenerateOptions, LeanGoalBlock } from './generate.js';

export { parseLeanOutput, isSorryWarning, summarize, reportByGoal } from './diagnostics.js';
export type { LeanDiagnostic, LeanRaw, LeanResult, GoalReport } from './diagnostics.js';

export { applyLeanResult, leanCheckOf, isStale, leanViewOf, STEP_LEAN_CHECK } from './apply.js';
export type { LeanGoalView } from './apply.js';
