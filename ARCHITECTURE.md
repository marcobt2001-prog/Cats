# CATS — Architecture

Phase 0 deliverable: an assessment of the codebase as found, the target
three-layer architecture from the development plan, and the refactoring path
between them. Phase 1 (the mathematical core) is described at the end.

## Target architecture

```
┌───────────────────────────────────────────────┐
│  UI            canvas, panels, proof log      │   React + SVG
├───────────────────────────────────────────────┤
│  Math IR       objects, morphisms, expressions│   src/math/ (pure TS)
│                equalities, context, goals,    │
│                steps, Lean references         │
├───────────────────────────────────────────────┤
│  Lean/Mathlib  definitions, theorems, checking│   authority on proofs
└───────────────────────────────────────────────┘
```

The middle layer is an interface, not a second mathematical universe. Only the
Lean layer may declare a goal verified.

## The codebase as found (March 2026 state, ~3,150 lines, plain JS/JSX)

### UI layer: present and reusable

| File | Role |
|---|---|
| `src/App.jsx` | App shell (editor / world select / game) and the `Editor` with undo/redo, multi-select, copy/paste, constructions dropdown, save/load, exports. |
| `src/Node.jsx`, `src/Edge.jsx`, `src/defs.jsx` | SVG rendering of objects and arrows, arrowhead markers, KaTeX labels. |
| `src/ObjectPanel.jsx`, `src/MorphismPanel.jsx`, `src/CommChecker.jsx`, `src/AlignToolbar.jsx` | Side panels, commutativity checker, alignment tools. |
| `src/panels/CollapsiblePanel.jsx`, `src/styles.js` | Shared chrome. |
| `src/game/GameMode.jsx`, `ProofLog.jsx`, `WorldSelect.jsx`, `LevelLoader.jsx`, `completion.js` | Game shell, level loading, proof log display, progress persistence. |
| `src/export.js` | TikZ-CD, SVG, and `.cat` JSON save/load. |
| `src/constructions.js` | Ten insertable diagram templates (visual only). |

### Mathematical layer: absent before Phase 1

The diagram model fuses visual and mathematical state:

- Node `{ id, label, x, y }`: `id`/`label` are mathematical, `x`/`y` visual.
- Edge `{ id, label, src, tgt, type, curve, commutative }`: `src`/`tgt` are
  mathematical (node ids); `curve` is visual; `type` (mono, epi, iso, dashed, …)
  selects a rendering and is never checked; `commutative` is a per-edge flag.
- Composition is never computed. `g \circ f` is a label string.
- Identity is any self-loop.
- "Commutes" is recorded three ways that disagree: editor `commGroups`
  (`"src|tgt"` → edge ids, serialized), game `commEdgeIds` (a `Set`, not
  serialized), and the `edge.commutative` checkbox. None records which two
  paths are asserted equal.
- `src/geometry.js` mixes bezier math with `findAllPaths` (the one genuinely
  mathematical routine) and a module-global `uid()` counter that is not restored
  on load, so ids can collide after load or paste.
- `src/game/ValidationEngine.js` is graph-based but `mark_commutative` only
  checks that two or more paths exist between the first and last listed node
  and that every edge on them was manually flagged. It records an assertion; it
  checks nothing.
- `src/export.js` TikZ export derives arrow direction from screen coordinates,
  the one place geometry leaks into mathematical output.

### Lean layer: cosmetic before Phase 4

Four hand-written `leanStub` strings live in `src/game/levels/world1-sets.js`
and are displayed with a regex highlighter in `GameMode.jsx`. There is no
generation, no execution, and no Lean toolchain in the repo.

### Known debt to clear during Phase 2

- `GameMode.jsx` duplicates ~150 lines of `Editor` interaction code with small
  divergences. Extract a shared canvas.
- `Node.jsx`/`Edge.jsx` carry a `locked` retrofit for the game.
- `LevelLoader.jsx` calls hooks after an early return.
- `givenNodeIds` sets are rebuilt every render and feed an effect dependency.
- `detectCycles` in `geometry.js` is unused; `ProofLog`'s `rejected` status is
  unreachable; `loadDiagramFile` never settles if the picker is cancelled.

## Refactoring path

1. **Phase 1, done: introduce the IR** in `src/math/` (additive, no existing
   file changed). See below.
2. **Phase 2, done: separate diagram state from mathematical state.** See the
   Phase 2 section at the end.
3. **Phase 3, done: semantic diagram interpretation.** Labels are parsed into
   definitions, equality is decided by `entails`, level goals are propositions.
   See the Phase 3 section at the end.
4. **Phase 4: Lean loop.** Local `lake`/`lean` runner, generator from
   `MathDocument`, result parser. Only this layer produces `verified`.
5. **Later:** constructions as real mathematical state, universal properties,
   typed objects (`G : Group`), notebook and problem-solver modes.

## Phase 1: the mathematical core (`src/math/`)

Pure TypeScript, no React, checked by `npm run typecheck`, tested by `npm test`.

| File | Responsibility |
|---|---|
| `types.ts` | The IR. Discriminated unions for expressions, goal status, declarations. |
| `expr.ts` | Constructors, typing (`typeOf`, `source`, `target`), `normalize`, structural and up-to-axioms equality. |
| `context.ts` | Documents, id minting, declarations, lookups, validation. |
| `proof.ts` | Goals, steps, and the one internal closing rule (`tryCloseByNormalization`). |
| `print.ts` | Diagrammatic (`f ≫ g`, `𝟙 A`) and classical (`g ∘ f`, `id_A`) printers. |
| `serialize.ts` | Versioned JSON with validation on load. |
| `fromDiagram.ts` | Adapter from the canvas shape (`nodes`, `edges`, `commGroups`) to a `MathContext`. |
| `index.ts` | Public exports. |

Design decisions:

- **Composition is stored in diagrammatic order** (`factors[0]` first), matching
  `findAllPaths`, Mathlib's `≫`, and the existing level stubs. The classical
  `g ∘ f` is a print style. `after(g, f)` exists for callers who think that way.
- **Ids come from a counter stored in the document**, so they survive
  save/load. Caller-supplied ids (node and edge ids from the canvas) are
  honoured and never clobbered.
- **The context is one ordered declaration list**, the order a Lean `variable`
  block needs.
- **`GoalStatus.verified` requires `authority: 'lean'`.** Nothing in `src/math`
  constructs it. CATS' own reasoning can only mark a goal `believed`.
- **Normalization covers only the syntactic axioms** (associativity and unit
  laws). There is no rewriting or proof search.

## Phase 2: layered diagram state (`src/diagram/`, `src/Canvas.jsx`)

Pure TypeScript, React-free, tested. The UI holds one `DiagramState`:

```ts
interface DiagramState { doc: MathDocument; layout: Layout }
interface Layout {
  nodes: Record<ObjectId, { x: number; y: number }>;
  edges: Record<MorphismId, { curve: number; decoration?: Decoration }>;
}
```

| File | Responsibility |
|---|---|
| `types.ts` | `DiagramState`, `Layout`, arrow styles, the legacy view shapes. |
| `state.ts` | Pure operations: add/rename/delete objects and morphisms, move, curve, arrow style, `checkInvariants`. |
| `commute.ts` | Commutativity as hypotheses: `parallelPairs`, `isCommuting`, `mark/unmark/toggleCommuting`, `commutingEdgeIds`. |
| `views.ts` | `toViews(state)` projects onto the legacy `{nodes, edges}` shape the renderers consume. |
| `legacy.ts` | `fromLegacyDiagram` imports the old fused shape (files, defaults, level givens, templates). |
| `merge.ts` | `extractSubdiagram` / `mergeDiagram` for copy, paste, and template insertion with fresh ids. |
| `serialize.ts` | `.cat` v0.2 `{ version, meta, math, layout }`; v0.1 files are migrated on load. |
| `history.ts` | Snapshot undo/redo with a coalesce key so a drag is one entry. |

UI pieces: `src/Canvas.jsx` (the one interactive SVG, shared by editor and game),
`src/useSelection.js`, `src/useDiagramHistory.js` (React wrapper over `history.ts`).

Design decisions:

- **Views, not a rewrite.** `Node.jsx`, `Edge.jsx`, `AlignToolbar.jsx`, and TikZ
  export still receive the legacy `{id,label,x,y}` / `{id,label,src,tgt,type,curve}`
  records; they are computed from the state, never stored.
- **Mathematical properties and visual decorations are stored disjointly.**
  `mono`/`epi`/`iso` live only in `MorphismDecl.properties`; `dashed`, `dotted`,
  `natural`, `exact`, `equiv` live only in `layout.edges[id].decoration`. The
  nine-value UI style is derived by `styleOf` and written by `setMorphismStyle`.
- **Commutativity is a set of equality hypotheses in the document.** A pair
  (src, tgt) commutes when every current path is identified with every other by
  the hypotheses (union-find, either orientation). Marking adds the missing
  equations; deleting a morphism removes the equations that mention it. The
  per-morphism "commutative" checkbox and the game's per-edge marks are gone.
- **Locked givens are a game policy**, passed to `Canvas` as id sets. They are
  not part of the state and never reach a file.
- **Ids come from the document counter**, so paste and template insertion mint
  fresh ids and reloading a file cannot collide.
- **Undo snapshots document and layout together**, so un-marking and re-marking
  commutativity are undoable and ids are restored on undo.

## Phase 3: semantic diagram interpretation (`src/math/label.ts`, `unfold.ts`, `definitions.ts`, `entail.ts`)

Phase 2 stored the mathematics but could not read it: `g \circ f` was a string,
and "commutes" meant "the paths are joined by a hypothesis". Phase 3 makes a
label mean something and makes one function decide every equality question.

| File | Responsibility |
|---|---|
| `math/label.ts` | The label grammar: `parseLabel` (text → AST), `resolveLabel` (names → ids, type-checked), `parsePropositionText` (`lhs = rhs`). |
| `math/unfold.ts` | `unfold` (expand definitions), `exprKey`, `exprEquivalentIn`, `definitionError`, `dependentsOf`. Imports only `expr.ts`, so `context.ts` can validate definitions. |
| `math/definitions.ts` | `setMorphismDefinition`, and the label bridge: `labelStatus`, `syncDefinition`, `inferDefinitions`, `reprintDependents`. |
| `math/entail.ts` | `entailment` / `entails`: what the context already forces, and which hypotheses it used. |
| `diagram/commute.ts` | `describePairs`: paths as expressions and equations as text, for the panel. |

Design decisions:

- **A morphism may have a `definition`.** `MorphismDecl.definition` says the
  morphism abbreviates an expression and is equal to it *by definition*. It must
  be parallel to the morphism and acyclic, but **may reference later
  declarations**: an arrow is normally drawn before it is labelled.
  `validateContext` therefore checks definitions against the whole context, in a
  pass of its own.
- **The label is the definition's source; the definition is the truth.** A label
  that parses as a composite or an identity and resolves becomes the definition
  (`syncDefinition`); a plain name clears it. Renaming a factor re-prints every
  dependent label through `printLatex` (`reprintDependents`), so the picture and
  the mathematics cannot drift apart. Importing uses `inferDefinitions`, which
  only *adds*, so a stored definition is never lost because its label stopped
  resolving.
- **Deleting a factor deletes what was defined from it.** The cascade in
  `removeDeclarations` is a fixpoint loop, since a definition may rest on another
  defined morphism. Consistent with hypotheses, and undoable.
- **One notion of equality.** `exprKey` = normalize ∘ unfold, so a composite
  arrow and the path it abbreviates share a key. `entailment` runs a BFS over
  those keys joined by the parallel hypotheses and reports the hypotheses used.
  `isCommuting` and the level goals both go through it, so a pair can commute
  *by definition*, with no equation at all: the panel says so and disables the
  toggle, since there is nothing left to assert.
- **No congruence.** `h ∘ f = k ∘ g` does not entail `h ∘ f ∘ x = k ∘ g ∘ x`.
  Rewriting under a composition is Lean's job (Phase 4); this is why CATS'
  own reasoning is still only `believed`.
- **Level goals are propositions**, written in the label grammar and resolved
  against the live context: `morphism { source, target, equals? }` and
  `eq { prop }`. I-2 is satisfied by labelling the arrow `g \circ f` *or* by
  asserting the equation in the panel, because both are the same mathematics.
  Goal statuses are `satisfied | pending | blocked`; **`verified` stays reserved
  for Lean**.
- **The game gained one affordance**: a label field for the selected
  player-drawn arrow, with the same status line the editor shows.
