# CATS — Phase 3 plan: semantic diagram interpretation

## Context

Phase 2 made `MathDocument` the source of truth and turned "commutes" into equality hypotheses, but labels still mean nothing. `g \circ f` is an opaque string (`src/defaults.js:12`), level I-2 accepts any A→C arrow, I-3 accepts any self-loop, and the union-find in `src/diagram/commute.ts:39` keys on raw paths, so a path `[f, g]` and an arrow the user *named* `g ∘ f` are unrelated. `CommChecker.jsx:57-68` joins labels with `∘` in path order (classical order should be reversed) and has a dead `'id'` branch.

The path→expression and pair→equality machinery already exists (`allPaths`/`pathExpr` in `src/math/paths.ts`, `normalize`/`exprEquivalent`/`propEquivalent` in `src/math/expr.ts`, `hypothesesAt`/`isCommuting` in `commute.ts`). Phase 3 gives labels meaning and makes goals propositions:

- A morphism may carry a `definition` (it abbreviates an expression). A composite or identity label becomes that definition; renaming a factor re-prints dependents.
- Equality reasoning is context-aware: unfold definitions, normalize, join through hypotheses. `isCommuting`, the checker, and level goals all use one `entails`.
- Level goals are propositions in text form, resolved against the live context. Game statuses become `satisfied` so `verified` stays reserved for Lean.

Decisions made with the user:
- **Deleting a factor cascade-deletes morphisms defined from it** (consistent with hypotheses; undoable).
- **Levels require meaning.** I-3 needs the loop labelled as an identity; I-2 needs the A→C arrow to equal `g∘f` (by label, by marking, or via a "compose" button). The game gains a label input for player-drawn arrows.
- Definition logic lives in `src/math` (label is `MorphismDecl.name`, a math field; math never imports diagram). Forward references in definitions are allowed (arrow usually drawn before it is labelled); cycles are rejected.
- Goal kinds: `morphism { source, target, equals? }` and `eq { prop }` only. Goal text uses the label grammar.
- No Lean generation; Lean-safe identifier mapping deferred to Phase 4 with the generator.

Process: document this plan as `docs/PHASE3-PLAN.md` first, then build step by step with `npm run check` green after each step. TypeScript only in `src/math` and `src/diagram`.

---

## Target model

```ts
// src/math/types.ts
interface MorphismDecl { …; definition?: MorphismExpr; … }   // same endpoints; acyclic; may reference later decls

// src/math/label.ts (new)
type LabelAst = { kind:'name'; text } | { kind:'identity'; object?: string } | { kind:'compose'; factors: LabelAst[] } // diagrammatic order
parseLabel(text): { ok:true; ast } | { ok:false; error }
isPlainName(ast): boolean
resolveLabel(ctx, ast, opts?: { expected?: {source,target}; exclude?: Set<MorphismId> }): { ok:true; expr } | { ok:false; error }
resolveLabelText(ctx, text, opts?)
parsePropositionText(ctx, 'lhs = rhs'): { ok:true; prop } | { ok:false; error }
nameKey(s): string                                   // whitespace removed; lookup key for names

// src/math/print.ts
type PrintStyle = 'diagrammatic' | 'classical' | 'latex'
printLatex(ctx, e): string                           // `g \circ f`, `\mathrm{id}_A`, `\mathrm{id}_{A \times B}`

// src/math/definitions.ts (new)
definitionError(ctx, id, def): string | undefined    // ill-typed, endpoint mismatch, self/cyclic
setMorphismDefinition(doc, id, def | undefined): MathDocument
unfold(ctx, e): MorphismExpr                         // visited-set cycle guard → MathError
exprKey(ctx, e): string                              // JSON.stringify(normalize(unfold(ctx, e)))
exprEquivalentIn(ctx, a, b); propEquivalentIn(ctx, a, b)
dependentsOf(ctx, id): MorphismDecl[]                // definitions mentioning `id` (object or morphism)
type LabelStatus = { kind:'atomic' } | { kind:'defined'; expr } | { kind:'unresolved'; error }
labelStatus(ctx, id): LabelStatus
syncDefinition(doc, id): MathDocument                // label → set definition, or strip; same ref when unchanged
inferDefinitions(doc): MathDocument                  // add-only, every morphism without a definition (used on load)
reprintDependents(doc, id): MathDocument             // rename dependents to printLatex(definition)

// src/math/entail.ts (new)
type Entailment = { holds:true; by: HypothesisId[] } | { holds:false; error?: string }
entailment(ctx, prop): Entailment                    // BFS over exprKey nodes joined by hypotheses parallel at the pair
entails(ctx, prop): boolean

// src/math/proof.ts
STEP_ENTAIL = 'entail'; tryCloseByEntailment(doc, goalId): { doc; closed }   // believed; step inputs [goalId, ...by]

// src/diagram/commute.ts
interface PairDescription { src; tgt; srcName; tgtName; paths: { ids; expr; text }[]; hypotheses: { id; text }[]; commutes; byDefinition }
describePairs(s): PairDescription[]
```

Level goals (`src/game/levels/*.js`), statuses `'satisfied' | 'pending' | 'blocked'`:
```js
{ id, type: 'morphism', source, target, equals?: 'g \\circ f', description, dependsOn? }
{ id, type: 'eq', prop: 'h \\circ f = k \\circ g', description, dependsOn? }
```

---


## Step 1 — `definition` on `MorphismDecl` (small)

Files: `src/math/types.ts`, `src/math/context.ts`, `src/math/definitions.ts` (new, first half), `src/math/index.ts`; tests `context.test.ts`, `serialize.test.ts` (math), new `definitions.test.ts`.

- `types.ts:54-62`: add `definition?: MorphismExpr`.
- `context.ts:106 declareMorphism`: accept optional `definition`, store only when present (same spread style as `properties`). Not validated here (forward refs); `validateContext` does.
- `context.ts:15 removeDeclarations`: make the cascade a **fixpoint loop**: a morphism is gone if its source/target is gone or `mentions(definition, gone)`; repeat until stable. Hypotheses/goals filtered afterwards as now.
- `context.ts:186 validateContext`: after the ordered loop, a second pass over defined morphisms calling `definitionError` against the **full** context (`morphism 'id': definition: …`). `checkInvariants` (`src/diagram/state.ts:106`) and `deserializeDocument` (`src/math/serialize.ts:39`) pick this up, so a crafted cyclic file is rejected on load.
- `definitions.ts` first half: `definitionError`, `setMorphismDefinition` (strip pattern as `setMorphismProperties`, `context.ts:38`), `unfold`, `exprKey`, `exprEquivalentIn`, `propEquivalentIn`, `dependentsOf`.

Tests: set `gf := f ≫ h` on the square fixture round-trips; endpoint mismatch throws; self-reference throws; two-step cycle rejected by `validateContext`; forward-reference definition passes; `exprEquivalentIn(ctx, morphism('gf'), compose(f,h))` true while `exprEquivalent` false; `removeDeclarations(doc, ['f'])` removes `gf`, a chained dependent, and hypotheses mentioning them; math `serialize.test.ts` round-trips a defined morphism and rejects a cyclic one.

## Step 2 — Label grammar and `printLatex` (medium)

Files: `src/math/label.ts` (new), `src/math/print.ts`, `src/math/index.ts`; tests new `label.test.ts`, extend `print.test.ts`.

Grammar (tokenizer tracks `{}` depth; only depth-0 characters are structural):
```
expr     := term (OP term)*       OP ∈ {\circ, ∘} classical (reversed to diagrammatic) | {\gg, ≫} diagrammatic; mixing → error
term     := '(' expr ')' | atom
atom     := identity | name
identity := (\mathrm{id} | \operatorname{id} | \text{id} | id | 1 | \mathbb{1} | 𝟙) subscript?     subscript := _{text} | _token | ' text'
name     := maximal run of non-structural text, trimmed (LaTeX allowed: \pi_1, f', \iota)
```
- `\circ`/`\gg` must be followed by a non-letter (`\circled` is a name). Empty text, trailing operator, unbalanced parens/braces → `{ok:false}`.
- `resolveLabel`: `name` → morphisms with equal `nameKey`, minus `exclude`; none → `unknown morphism 'x'`, several → `ambiguous name 'x'`. Identity with subscript → object by `nameKey`; without → needs `expected.source === expected.target`. Then `typeOf`, then endpoint check against `expected`.
- `parsePropositionText`: split on the single depth-0 `=`, resolve both sides, then `propositionError` (`context.ts:171`).
- `print.ts`: add `'latex'` to `PrintStyle`; identity → `\mathrm{id}_A` (braces when the object name is longer than one char); compose joined with ` \circ ` reversed (shares the classical branch at `print.ts:33`); a referenced morphism that itself has a definition is parenthesized. Export `printLatex`.

Tests: `g \circ f`, `g∘f`, `f \gg g` → compose[f,g]; `h \circ (g \circ f)` and `(h \circ g) \circ f` → compose[f,g,h]; all identity spellings; `\pi_1` is a name; mixed operators / `g \circ` / `(g \circ f` errors. Resolve on defaults and square fixtures: expected A→C ok; `f \circ g` type error; unknown; ambiguous (two morphisms named `f`); `\mathrm{id}_{A \times B}` resolves whitespace-insensitively; bare `id` with A→A ok, with A→B error. `parsePropositionText(square, 'h \\circ f = k \\circ g')` prints `h ∘ f = k ∘ g`; non-parallel and double `=` errors. `printLatex` cases.

## Step 3 — Label ↔ definition sync (small)

Files: `src/math/definitions.ts` (second half), `src/math/index.ts`; tests `definitions.test.ts`.

- `labelStatus`: stored definition → `defined`; else parse: plain/unparsable → `atomic`; composite/identity → resolve with `expected` endpoints and `exclude:{id}` → `defined` or `unresolved(error)`.
- `syncDefinition`: plain or unparsable → strip; composite/identity that resolves and passes `definitionError` → set; else strip. Same `doc` reference when nothing changes.
- `inferDefinitions`: "set" branch only, for morphisms without a definition. Idempotent. Used on every import/load (a full re-sync on load would strip a stored definition whose label no longer resolves).
- `reprintDependents(doc, id)`: rename each dependent to `printLatex(ctx, definition)` using the post-rename context; does not re-sync dependents (definition is the truth, label is derived).

Tests: defaults after `inferDefinitions` has `f3.definition = f1 ≫ f2`; rename `f3` → `h` strips; rename `f1` → `\phi` then reprint gives `g \circ \phi`; rename object `A` re-prints a loop labelled `\mathrm{id}_A`; `inferDefinitions` never strips; unresolvable composite reports the resolver error; a cycle-creating label is stripped.

## Step 4 — Entailment (small)

Files: `src/math/entail.ts` (new), `src/math/proof.ts`, `src/math/index.ts`; tests new `entail.test.ts`, extend `proof.test.ts`.

- `entailment`: `propositionError` → `{holds:false, error}`. Nodes = `exprKey` of both sides plus both sides of every hypothesis whose left side types to the same (source, target). Undirected edges labelled by hypothesis id; BFS from left key to right key. `by = []` when keys coincide (refl after unfold+normalize).
- `tryCloseByEntailment` mirrors `tryCloseByNormalization` (`proof.ts:43`). Not wired to UI this phase; gives Phase 4 the step shape.
- Documented limitation: no congruence (rewriting under composition).

Tests: square + `f≫h = g≫k` entails both orientations with `by=[h1]`; chain `a=b`, `b=c` → `by=[h1,h2]`; defaults with `f3 := f1≫f2` entails `f3 = f1≫f2` with `by=[]`; `f ≫ 𝟙B ≫ h = f ≫ h` holds; non-parallel → error; unrelated square → false; `tryCloseByEntailment` records inputs, second call no-op, `validateDocument` clean.

## Step 5 — Diagram layer wiring (medium)

Files: `src/diagram/state.ts`, `legacy.ts`, `serialize.ts`, `merge.ts`, `commute.ts`, `index.ts`; tests `state`, `legacy`, `serialize`, `merge`, `commute`; one line in `src/game/__tests__/ValidationEngine.test.ts`.

- `state.ts:31 addMorphism`: `syncDefinition` after `declareMorphism`. `state.ts:45 renameMorphism`: rename → `syncDefinition` → `reprintDependents`. `state.ts:41 renameObject`: rename → `reprintDependents`. `deleteElements`/`pruneLayout` unchanged (layout is filtered by surviving doc ids); add a test that `checkInvariants` is clean after deleting a factor.
- `legacy.ts:56`: `inferDefinitions` on the built doc (defaults' `g \circ f` and the Identity template at `src/constructions.js:72` become defined). `fromDiagram.ts` untouched.
- `serialize.ts:63` (v0.2 branch): `inferDefinitions` after `deserializeDocument`. No version bump.
- `merge.ts`: morphism pass declares without definition; second pass `setMorphismDefinition(doc, idMap.get(d.id), mapExpr(d.definition, idMap))`; hypotheses last. `extractSubdiagram`: keep a definition only if every ref is in `kept`, else strip it.
- `commute.ts:39`: key becomes `exprKey(s.doc.context, e)`; thread `s` through `pathClasses`, `isCommuting`, `markCommuting`. A path equal by definition is in the same class with no hypothesis; `unmarkCommuting` on such a pair is a no-op (UI disables the toggle). Add `describePairs` (uses `parallelPairs`, `pathExpr`, `printClassical`, `hypothesesAt`, `printProposition`, `isCommuting`; `byDefinition = commutes && hypotheses.length === 0`).
- Export new functions from both `index.ts` files.
- `ValidationEngine.test.ts:35` names the I-2 arrow `g \\circ f` and expects `['verified','pending']`; after this step the arrow is defined and the pair commutes. Change that line to an unnamed arrow (Step 7 rewrites the test).

Tests: `addMorphism(defaults, {A→C, name:'g \\circ f'})` defined; rename to `h` strips; renaming `f1` re-labels `f3`; deleting `f1` removes `f3`, invariants clean; legacy defaults import has `f3` defined with no warnings; v0.2 round-trip with a definition; a Phase-2-shaped file loads with the definition inferred; v0.1 with `commGroups` gives one hypothesis and a definition; paste defaults twice → pasted composite defined over new ids; extracting only `A`, `C`, `f3` strips; `isCommuting(defaults, A, C)` now true and `markCommuting` returns the same state; a third A→C arrow makes it false and marking adds exactly one hypothesis; `describePairs` texts and `byDefinition` on defaults and on the marked square.

## Step 6 — CommChecker and MorphismPanel (small)

Files: `src/CommChecker.jsx`, `src/MorphismPanel.jsx`, `src/LabelStatus.jsx` (new), `src/App.jsx`, `src/game/GameMode.jsx` (props only).

- `CommChecker` props: `pairs: PairDescription[]`, `onToggle`, `onCompose(src, tgt, expr)`, `onClose`. Replace `:57-68` with one line per path rendering `p.text`; list `hypotheses[].text` in teal; when `byDefinition` show "= by definition" and disable the toggle; a "compose" button beside paths of length ≥ 2.
- Owners (`App.jsx:112,324`, `GameMode.jsx:50,194`): `pairs = useMemo(() => describePairs(state), [state])`; `onCompose` = `addMorphism(getState(), { src, tgt, name: printLatex(ctx, expr) })`.
- `LabelStatus.jsx`: one line: `atomic morphism` / `= g ∘ f (by definition)` / `cannot resolve: …` (warning colour). Imports from `'./math/index.ts'`.
- `MorphismPanel.jsx:34-36`: replace "LaTeX ok" with `<LabelStatus>`; new props `ctx`, `labelStatusOf`. `App.jsx:338` passes them.
- Rename already uses `coalesceKey: label:${id}` (`App.jsx:132`), so sync and dependent re-prints are one undo entry.

Verify: `npm run check && npm run build`; editor smoke 1–7.

## Step 7 — Goals as propositions (medium)

Files: `src/game/ValidationEngine.js`, `src/game/levels/world1-sets.js`, `src/game/ProofLog.jsx`, `src/game/__tests__/ValidationEngine.test.ts`.

- `ValidationEngine.js`: `morphism` → candidates with matching endpoints; no `equals` → satisfied if any; with `equals` → `resolveLabelText(ctx, equals, { expected })`, unresolvable → pending with `error` on the goal, else satisfied if some candidate `m` has `entails(ctx, { left: morphism(m.id), right: expr })`. `eq` → `parsePropositionText` then `entails`. Unknown type → pending. `dependsOn` compares against `'satisfied'`; `levelComplete` likewise. `updatedSteps` shape unchanged.
- `ProofLog.jsx:30-42`: add `satisfied` (same colour/icon as `verified`; keep `verified` for Phase 4).
- `world1-sets.js`: I-1 `morphism A→B`; I-2 g1 `morphism A→C` "Draw a morphism A → C", g2 `morphism A→C, equals:'g \\circ f', dependsOn:'g1'` "Make it the composite: label it g∘f, or mark A → C in ∘ Commutes"; I-3 `morphism A→A, equals:'\\mathrm{id}_A'` "Draw and label id_A"; I-4 `eq 'h \\circ f = k \\circ g'`. Update hints; `leanStub` untouched.
- Rewrite the test file: `Goal` type, `'satisfied'`; I-2 three routes (label, mark, `f \\gg g`), `f \\circ g` → pending, ambiguous `f` → pending; I-3 unlabeled pending, `\\mathrm{id}_A` / `1_A` / `id` satisfied, `x` pending; I-4 mark/unmark; authoring guard that every World 1 `equals`/`prop` resolves against the level's givens.

## Step 8 — Rename affordance in the game (small)

Files: `src/game/GameMode.jsx`.

- When `sel?.type === 'edge' && !lockedEdgeIds.has(sel.id)`, render in the toolbar (after "∘ Commutes", `:174-178`) an inline `<input>` calling `apply(s => renameMorphism(s, sel.id, value), { coalesceKey: 'label:'+sel.id })` plus `<LabelStatus>`. Inline JSX or a top-level component, **not** an inner component like `ModeBtn` (`:111-114`) — that remounts on every keystroke and loses focus.
- `Canvas.jsx` already ignores keys when focus is in an INPUT. Update the status line (`:116-120`) to mention the label.

## Step 9 — Docs (small)

`docs/PHASE3-PLAN.md` finalised, `ARCHITECTURE.md` Phase 3 section (definitions, label grammar, entailment and its non-congruence limitation, goal kinds, `satisfied` vs `verified`; update the refactoring path at `:84-86`), `CHANGELOG.md` v0.8 entry (including the cascade-delete behaviour and the checker order fix). Update the memory note on phase status.

---

## Verification (end to end)

Automated: `npm run check` and `npm run build` after every step. New suites: `definitions`, `label`, `entail`; extended: `context`, `serialize` (both), `print`, `proof`, `state`, `legacy`, `merge`, `commute`, `ValidationEngine`.

Editor smoke (Playwright against local Chrome, `npx vite --port 5199`, as in Phase 2):
1. Startup: Morphisms panel shows `g ∘ f` with "= g ∘ f (by definition)"; Commutes panel lists A → C as commuting by definition with the toggle disabled, paths printed in classical order.
2. Rename `f` → `\phi`: composite label becomes `g \circ \phi`; one Ctrl+Z restores both.
3. Rename the composite → `h`: "atomic morphism"; pair shows "mark"; mark → one teal equation `g ∘ f = h` listed under the pair.
4. Type `g \circ x`: "cannot resolve: unknown morphism 'x'"; `g \circ f` again: defined.
5. Draw a third A→C arrow; "compose" on the `g ∘ f` path adds a defined `g \circ f` arrow; delete `f`: composites and equations vanish, no console errors, undo restores everything.
6. Loop on A labelled `\mathrm{id}_A`; rename A → `X`: loop reads `\mathrm{id}_X`.
7. Save / reload / Load: identical. A Phase 2 v0.2 file with `g \circ f` loads defined with no warnings. A v0.1 file with `commGroups` gives one hypothesis plus the definition.
8. Paste the whole triangle: pasted composite defined over new ids. Paste only `A`, `C`, and the composite: "cannot resolve".
9. TeX copy unchanged.

Game smoke:
1. I-1: draw A→B → ✓ overlay; Reset.
2. I-2: route 1 draw A→C, select it, type `g \circ f` → g2 ✓. Reset. Route 2: draw, mark A → C in ∘ Commutes → ✓. Route 3: "compose" on `g ∘ f` → both ✓.
3. I-3: loop → ○; label `\mathrm{id}_A` → ✓; `1_A` → ✓; `x` → ○.
4. I-4: mark → ✓; unmark → ○.
5. Typing in the label input never switches modes or deletes; locked givens show no input; input keeps focus; no console warnings.

## Risks

- `context.ts:15` single-pass cascade → fixpoint needed or chained dependents dangle and the next load throws.
- `context.ts:186` validates against the `soFar` prefix → definitions need a full-context pass.
- `serialize.ts` (math) shape checks are shallow → `unfold` must carry its own cycle guard; validation rejects cyclic files.
- `merge.ts:98` builds `idMap` during the pass → definitions need the second pass.
- Name resolution is by label: a player naming a new arrow `f` in I-2 makes goal text ambiguous (pending with an error). Acceptable; Lean-safe ids in Phase 4.

## Deferred

Lean-safe identifiers and generation (Phase 4); wiring `tryCloseByEntailment` to goals in `doc.goals`; congruence closure; TikZ export of equations; promoting mono/epi/iso to propositions; teal highlight for by-definition equalities; goal text naming player-drawn arrows.
