# CATS — Phase 2 plan: separate diagram (visual) state from mathematical state

## Context

Phase 1 delivered a pure, tested mathematical IR in `src/math/` without touching the UI. The React app still stores fused records (node `{id,label,x,y}`, edge `{id,label,src,tgt,type,curve,commutative}`) in two duplicated canvases (`Editor` in `src/App.jsx`, `GameCanvas` in `src/game/GameMode.jsx`), and records "commutes" three inconsistent ways (editor `commGroups`, game `commEdgeIds`, per-edge `commutative` flag). Ids come from a module-global counter that is not persisted, commutativity is not in undo history and not pruned on delete, and `LevelLoader` calls hooks after an early return.

Phase 2 makes the `MathDocument` the source of truth for mathematics and a separate `Layout` the source of truth for presentation, so moving a node or bending an arrow can never change the mathematics. It also removes the duplication so the state change is made once.

Decisions made with the user:
- **Extract one shared `Canvas` component** in this phase.
- **Remove the per-morphism "commutative" checkbox.** Commutativity exists only as equality hypotheses between path pairs.
- Otherwise behavior-preserving. No new mathematical features. Level goal format unchanged (Phase 3 turns goals into real propositions).

Key technique for low risk: the new store exposes `nodes`/`edges` **views** in the legacy shape, so `Node.jsx`, `Edge.jsx`, `AlignToolbar.jsx`, and TikZ export stay untouched.

---

## Target state model

```ts
// src/diagram/types.ts
type ArrowStyle = 'morphism'|'mono'|'epi'|'iso'|'dashed'|'natural'|'exact'|'equiv'|'dotted'; // UI value
type Decoration = 'dashed'|'dotted'|'natural'|'exact'|'equiv';                                  // visual only
interface Layout { nodes: Record<ObjectId,{x:number;y:number}>; edges: Record<MorphismId,{curve:number; decoration?:Decoration}> }
interface DiagramState { doc: MathDocument; layout: Layout }
interface NodeView { id; label; x; y }                       // legacy shape
interface EdgeView { id; label; src; tgt; type: ArrowStyle; curve }
```

- `mono`/`epi`/`iso` live **only** in `MorphismDecl.properties`; `dashed`/`dotted`/`natural`/`exact`/`equiv` live **only** in `layout.edges[id].decoration`. The 9-value UI style is derived (`styleOf`) and written through one function (`setMorphismStyle`) that sets one side and clears the other. Nothing to keep in sync.
- Commutativity = `HypothesisDecl`s in the document. Teal edge highlight = morphisms mentioned by any hypothesis.
- Locked/given elements are a game **policy**: `Set<id>`s passed to `Canvas`, never stored in state or files.
- `.cat` v0.2 = `{ version: '0.2', meta, math: MathDocument, layout }`. v0.1 files are migrated on load.
- Undo history snapshots `{doc, layout}` together (fixes: commutativity now undoable; ids restored on undo because `nextId` travels in the doc).

---

## Step 1 — `src/math` additions (small)

Files: `src/math/paths.ts` (new), `src/math/expr.ts`, `src/math/context.ts`, `src/math/fromDiagram.ts`, `src/math/index.ts`, `tsconfig.json`, `vitest.config.js`.

```ts
// paths.ts — replaces geometry.js findAllPaths; identical semantics (simple paths; [[]] when start===end; declaration order)
allPaths(ctx, start, end): MorphismId[][]
pathExpr(start, path: MorphismId[]): MorphismExpr          // [] → identity, [m] → morphism, else compose
// expr.ts
mentions(e: MorphismExpr, ids: ReadonlySet<string>): boolean
// context.ts
removeDeclarations(doc, ids): MathDocument                 // cascade: morphisms of removed objects, hypotheses/goals mentioning removed ids
renameDeclaration(doc, id, name): MathDocument             // MathError if unknown
setMorphismProperties(doc, id, properties): MathDocument
```
- `fromDiagram.ts` switches to `allPaths` and drops the `../geometry.js` import (fixes the inversion). Existing `fromDiagram` tests must pass unchanged; that is the equivalence proof for `allPaths`.
- `tsconfig.include` += `src/diagram/**/*.ts`, `src/game/**/*.test.ts`. `vitest.config.js` include → `src/**/*.test.ts`. `src/diagram` must not import React (tsconfig has no DOM lib).

Tests: `paths.test.ts` (triangle order, identity path, loops never traversed, cycles A⇄B terminate, `pathExpr` order); extend `context.test.ts` (cascade removal keeps `validateContext` clean, no mutation, rename, properties, `mentions`).

## Step 2 — diagram core (medium)

Files: `src/diagram/types.ts`, `state.ts`, `commute.ts`, `views.ts`, `legacy.ts`, `index.ts` + tests.

```ts
// state.ts
createDiagram(): DiagramState
addObject(s, {x, y, name?}): [DiagramState, ObjectId]                 // default name = next letter by object count (today's behavior)
addMorphism(s, {src, tgt, name?, style?}): [DiagramState, MorphismId]
renameObject(s, id, name); renameMorphism(s, id, name)
styleOf(s, id): ArrowStyle; setMorphismStyle(s, id, style)
moveNodes(s, patches: Record<id, Partial<{x,y}>>)                      // layout only; doc reference unchanged
setCurve(s, id, curve)
deleteElements(s, {nodeIds?, edgeIds?})                                // cascades edges + hypotheses + layout entries
checkInvariants(s): string[]                                           // every object/morphism has a layout entry and vice versa; validateContext clean
// commute.ts
parallelPairs(s): { src, tgt, paths: MorphismId[][] }[]                // src≠tgt, ≥2 paths (what CommChecker lists)
isCommuting(s, src, tgt): boolean   // union-find over current paths keyed by normalize(pathExpr); union the sides of every hypothesis parallel at (src,tgt); true iff one class and ≥2 paths
markCommuting(s, src, tgt)          // add p0 = pi for every path not yet in p0's class; dedupe with propEquivalent both orientations; ids via freshId(doc,'h')
unmarkCommuting(s, src, tgt)        // remove all hypotheses parallel at (src,tgt)
toggleCommuting(s, src, tgt)
commutingEdgeIds(s): Set<MorphismId>
// views.ts
toViews(s): { nodes: NodeView[]; edges: EdgeView[] }
// legacy.ts — used by old files, editor defaults, level givens, constructions, paste
fromLegacyDiagram(nodes, edges, commGroups?): { state, warnings }
```
`fromLegacyDiagram` rules: `curve` missing → 0; `x`/`y` missing → 0 + warning; `type` mono/epi/iso → property, decoration values → decoration, unknown → plain + warning; edges skipped by `fromDiagram` are also absent from layout; **`commutative: true` flags** are honored by synthesizing `commGroups` entries for every `(src,tgt)` pair with ≥2 paths whose edges are all flagged (what the old validator accepted), and flagged edges not covered get a warning. Wraps the resulting context as `{ ...emptyDocument(), context }`.

Tests: `state.test.ts` (ids `o1…`, default names, endpoints required, style round-trip through all 9 values with property/decoration never both set, move/curve leave `doc` identical by reference, cascade delete, invariants after every op on I-4 and editor defaults); `commute.test.ts` (defaults A→C pair; I-4 mark → one hypothesis printing `h ∘ f = k ∘ g`, `commutingEdgeIds` = {f,g,h,k}, unmark, toggle twice is identity; three paths → two hypotheses; adding a fourth path makes `isCommuting` false and re-mark adds exactly one; mixed orientation counts via union-find; deleting a morphism cascades); `views.test.ts` (I-4 views equal legacy arrays minus `commutative`; moving changes only x/y); `legacy.test.ts` (defaults and I-4 import with no warnings; defaults with warnings; `commutative:true` on the square → one hypothesis; lone flag → warning; stale group → warning).

## Step 3 — merge and serialization (medium)

Files: `src/diagram/merge.ts`, `src/diagram/serialize.ts`, `index.ts` + tests.

```ts
extractSubdiagram(s, nodeIds, edgeIds): DiagramState          // keeps hypotheses whose morphisms are all inside (copy)
mergeDiagram(base, incoming, {dx, dy}): [DiagramState, { nodeIds, edgeIds }]   // remaps EVERY incoming id (objects, morphisms, hypotheses) via freshId; rewrites refs inside decls and expressions; appends in incoming order
CAT_VERSION = '0.2'
serializeCat(s, meta?): string
deserializeCat(json): { state, meta, warnings }              // '0.2' → deserializeDocument + layout coverage (missing entry → default + warning, unknown id → dropped + warning) + checkInvariants; missing or '0.1' → fromLegacyDiagram; else MathError
```
Tests: `merge.test.ts` (extract keeps only fully-contained hypotheses; merging the same fragment twice yields fresh ids, no collision, offsets applied, returned ids match views, base ids like `'A'` untouched); `serialize.test.ts` (v0.2 deep round-trip incl. meta; v0.1 sample with `commGroups` → one hypothesis; missing version = 0.1; version `'9'` throws; layout gaps and extras produce warnings).

## Step 4 — history (small)

Files: `src/diagram/history.ts` + test, `src/useDiagramHistory.js` (plain JS React hook, ~40 lines).

```ts
History<T> = { past: T[]; present: T; future: T[]; lastKey?: string }
createHistory, commit(h, next, key?, cap=50), undo, redo, canUndo, canRedo
```
- `commit` with the same `key` as `lastKey` replaces `present` (one entry per drag gesture / slider session); a different or absent key pushes; `undo`/`redo` clear `lastKey`; `next === present` is a no-op. Today a drag pushes one snapshot per mouse event and floods the 50 cap, so this is a fix.
- Hook: ref is the source of truth, `useState` for re-render. Exposes `state, views (memo of toViews), getState(), apply(nextOrFn, {coalesceKey}?), reset(state), undo(): boolean, redo(): boolean, canUndo, canRedo` (real booleans so buttons can disable). No `batch`: every op is one pure function. Owners needing new ids do `const [next, id] = addObject(getState(), …); apply(next); select(id)`.

Tests: `history.test.ts` (basics, cap, same-key coalesces, different key pushes, undo clears key, no-op, redo cleared on commit).

## Step 5 — extract `Canvas.jsx` from `Editor` (large, mostly moved code)

Files: `src/Canvas.jsx` (new), `src/useSelection.js` (new), `src/App.jsx`. Editor stays on the old arrays and old `useHistory` in this step.

- `Canvas` renders only the `<svg>`; owners keep the `position: relative` wrapper so AlignToolbar, CommChecker, toast, and the game overlay stay put.
- Props: `nodes, edges` (views), `commEdgeIds`, `lockedNodeIds?`, `lockedEdgeIds?`, `selection` (from `useSelection`), `mode, onModeChange, drawSrc, onDrawSrcChange`, `snap`, `showGrid`, `svgRef`, callbacks `onCreateNode({x,y})`, `onCreateEdge({src,tgt})`, `onMoveNodes(patches, {coalesceKey})` (absolute positions, same shape AlignToolbar already emits), `onSetCurve(id, curve, {coalesceKey})`, `onDelete({nodeIds, edgeIds})`.
- Internal state: `mouse`, `dragBox`, `dragging`, `curveDrag`. Keyboard owned by Canvas: Esc, 1/2/3, Delete/Backspace, Ctrl+A. Owners keep s, g, Ctrl+Z/Shift+Z, Ctrl+C/V.
- `useSelection()` keeps today's `sel` + `multiSel` semantics: `{ sel, multiSel, selNodeIds, selEdgeIds, selectOne, toggle, setMany, clear }`.
- Locked ids are filtered out of drag, marquee, shift-toggle, and delete inside Canvas. Multi-select and edge marquee are enabled in both modes (the game's nodes-only marquee is treated as accidental; deliberate small unification).

Verify: `npm run build`; editor smoke (all items in the smoke list except the "new behavior" ones).

## Step 6 — `GameMode` uses `Canvas` (medium)

Files: `src/game/GameMode.jsx`. Keep `useLevelState`, `commEdgeIds`, and the `c` key for now; pass `lockedNodeIds/lockedEdgeIds`, `snap={false}`.

Verify: `npm run build`; game smoke I-1 to I-4 with the old flow.

## Step 7 — Editor on `DiagramState` (large; the crux)

Files: `src/App.jsx`, `src/ObjectPanel.jsx`, `src/MorphismPanel.jsx`, `src/CommChecker.jsx`, `src/export.js`, `src/constructions.js`, optionally `src/defaults.js`.

- Delete `useHistory`. `useDiagramHistory(fromLegacyDiagram(DEFAULT_NODES, DEFAULT_EDGES).state)`; render from `views`; every mutator becomes an op (`addObject`, `addMorphism`, `moveNodes` with coalesce key per drag gesture, `setCurve` with key `curve:${id}`, `deleteElements`, `renameObject/renameMorphism`, `setMorphismStyle`, `toggleCommuting`).
- `MorphismPanel`: remove the commutative checkbox; callbacks `onRename`, `onSetType`, `onSetCurve` (slider uses coalesce key). `ObjectPanel`: `onRename`. Fix the existing bug where both panels call `onSelect({type,id})` but `App.jsx` wraps it again (`sel.id` becomes an object, so row click never selects).
- `CommChecker` becomes presentational: props `nodes, edges, pairs` (from `parallelPairs`), `isCommuting(src,tgt)`, `onToggle(src,tgt)`. No `findAllPaths` import.
- `export.js`: `saveDiagramFile(state, filename?)` and `loadDiagramFile() → { state, meta, warnings }` via `serializeCat`/`deserializeCat`; also settle the promise on picker cancel and `reader.onerror`. `exportTikzCD(nodes, edges)` unchanged, fed views. Load is `apply(state)` (undoable, as today) and toasts `Loaded (N warnings)` with warnings logged to console.
- `constructions.js`: pure data with local ids and no `uid()`; each template is `{ name, desc, symbol, nodes, edges, commGroups? }`; "Commutative Square" expresses its intent as `commGroups: { 'A|D': ['f','g','h','k'] }` instead of flags. Insert = `fromLegacyDiagram(template)` then `mergeDiagram(getState(), fragment, offsetToViewportCenter)` and select the returned ids.
- Copy/paste = `extractSubdiagram` into the clipboard state, `mergeDiagram(..., {dx:40, dy:40})` on paste.
- Undo/Redo buttons disabled from `canUndo/canRedo`. Import TS from JSX with an explicit extension or the directory index (`'./diagram/index.ts'`); Vite does not resolve a `.js` specifier to a `.ts` file from a JSX importer.

Checklist within the step: add, draw, move, curve, rename, type, delete, undo, redo, copy, paste, insert, mark, save, load (0.2 and 0.1), TeX, SVG.

Verify: `npm run check && npm run build`; full editor smoke.

## Step 8 — Game on `DiagramState` (medium)

Files: `src/game/LevelLoader.jsx`, `src/game/GameMode.jsx`, `src/game/ValidationEngine.js`, `src/game/levels/world1-sets.js`, `src/App.jsx`, `src/game/__tests__/ValidationEngine.test.ts` (new).

- `useLevelDiagram(levelId)`: hooks unconditional (level looked up first, early return only after all hooks); `initial = useMemo(() => fromLegacyDiagram(level.givens.nodes, level.givens.edges).state, [level])`; `lockedNodeIds/lockedEdgeIds` memoized per level; returns `{ level, history, lockedNodeIds, lockedEdgeIds, reset }` where `reset` reloads the initial state and clears history.
- `ValidationEngine.validateGoals(goals, state)`: `draw_morphism` → `morphismsOf(ctx).some(m => m.source===src && m.target===tgt)`; `mark_commutative` → `isCommuting(state, nodes[0], nodes[last])`. Same truth values on I-2/I-4 as today, but no longer satisfiable by flagging edges without an equation. Return shape unchanged (ProofLog untouched).
- `GameMode`: drop the `c` key, `commEdgeIds`, and the per-edge "∘ Commute" button; add a "∘ Commutes" toggle that opens the shared `CommChecker`; `commEdgeIds` for teal from `commutingEdgeIds(state)`; status text updated. `App.jsx` passes `key={levelId}` to `GameMode` so state resets on level change.
- `world1-sets.js`: I-2 and I-4 hint text now points at the Commutes panel; `commutative: false` may be dropped from givens (ignored by migration either way).

Tests: `ValidationEngine.test.ts` (I-1 draw verifies; I-3 loop verifies; I-2 g2 blocked until g1 then verified only after `markCommuting(A,C)`; I-4 verified after mark, pending after unmark).

Verify: `npm run check && npm run build`; game smoke.

## Step 9 — cleanup and docs (small)

Files: `src/geometry.js` (delete `uid`, `findAllPaths`, `detectCycles`; keep `R`, `GRID`, `snap`, `computeGeom`, `offsetBezier`), `ARCHITECTURE.md` (Phase 2 section: layered state, `.cat` v0.2 with `layout`, commutativity as hypotheses, shared Canvas; fix the earlier `diagram` field name), `CHANGELOG.md`.

Verify: `grep -rn "uid(\|findAllPaths\|detectCycles\|commutative\|commGroups" src` hits only `legacy.ts`, `fromDiagram.ts`, tests, and level data; `npm run check && npm run build`.

---

## Verification (end to end)

Automated: `npm run check` (tsc over `src/math` + `src/diagram` + game test; all vitest suites) and `npm run build` after every step.

Manual editor smoke (after Step 7):
1. Startup shows the three default objects and arrows; Undo and Redo buttons disabled.
2. `2` + click adds object "D", selected; Ctrl+Z removes, Ctrl+Shift+Z restores.
3. Drag B 200 px in one gesture; one Ctrl+Z returns it fully (single history entry per drag).
4. Drag the curve handle of `g ∘ f`; slider follows; one Ctrl+Z undoes the whole drag. Move the slider; one Ctrl+Z undoes the slider session.
5. Rename A to `X` in Objects panel; canvas and TeX export update; undo restores.
6. Set `f` to Mono → hook arrowhead; saved JSON has `properties:["mono"]` and no `decoration`. Set to Dashed → dashed line; JSON has `decoration:"dashed"` and no `properties`.
7. Morphisms panel has no commute checkbox.
8. Commutes panel lists `A → C`; mark → three teal edges; Ctrl+Z un-marks; re-mark shows "✓ commutes".
9. Draw a third A→C arrow: pair shows "mark" again; mark → four teal edges. Delete the new arrow: pair returns to "✓ commutes".
10. Shift-click A and B → AlignToolbar; align; undo restores.
11. Ctrl+A, Ctrl+C, Ctrl+V twice: two offset copies, teal marks copied, no console errors.
12. Insert → Commutative Square: centered, selected, four teal edges, listed as marked. Insert → Kernel/Cokernel: hook and double-head arrows.
13. Save, reload page, Load: identical diagram and marks. Load a v0.1 file from the current build: loads with a warnings count only if it had flags or stale groups.
14. SVG export and TeX copy work.
15. Clicking a row in the Objects panel selects that node (bug fix).

Manual game smoke (after Step 8):
1. I-1: A and B locked (dim, not draggable or selectable); draw A→B → ✓ and completion overlay; Reset clears the arrow and overlay; replay works.
2. I-2: draw A→C → g1 ✓, g2 pending; Commutes panel → mark `A → C` → g2 ✓ and overlay; Reset clears everything including marks.
3. I-3: loop A→A → ✓.
4. I-4: Commutes panel → mark `A → D` → ✓; the `c` key does nothing; hint mentions the panel.
5. Any level: add an object, draw from a given node to it, Delete removes both; Delete with only a given selected does nothing; marquee over givens selects nothing locked; leaving and reopening a level gives fresh state.
6. Console shows no hook-order or key warnings.

## Deferred (not Phase 2)

- Level goals as real `Proposition`s and `ValidationEngine` on `propEquivalent` / `tryCloseByNormalization` (Phase 3).
- Parsing `g \circ f` labels into composites; Lean-safe names (Phase 3).
- Any Lean generation or `verified` status (Phase 4).
- Promoting `natural`/`exact`/`equiv` decorations to mathematical concepts (later phases).
