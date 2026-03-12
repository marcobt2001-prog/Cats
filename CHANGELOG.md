# Changelog

All notable changes to this project will be documented in this file.

<!-- New entries go here, newest first -->

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
