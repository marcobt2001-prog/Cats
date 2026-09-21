// Public surface of the Lean layer.
//
// Pure and React-free: it maps the mathematical IR to Lean source, reads Lean's
// output back, and writes the verdict into a document. It imports `src/math`;
// nothing in `src/math` imports it. Running Lean is a Node concern and lives in
// `server/lean/`.

export { CATEGORY_VAR, isLeanIdent, leanIdent, assignLeanNames } from './names.js';
export type { LeanNames } from './names.js';
