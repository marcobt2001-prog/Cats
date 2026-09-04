# Changelog

All notable changes to this project will be documented in this file.

<!-- New entries go here, newest first -->

## 2026-09-04 — v0.7: Diagram state separated from mathematical state (Phase 2)

### State model
- The editor and the game now hold one `DiagramState = { doc: MathDocument, layout }`; positions and curves live in `layout`, everything mathematical in `doc`. Moving a node cannot change the mathematics.
- New pure module `src/diagram/` (TypeScript, tested): operations, commutativity, views, legacy import, merge, `.cat` serialization, undo history
- Arrow styles split: mono/epi/iso are morphism properties in the document; dashed/dotted/natural/exact/equiv are visual decorations in the layout
- Commutativity is now a set of equality hypotheses in the document, undoable, and pruned when a morphism is deleted. The per-morphism "commutative" checkbox and the game's per-edge `C` key are removed; both modes use the Commutes panel
- `.cat` format v0.2 `{ version, meta, math, layout }`; v0.1 files are migrated on load (old `commutative` flags become equations where they covered a full pair of paths; a warning count is shown otherwise)

### Shared canvas
- New `src/Canvas.jsx` replaces the duplicated interaction code in `App.jsx` and `GameMode.jsx`; `useSelection.js` and `useDiagramHistory.js` hold selection and undo state
- Given elements in the game are id sets passed to the canvas (locked), never stored in state or files
- Multi-select and edge marquee now work the same in both modes

### Fixes absorbed by the refactor
- Ids come from the document counter: paste, template insertion, and reloading a file no longer risk collisions
- A drag or slider session is one undo entry (previously one per mouse event); Undo/Redo buttons disable when unavailable
- Clicking a row in the Objects or Morphisms panel now selects that element
- `LevelLoader` no longer calls hooks after an early return; `GameMode` is keyed by level id so state resets on level change
- Loading a file settles the promise on cancel and read errors
- Given (locked) objects can now be used as morphism endpoints in the game: `Node.jsx` no longer swallows the mouse gesture, the canvas applies the locked policy instead. Level I-1 was not completable before this fix
- Removed dead code: `uid`, `findAllPaths`, `detectCycles` from `geometry.js`

### Verification
- `npm run check`: 16 test files, 113 tests; `npm run build` clean
- Browser smoke test (Playwright against Chrome): 26 checks across editor and game flows, no console errors

### Files
- New: `src/diagram/**`, `src/Canvas.jsx`, `src/useSelection.js`, `src/useDiagramHistory.js`, `src/defaults.js`, `src/math/paths.ts`, `docs/PHASE2-PLAN.md`, `src/game/__tests__/ValidationEngine.test.ts`
- Changed: `App.jsx`, `GameMode.jsx`, `LevelLoader.jsx`, `ValidationEngine.js`, `CommChecker.jsx`, `MorphismPanel.jsx`, `ObjectPanel.jsx`, `export.js`, `constructions.js`, `geometry.js`, `world1-sets.js` (I-4 hint), `src/math/context.ts`, `src/math/fromDiagram.ts`

## 2026-09-04 — v0.6: Mathematical Core (Phase 1)

### Architecture assessment
- Added `ARCHITECTURE.md`: current-state audit, target three-layer architecture (UI / mathematical IR / Lean), and the phase-by-phase refactoring path
- Baseline verified before changes: `npm run build` produced the identical bundle already in `dist/`

### `src/math/` — pure TypeScript mathematical IR (no React, no existing file touched)
- `types.ts` — objects, morphisms, identity, n-ary composition, equality propositions, ordered context, goals, steps, optional Lean references
- `expr.ts` — constructors, typing (`typeOf` / `source` / `target`), `normalize` (associativity + unit laws), structural and up-to-axioms equality
- `context.ts` — documents with an in-document id counter, declarations, lookups, validation
- `proof.ts` — goals, steps, `tryCloseByNormalization` (marks goals `believed`, never `verified`)
- `print.ts` — diagrammatic (`f ≫ g`, `𝟙 A`) and classical (`g ∘ f`, `id_A`) printers
- `serialize.ts` — versioned JSON with validation on load
- `fromDiagram.ts` — adapter from the canvas shape (`nodes`, `edges`, `commGroups`) to a `MathContext`; positions are ignored
- Composition is stored in diagrammatic order to match `findAllPaths`, Mathlib `≫`, and the existing level stubs
- `GoalStatus.verified` requires `authority: 'lean'`; nothing in `src/math` constructs it

### Tooling
- Added `typescript` and `vitest` dev dependencies; `tsconfig.json` checks `src/math/**` only; `vitest.config.js` is separate from `vite.config.js`
- New scripts: `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run check`
- Tests cover typing, normalization, context validation, printing, proof steps, serialization round-trip, and the diagram adapter (including level I-4 and a move-invariance check)

## 2026-03-13 — v0.5: World Select, More Levels, Completion Persistence

### World / Level Select Screen
- Created `src/game/WorldSelect.jsx` — the game's home screen showing all 8 worlds as expandable rows
- Each world row shows name, Aluffi reference, and level completion count
- Level tiles show id, title, Aluffi ref, and completion badge (○ pending / ✓ complete)
- Worlds 2–8 are locked/grayed out; only World 1 is playable
- "← Back to Editor" button returns to the diagram editor
- Styled consistently with existing dark theme (#050812 bg, JetBrains Mono, blues/teals)

### Three-Mode App Structure
- App now supports three top-level modes: `editor` | `game-select` | `game-play`
- Header mode switcher toggles between "editor" and "game" (game shows world select)
- Selecting a level from WorldSelect launches GameMode with that level
- "← Levels" button in GameMode title bar returns to world select
- Files touched: `src/App.jsx`

### More World 1 Levels
- **I-1: "What is a Function?"** — given sets A, B; goal: draw a morphism f: A → B
- **I-3: "Identity Morphism"** — given object A; goal: draw id_A as a self-loop
- **I-4: "Commutative Square"** — given A, B, C, D with f, g, h, k; goal: mark the square commutative
- Each level includes goals, proof log, hints, Lean 4 stub, and awards card
- Files touched: `src/game/levels/world1-sets.js`

### World Stubs
- Added world entries 2–8 to `src/game/levels/index.js` (Categories, Morphisms & Functors, Universal Properties, Groups, Free Groups, Subgroups, Quotient Groups)
- All stub worlds have empty level arrays and show "Coming soon" in WorldSelect

### Completion Persistence
- Created `src/game/completion.js` — `getCompletedLevels()` / `markLevelComplete(id)` using localStorage key `catgame_completed`
- Completion overlay "Continue →" button now returns to WorldSelect (with a "Stay" option)
- GameMode persists completion to localStorage when level goals are all verified
- WorldSelect reads localStorage to show completion badges and counts
- Files touched: `src/game/GameMode.jsx`, `src/game/completion.js`

### GameMode Updates
- GameMode now accepts `levelId` and `onBackToSelect` props (no longer hardcoded to I-2)
- Added "← Levels" navigation button in level title bar
- Files touched: `src/game/GameMode.jsx`

## 2026-03-12 — v0.4: Level Loader, Game Canvas, Locked Elements

### Level System
- Created `src/game/levels/index.js` — exports `LEVELS` (keyed by id) and `WORLDS` array
- Created `src/game/levels/world1-sets.js` — level I-2 "Composition" with given nodes A, B, C and morphisms f, g
- Level definitions include givens, proof log data, goals, hints, and aluffiRef

### Level Loader
- Created `src/game/LevelLoader.jsx` — `useLevelState(levelId)` hook
- Merges locked given elements with player-drawn elements
- Given nodes/edges get `locked: true` flag, player-drawn ones are normal

### Locked Elements (Node.jsx, Edge.jsx)
- Nodes and edges accept a `locked` prop
- Locked nodes: muted stroke (#2d4a7a), muted fill, no drag/hover, 70% opacity
- Locked edges: muted color (#1e3a5a), no click/select, 70% opacity
- Added locked marker defs (tip-locked, hook-locked, tip-nat-locked) to defs.jsx
- Keyboard delete skips locked elements
- Editor mode is unaffected — `locked` prop is simply not passed

### Game Mode Canvas
- GameMode.jsx now renders a full interactive SVG canvas (reuses Edge/Node components)
- Level title bar shows world name, level title, and Aluffi reference
- Stripped-down toolbar (Select/Add/Draw modes only)
- "? Hint" button reveals the first hint below the canvas
- Player can draw new objects and morphisms on top of the locked givens
- Player can use locked nodes as edge endpoints but cannot move/delete them

### ProofLog Component
- ProofLog.jsx now accepts `given`, `inventory`, and `steps` props
- Given section shows items with labels and descriptions
- Steps show status icons: ○ pending (#3d5a8a), ✓ verified (#6ee7b7), ✗ rejected (#ef4444)
- Inventory section shows cards or "No cards yet" placeholder
- Files touched: `src/game/ProofLog.jsx`

## 2026-03-12 — v0.3: Panel Restructuring, Game Mode Stub

### Panel Restructuring
- ObjectPanel (left) and MorphismPanel (right) are now independently collapsible
- Collapsed state shows a 28px vertical tab strip with panel name and arrow indicator
- Click the tab or the arrow in the header to toggle collapse/expand
- CSS transition on width (200ms ease) for smooth animation
- `panelState` tracked in Editor: `{ left: 'open' | 'collapsed', right: 'open' | 'collapsed' }`
- Files touched: `src/ObjectPanel.jsx`, `src/MorphismPanel.jsx`, `src/App.jsx`

### Game Mode Stub
- Replaced placeholder with `GameMode` component rendering a two-panel layout
- Left side: canvas area with level title bar ("World 1 · Level 1 — What is a function?")
- Right side: `ProofLog` stub panel (320px) with three sections: Given, Inventory, Steps
- Files touched: `src/game/GameMode.jsx` (new), `src/game/ProofLog.jsx` (new), `src/App.jsx`

### Spec Update
- Updated project spec with full game mode design (Aluffi Chapters I–II curriculum, construction cards, Lean integration, level definitions, validation engine)
- Files touched: `catdiagram-project.md`

## 2026-03-12 — v0.2: Undo/Redo, Alignment Tools, Common Constructions Library

### Undo / Redo
- Added full undo/redo support via `Ctrl+Z` / `Ctrl+Shift+Z`
- Snapshot-based history stack capped at 50 entries
- Coalesces rapid state changes (e.g. dragging) into single snapshots via microtask batching
- Toolbar buttons for undo/redo added alongside keyboard shortcuts
- Files touched: `src/App.jsx`

### Alignment Tools
- When 2+ objects are selected, an alignment toolbar appears above the canvas
- Align left, center, right (horizontal) and top, middle, bottom (vertical)
- Distribute horizontally and vertically for 3+ selected objects
- Files touched: `src/AlignToolbar.jsx` (new), `src/App.jsx`

### Common Constructions Library
- New "⊕ Insert" dropdown in the toolbar with 10 categorical templates:
  - Product (A×B with projections π₁, π₂)
  - Coproduct (A⊔B with injections i₁, i₂)
  - Pullback square
  - Pushout square
  - Quotient map (A →↠ A/~)
  - Kernel/Cokernel chain (ker f →↪ A → B →↠ coker f)
  - Adjunction (F ⊣ G with curved arrows)
  - Exact sequence (A →↪ B →↠ C)
  - Identity morphism (self-loop id_A)
  - Commutative square (pre-marked commutative)
- Each template inserts centered in the viewport with proper LaTeX labels and correct morphism types
- Inserted elements are auto-selected for immediate repositioning
- Files touched: `src/constructions.js` (new), `src/App.jsx`

### Spec Update
- Added "Common Constructions Library" section to Phase 1 in the project spec
- Files touched: `catdiagram-project.md`

### Code Quality
- Wrapped delete operations in batch() to produce single undo snapshots
- Wrapped paste and load operations in batch() for clean undo behavior
- Updated status bar text to mention Ctrl+Z
- Fixed snap toggle shortcut to not trigger when Ctrl is held (conflict with Ctrl+S)
