# CATS — Phase 4 plan: Lean proof-of-concept

## Context

Phases 1–3 made `MathDocument` the truth and gave labels meaning, but nothing in the app can *prove* anything. `GoalStatus.verified` is declared (`src/math/types.ts:90-94`) and never constructed; `doc.goals` and `doc.steps` are always empty at runtime; the four `leanStub` strings in `src/game/levels/world1-sets.js` are decoration (I-2 uses `g ∘ f` on category morphisms and shifts object names; I-4 renames `C`→`D`, `D`→`E` because the stub binds `C` as the category); `ProofLog.jsx` styles `verified` identically to `satisfied`. No Lean toolchain exists on this machine.

Phase 4 closes the loop from the development plan (§15 local process, §16 generation, §17 Lean is the authority, §33 raw output alongside a basic interpretation): the IR is printed as a Lean 4 + Mathlib file, `lake env lean` checks it in a Node child process behind a Vite dev-server middleware, diagnostics come back mapped to goal ids, and only that path writes `verified { authority: 'lean' }`. Deployed (Vercel) builds have no endpoint; the UI degrades to "Lean available in local dev only" and can still show, copy, and download the generated file.

Decisions made with the user:
- **Lean 4 + Mathlib** (`import Mathlib.CategoryTheory.Category.Basic`; `≫`, `𝟙 A`, `A ⟶ B`). Lake project files in `lean/`.
- **Claude installs the toolchain as the last step**, asking before each download. Everything else is built and unit-tested first; tests needing `lake` skip until it exists.
- Local only. Simplest loop first (`rfl`, then composition/identity equalities); no universal properties.
- TypeScript only in pure layers (`src/math`, `src/diagram`, new `src/lean`); runner/middleware/UI in JS. `npm run check` green after every step (baseline 21 files, 196 tests).

Design decisions:
- **Lean identifiers are derived, never stored.** `assignLeanNames(ctx)` is pure and deterministic; `decl.lean` (`const`) overrides. Category variable `𝒞`, universes `u v` (so an object named `C` is fine).
- **Emission**: one `section`, `variable`s for objects (implicit) and atomic morphisms (explicit), `local notation` for defined morphisms (so `gf = f ≫ g` is `rfl` and needs no argument bookkeeping), one `example` per goal with hypotheses as explicit binders (Lean ≥ 4.11 would not include `variable` hypotheses used only inside `by`).
- **One proof recipe, one Lean run**: `first | rfl | (simp_all only [Category.assoc, Category.id_comp, Category.comp_id]; done) | aesop_cat`. No hypothesis lists in the tactic (no orientation, no `h`/`← h` loops); `simp_all` rewrites hypotheses with each other; `aesop_cat` is where Lean beats `entails` (congruence).
- **`verified` is constructed in exactly one file, `src/lean/apply.ts`.** `src/lean` imports `src/math`, never the reverse; `src/math` stays Lean-free. Runner lives in `server/lean/`, outside Vite's browser graph.
- **Goals**: the game promotes level goals into `doc.goals` under stable ids `goal:<levelId>:<goalId>`; the editor gets a "prove" button per parallel pair. Verify is available any time (a failing check is informative). Staleness = stored `generatedLean` differs from a fresh single-goal generation.
- **Mathlib cache outside OneDrive.** The repo sits under `OneDrive\Desktop`; the cache is several GB and hundreds of thousands of files. `CATS_LEAN_DIR` defaults to `%LOCALAPPDATA%\cats\lean`; `lean/` in the repo holds the four small source files and `setup.js` syncs them.
- `leanStub` fields are deleted; Lean is generated.

Process: document as `docs/PHASE4-PLAN.md` first, then build step by step.

---

## Target model

```ts
// src/math/types.ts (additions only; format/version unchanged)
GoalStatus.verified: { kind:'verified'; authority:'lean'; message?; by?: StepId }
GoalStatus.failed:   { kind:'failed'; authority:'lean'|'cats'; message; by?: StepId }

// src/math/context.ts
pruneDanglingSteps(doc): MathDocument     // drop steps referencing unknown ids; statuses whose `by` vanished → open
removeDeclarations(doc, ids)              // now ends with pruneDanglingSteps
// src/math/proof.ts
upsertGoal(doc, id, prop): MathDocument   // absent → addGoal(id); equivalent (either orientation) → unchanged; else replace, status open, steps pruned
removeGoals(doc, ids): MathDocument

// src/lean/names.ts (pure)
CATEGORY_VAR = '𝒞'
leanIdent(raw, kind:'object'|'morphism'|'hypothesis'): string
isLeanIdent(s): boolean
interface LeanNames { byId: Map<string,string>; category: string }
assignLeanNames(ctx): LeanNames            // deterministic, collision-free, honours decl.lean const

// src/lean/generate.ts (pure)
interface LeanGoalBlock { id: GoalId; startLine; line; endLine }        // 1-based inclusive; `line` = the example
interface GeneratedLean { source: string; goals: LeanGoalBlock[]; names: LeanNames }
generateLean(doc, opts?: { goalIds?: GoalId[] }): GeneratedLean
leanExpr(ctx, names, e): string; leanProp(ctx, names, p): string
definitionOrder(ctx): MorphismDecl[]       // defined morphisms, dependencies first

// src/lean/diagnostics.ts (pure)
interface LeanDiagnostic { line; col; severity:'error'|'warning'|'info'; message }   // line 0 = no position
interface LeanRaw { stdout; stderr; exitCode: number|null; timedOut: boolean; command: string }
interface LeanResult { ok: boolean; diagnostics; durationMs; raw: LeanRaw }
parseLeanOutput(stdout, stderr): LeanDiagnostic[]; isSorryWarning(d); summarize(raw, durationMs): LeanResult
reportByGoal(gen, result): { file: LeanDiagnostic[]; goals: { id; ok; diagnostics; message? }[] }

// src/lean/apply.ts (pure) — THE ONLY constructor of { kind: 'verified' }
STEP_LEAN_CHECK = 'lean-check'
applyLeanResult(doc, gen, result): MathDocument   // per goal: replace earlier lean-check step, addStep({generatedLean: single-goal source}), setGoalStatus verified/failed with by
leanCheckOf(doc, goalId); isStale(doc, goalId); leanViewOf(doc, goalId): { kind:'open'|'believed'|'verified'|'failed'|'stale'; message? }

// src/diagram/commute.ts
addPairGoals(s, src, tgt): DiagramState    // goals p₀ = pᵢ, skipping equivalent existing ones
```

```js
// server/lean/runner.js (Node)     projectDir(), guardSource(source), leanStatus({force}), checkLean(source, {timeoutMs=120000})
// server/lean/vite-plugin.js       catsLeanPlugin() — apply:'serve', routes /api/lean/status and /api/lean/check
// src/lean/client.js               probeLean(), checkLean(source, {timeoutMs, signal})
// src/lean/useLeanCheck.js         { availability, running, elapsedMs, result, error, run(source) }
// src/game/leanGoals.js            leanGoalId(levelId, goalId), levelGoalPropositions(level, state), upsertLevelGoals(state, level)
```

HTTP (dev server only): `GET /api/lean/status` → `{ available, reason?, elan, lean, lake, toolchain, mathlib, projectDir }`. `POST /api/lean/check` (header `X-CATS-Lean: 1`, body `{ source, timeoutMs? }`) → `200 LeanResult` (also for Lean failures/timeouts), `400` bad body / guard rejection / >1 MB, `403` Host not localhost or Origin mismatch or header missing, `503` unavailable. On Vercel both return `index.html`; the client treats non-JSON as unavailable.

Generated Lean, I-4 marked (hypothesis `f ≫ h = g ≫ k`, level goal `h \circ f = k \circ g`):

```lean
-- generated by CATS; do not edit by hand.
import Mathlib.CategoryTheory.Category.Basic

set_option autoImplicit false
set_option linter.unusedVariables false

open CategoryTheory

universe u v

section CATS

variable {𝒞 : Type u} [Category.{v} 𝒞]
variable {A B C D : 𝒞}
variable (f : A ⟶ B) (g : A ⟶ C) (h : B ⟶ D) (k : C ⟶ D)

-- goal:I-4:g1 : f ≫ h = g ≫ k  (CATS: entailed by h₁)
example (h₁ : f ≫ h = g ≫ k) : f ≫ h = g ≫ k := by
  first | rfl | (simp_all only [Category.assoc, Category.id_comp, Category.comp_id]; done) | aesop_cat

end CATS
```

Editor defaults with defined `g \circ f` and a "prove" goal: same header, then `variable (f : A ⟶ B) (g : B ⟶ C)`, `local notation "gf" => f ≫ g`, `-- g1 : gf = f ≫ g  (CATS: holds by definition)`, `example : gf = f ≫ g := by …`.

Identifier rules (`leanIdent`), in order: strip font wrappers (`\mathrm{}` `\mathcal{}` `\text{}` `\operatorname{}` …), accents → `x_tilde`/`x_hat`/`x_bar`; `^{-1}` → `_inv`, other `^{…}` → `_…`; subscript all digits → Unicode subscript digits (`\pi_1` → `π₁`), else `_…`; Greek commands → letters (`\lambda`→`lam`, `\Pi`→`Pi`, `\Sigma`→`Sigma` since Lean excludes those), `\times`→`x`, `\otimes`→`tensor`, `\oplus`→`sum`, `\circ`→`circ`, other `\cmd` → `cmd`; braces dropped, `'` kept, other non-id chars → `_`, collapse, trim; empty → decl id if an identifier else `X`/`f`/`h` by kind; non-letter first char → `x` prefix; reserved (Lean keywords ∪ `𝒞 Category CategoryTheory rfl first done simp_all only aesop_cat id Eq Type Prop Sort True False`) → append `'`. `assignLeanNames`: objects, then morphisms, then hypotheses; a morphism whose label parses to a composite/identity gets a synthesized name (`g \circ f` → `gf`, joined with `_` when factors are multi-char; `\mathrm{id}_A` → `id_A`); unnamed hypotheses `h₁, h₂, …`; collisions across all kinds → `_2`, `_3`, ….

---

## Step 1 — Document plumbing (small)

Files: `src/math/types.ts`, `context.ts`, `proof.ts`, `index.ts`, `tsconfig.json` (+`src/lean/**/*.ts`), `.gitignore` (+`lean/.lake/`); tests `context`, `proof`, math `serialize`, diagram `state`.

- `by?` on verified/failed; header comment now names `src/lean/apply.ts` as the sole constructor.
- `pruneDanglingSteps` called at the end of `removeDeclarations` (`context.ts:16-38` prunes goals but not steps today; a saved file would then fail `deserializeDocument` with "unknown reference"). `validateDocument` checks `by` for verified/failed too.
- `upsertGoal`, `removeGoals`.

Tests: goal + entail step, delete the hypothesis → step pruned, goal open, `validateDocument` clean, round-trips; `upsertGoal` keeps status on an equivalent prop (either orientation), resets and prunes on change; `deleteElements` with goals/steps present leaves the document valid.

## Step 2 — `src/lean/names.ts` (medium)

Files: `src/lean/names.ts`, `src/lean/index.ts`; test `src/lean/__tests__/names.test.ts`.

`isLeanIdent` implements Lean's id-first/id-rest classes (ASCII, Greek minus `λ Π Σ`, letterlike U+2100–214F, math alphanumerics U+1D49C–1D59F, subscripts, `' ! ? _`).

Tests (table): `f`→`f`; `\pi_1`→`π₁`; `\pi_{12}`→`π₁₂`; `A \times B`→`A_x_B`; `\ker f`→`ker_f`; `\tilde{f}`→`f_tilde`; `f^{-1}`→`f_inv`; `\lambda`→`lam`; `1`→`x1`; `by`→`by'`; `Type`→`Type'`; `C`→`C`. `assignLeanNames`: defaults → `{A,B,C,f,g,gf}`; I-4 marked → hypothesis `h₁` (no clash with morphism `h`); two objects `A` → `A`, `A_2`; morphism `h_1` + unnamed hypothesis → `h₁`, `h₁_2`; `const` override used; deterministic.

## Step 3 — `src/lean/generate.ts` (large)

Files: `src/lean/generate.ts`, `index.ts`; test `generate.test.ts` using `src/diagram/__tests__/fixtures.ts`.

- `definitionOrder`: DFS over defined morphisms via `mentions`; a cycle throws (defensive; `validateContext` guarantees acyclic).
- Emission: header, import, options, `open`, `universe`, `section CATS`, category, objects line, atomic morphisms line (omitted when empty), notations in `definitionOrder`, goal blocks in `doc.goals` order filtered by `goalIds`, `end CATS`. No goals → `-- no goals: the context itself is the statement`.
- Binders: all hypotheses in declaration order on every example, skipping ones tautological after unfolding (`exprKey` equal).
- Comment verdict from `entailment`: non-empty `by` → `entailed by h₁, h₂`; `[]` and `exprEquals` after unfold → `holds by definition`; `[]` otherwise → `holds by the category axioms`; not entailed → `not entailed by CATS; Lean decides`. Newlines stripped.
- `leanExpr`: nested compose factors parenthesized (`≫` is `infixr:80`). Properties ignored with a comment.

Tests: exact source and line map for the two examples above; `f = f` goal; I-3 loop `\mathrm{id}_A` → `local notation "id_A" => 𝟙 A` and goal `id_A = 𝟙 A`; forward-referenced and chained definitions ordered dependency-first; `goalIds` filter; `𝟙 A ≫ f = f` comment; not-entailed comment; tautological hypothesis omitted; determinism.

## Step 4 — `src/lean/diagnostics.ts` (small)

Header regex `^(.+?):(\d+):(\d+): (error|warning|info): ?(.*)$`, continuation lines appended, positionless `error:` → line 0; stdout then stderr. `ok = !timedOut && exitCode === 0 && no error && no sorry`. `reportByGoal`: file-level errors fail every goal; otherwise by block; timeout fails all with "timed out after N ms"; `message` = first error line prefixed "Lean: ".

Tests: success; error at the example line attributed with a multi-line message; sorry warning → not ok; error on a `variable` line → both goals fail; unused-variable warning only → ok; timeout; positionless error; Windows path sample.

## Step 5 — `src/lean/apply.ts` (small)

`applyLeanResult` as in the model (pure; undo is free via history snapshots); `message` = "checked in 3.2 s" on success, the goal report message on failure; unknown goal ids skipped; nothing to apply → same reference. `isStale`, `leanViewOf` (`believed` is never conflated with verified).

Tests: ok → `verified {authority:'lean', by}`, step with `generatedLean`, `validateDocument` clean, `.cat` round-trip; failing → `failed`; re-run replaces the step (one per goal); `isStale` false after apply, true after `renameMorphism` or deleting a hypothesis; cascade removes goal and step; existing `proof.test.ts` type-level guard still holds.

## Step 6 — Runner, Vite middleware, client (medium)

Files: `server/lean/runner.js`, `server/lean/vite-plugin.js`, `src/lean/client.js`, `vite.config.js`; tests `src/lean/__tests__/guard.test.ts`, `integration.test.ts` (`describe.skipIf(!status.available)`, 180 s timeout).

- `runner.js`: elan bin `~/.elan/bin` resolved explicitly and prepended to `PATH` (a running `npm run dev` may predate the install); temp file `os.tmpdir()/cats-lean/check-<pid>-<n>.lean` (UTF-8, no BOM, deleted after); `spawn(lake, ['env','lean',file], { cwd: projectDir(), windowsHide: true })`; timeout → `taskkill /T /F` on win32 (lake spawns lean) else SIGKILL; queue of one; `leanStatus` cached 60 s and checks elan, toolchain listed, `Basic.olean` present, before running `lean --version` (elan proxies auto-install missing toolchains; never trigger that). `guardSource`: imports must match `^import Mathlib\.`; reject `#…` commands and `run_cmd elab macro syntax initialize extern unsafe IO`.
- `vite-plugin.js`: `apply: 'serve'`; Host must be localhost/127.0.0.1/[::1]; Origin same-host if present; header required; 1 MB body cap. Nothing runs at import time, so `vite build` is unaffected.
- `client.js`: non-2xx or non-JSON → `{ available:false, reason:'Lean available in local dev only' }`.

Tests: guard accepts generated sources, rejects `#eval` and a non-Mathlib import. Integration (skips until Step 11): I-3 ok; I-4 marked ok; I-4 unmarked + goal → error inside the block, `reportByGoal` fails it; `timeoutMs: 1` → `timedOut`; two concurrent calls resolve in order.

## Step 7 — Shared Lean UI (medium)

Files: `src/lean/LeanCode.jsx` (moved from `GameMode.jsx:344-393`; operator class gains `≫ 𝟙 ⟶ 𝒞 := ←` with the `u` flag; keywords `first simp_all aesop_cat local notation set_option universe done`; `highlightLines`, line numbers), `src/lean/LeanPanel.jsx` (overlay like `CommChecker.jsx:13-18`, 520 px: availability chip, goal list with `leanViewOf` badges and `×`, Run with spinner and elapsed time, result banner, diagnostics list that highlights the source line, raw output toggle, Copy, Download), `src/lean/useLeanCheck.js`, `src/export.js` (`exportLean`, same Blob pattern as `exportSVG`). `showToast` is not used for results (2.2 s); the panel is the surface.

## Step 8 — Game wiring (medium)

Files: `src/game/leanGoals.js`, `GameMode.jsx`, `ProofLog.jsx`, `levels/world1-sets.js`; test `src/game/__tests__/leanGoals.test.ts`.

- `levelGoalPropositions`: `eq` → `parsePropositionText`; `morphism` with `equals` → prop `morphism(m.id) = expr` for the first candidate that `entails`, else the first candidate; none → reason; `morphism` without `equals` → reason "existence is part of the context". `upsertLevelGoals` upserts by `goal:<level>:<goal>` and removes stale level goals.
- `GameMode.jsx`: "⊢ Lean" toggle (gold `#f5c542`) after "∘ Commutes"; `runLean` = `apply(upsertLevelGoals)`, `generateLean(getState().doc)`, `lean.run`, `apply(applyLeanResult)`. `CompletionOverlay` gains `leanSource`, `onVerify`, `availability`; "Verify with Lean →" opens the panel and runs. `completedOnceRef` unchanged; Reset clears the panel.
- `ProofLog.jsx`: steps gain `lean?: LeanGoalView`; second icon: verified `⊢` gold, failed `✗` red with message, stale dimmed `⊢ (stale — re-run)`. `satisfied` keeps teal `✓`; the two are now visually distinct.
- Delete `leanStub` from all four levels (nothing else reads it).

Tests: I-1 → reason only; I-2 unnamed arrow + mark → `m = f ≫ g`; I-3 `\mathrm{id}_A` → `m = 𝟙 A`; I-4 marked → prop; idempotent upsert (same reference), stable ids, prop change resets status, valid document; I-4 generated source equals the Step 3 fixture.

## Step 9 — Editor wiring (small)

Files: `src/diagram/commute.ts` (+`addPairGoals`), `src/diagram/index.ts`, `src/CommChecker.jsx` (`onProve` button beside "mark", also for by-definition pairs), `src/App.jsx` ("⊢ Lean" toggle, `LeanPanel` over `state.doc.goals`, `onRemoveGoal` via `removeGoals`, run as in the game without the upsert). Tests in `commute.test.ts`: square → 1 goal, three paths → 2, by-definition pair still gets a goal, idempotent, valid document.

## Step 10 — Docs (small)

`docs/PHASE4-PLAN.md` finalised; `ARCHITECTURE.md` Phase 4 section (`src/lean/` and `server/lean/` tables, the `verified` invariant, staleness rule; update "Lean layer: cosmetic" at `:62-66` and the refactoring path); `CHANGELOG.md` v0.9 (step pruning, `leanStub` removal, endpoint); `README.md` pointer to `lean/README.md`; memory note on phase status.

## Step 11 — Toolchain (large, last; ask before each download)

Files: `lean/lakefile.toml` (`name="cats"`, `[[require]] mathlib` from git, `[[lean_lib]] Cats`), `lean/lean-toolchain` (copied from Mathlib master at setup), `lean/Cats.lean` (I-3 smoke example), `lean/lake-manifest.json` (committed after `lake update`), `lean/README.md`, `server/lean/setup.js` + `npm run lean:setup`.

1. Project dir: `CATS_LEAN_DIR` default `%LOCALAPPDATA%\cats\lean`; `setup.js` copies the four files there and the manifest back.
2. Install elan via the official PowerShell installer (~5 MB); `git config --global core.longpaths true`.
3. In the project dir: `lake update` (~1–3 min, ~1 GB), `lake exe cache get` (downloads ~1.5–3 GB, unpacks ~6–8 GB, 5–25 min; Defender slows it), `lake build` (~10–60 s). Toolchain ~300 MB download.
4. Smoke: `lake env lean` on the I-3 and I-4 fixtures → exit 0; I-4 with the binder removed → error inside the block; a `sorry` file → warning, `ok:false`. Then `npm test` runs the integration suite for real.
5. Document Windows notes (elan PATH in old shells, Defender exclusion for `.lake`, OneDrive, long paths, `taskkill`).

---

## Verification (end to end)

Automated: `npm run check` and `npm run build` after every step. New suites: `lean/names`, `lean/generate`, `lean/diagnostics`, `lean/apply`, `lean/guard`, `lean/integration`, `game/leanGoals`; extended: `math/context`, `math/proof`, `math/serialize`, `diagram/state`, `diagram/commute`. Roughly 260 tests before Step 11, plus the real Lean runs after.

Editor smoke (Chrome, `npx vite --port 5199`): "⊢ Lean" opens the panel with the availability chip; "prove" on A → C then Run → verified, one undo entry; second A → C arrow, "prove" → failed with the aesop message highlighted; mark the pair → stale → Run → verified; rename `f` → stale, Ctrl+Z → verified; delete `f` → goal and step gone, no console errors; Save/Load round-trips the status and `generatedLean`; Copy/Download match; `vite preview` → grey chip, Run disabled, Copy works.

Game smoke: I-1 Verify → "context OK (no goals)"; I-2 all three routes → verified; I-3 `\mathrm{id}_A` → verified by `rfl`, relabel `x` → CATS pending, Verify → failed; I-4 mark → verified, unmark → stale then failed; Reset clears goals and panel; overlay still appears once.

Toolchain checklist: `elan --version`; pinned toolchain listed; `lake --version`; `lake build` clean; `Basic.olean` present; `/api/lean/status` all green; integration tests no longer skipped.

## Risks

- Steps not pruned on cascade (`context.ts:16-38`) → Step 1 fixes it at the source.
- `C` bound as the category in the old stubs → `𝒞` plus the reserved set.
- Lean ≥ 4.11 variable inclusion → hypotheses as binders; unused-variable noise → linter off file-wide.
- `simp only [h, ← h]` loops and oriented lists fail on shared-left-side chains → `simp_all only […]; done` then `aesop_cat`. Residual: a hand-authored `a = b` / `b = a` pair could spin until the timeout → `failed: timed out` (documented; `markCommuting` never produces it).
- Notation tokens equal to keywords or referenced globals break the file → reserved set applies to notation names.
- OneDrive: cache must live outside the repo → `CATS_LEAN_DIR` default.
- Windows: elan not on the PATH of a running dev server (explicit resolution); `lake` spawns `lean` (`taskkill /T`); elan proxies auto-install (status probe checks first); Defender slows unpack.
- Code-executing dev endpoint → `apply:'serve'`, Host/Origin/header checks, `guardSource`, 1 MB cap.
- First run ~5–15 s cold, ~2–4 s warm; 120 s timeout; queue of one.
- `MathDocument` format/version unchanged; Phase 3 files load unchanged.

## Deferred

`reassoc_of%` and hypothesis-directed proofs; `decl.lean.raw` as notation bodies and typed `const` references (Phase 5); mono/epi/iso export; `lean-tactic` steps and hybrid text editing (Phase 12); persistent Lean process / LSP; the §33 error taxonomy beyond "raw plus location"; only-unverified runs; deployed verification (never in Phase 4, local by design).
