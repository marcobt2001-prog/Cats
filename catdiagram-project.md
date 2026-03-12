# Categorical — Project Specification

> A mathematically-aware, interactive diagram editor for category theory and homological algebra — built for studying, note-taking, and eventually proof-writing.

---

## Vision

Most mathematical software forces you to choose between two modes: write code (LaTeX, Lean, Coq) and get precision but no visual feedback, or draw visually (draw.io, Keynote) and get flexibility but no mathematical awareness. **Categorical** is an attempt to occupy the space between them — a tool where drawing a diagram *is* doing mathematics, not just illustrating it.

The core insight is that category theory is already deeply visual. A commutative diagram is a proof. A functor is a structure-preserving map you can literally draw. A natural transformation is a grid of commutative squares. These aren't metaphors — the diagrams are the mathematics. The tool should reflect that.

---

## Current State (v0.1)

The app is a local Vite + React application. It currently supports:

- Placing objects (nodes) on a canvas with LaTeX labels via KaTeX
- Drawing morphisms between objects with LaTeX labels
- Morphism types: morphism, mono, epi, iso, equivalence, dashed, dotted, natural transformation, exact
- Curve control via slider or drag handle on the control point
- Grid display and snap-to-grid
- Commutativity checker — finds all node pairs with multiple paths and lets you mark diagrams as commutative (highlighted in teal)
- Individual morphisms marked as commutative
- SVG export
- TikZ-CD export (copy LaTeX to clipboard)
- Multi-select via shift-click and drag-box
- Copy and paste selected subdiagrams
- Keyboard shortcuts: `1` select, `2` add object, `3` draw, `s` snap, `g` grid, `Del` delete, `Esc` cancel

---

## Roadmap

### Phase 1 — Core Quality of Life

These are improvements to the diagram editor itself, making it a solid standalone tool.

**Multi-select and clipboard** *(added v0.1.1)*
- Shift-click to add objects/morphisms to selection
- Click-drag on empty canvas to draw a selection box
- `Ctrl+C` / `Ctrl+V` to copy and paste selected subdiagrams (offsets pasted copy slightly)
- `Ctrl+A` to select all
- Move multiple selected nodes together

**TikZ-CD export** *(added v0.1.1)*
- Button in toolbar copies valid TikZ-CD LaTeX to clipboard
- Automatically computes grid positions from canvas coordinates
- Outputs morphism types as correct TikZ-CD arrow styles
- Usable directly in an Overleaf or LaTeX document

**Save / Load**
- Serialize the entire diagram state to JSON
- Save to a local file, load from file
- Auto-save to localStorage as a fallback
- This is the prerequisite for the notebook feature

**Undo / Redo**
- `Ctrl+Z` / `Ctrl+Shift+Z`
- Simple command stack — every mutation is reversible

**Alignment tools**
- Align selected objects horizontally or vertically
- Distribute evenly
- Auto-layout for common diagram shapes (triangle, square, chain/exact sequence)

**Common Constructions Library** *(added v0.2)*
- A toolbar button ("⊕ Insert") opens a dropdown listing common categorical structures
- Clicking a template inserts labeled objects and correctly-typed morphisms onto the canvas, centered in the current viewport
- All labels use proper LaTeX and are editable after insertion like any other object
- Templates included:
  - **Product** — objects A, B with product A×B and canonical projections π₁, π₂
  - **Coproduct** — objects A, B with coproduct A⊔B and injections i₁, i₂
  - **Pullback** — the standard pullback square P → A, P → B, A → C, B → C
  - **Pushout** — the standard pushout square A → B, A → C, B → P, C → P
  - **Quotient map** — object A with epimorphism q: A → A/~
  - **Kernel / Cokernel** — chain ker(f) →↪ A → B →↠ coker(f) with mono/epi types
  - **Adjunction** — categories C, D with curved functors F and G
  - **Exact sequence** — chain A →↪ B →↠ C with mono on first, epi on last
  - **Identity morphism** — self-loop on object A labeled id_A
  - **Commutative square** — four objects A, B, C, D with four morphisms pre-marked as commutative

**Exact sequence mode**
- Specialized layout: objects arranged in a horizontal line
- Arrows auto-typed as appropriate (mono on first, epi on last, etc.)
- Optionally marks the sequence as exact at each object

---

### Phase 2 — Notebook

The notebook is the container that makes everything else worth building. Without persistence, the tool is a scratch pad. With a notebook, it becomes a study environment.

**Structure**
- A notebook is a `.cat` file (JSON under the hood) containing a list of pages
- Each page has:
  - A name/title
  - A diagram canvas (objects + morphisms + commutativity markings)
  - A notes pane (rich text / Markdown)
  - An optional Lean pane (see Phase 3)
- Pages are shown in a sidebar, can be reordered, renamed, duplicated, deleted

**Notes pane**
- Markdown editor with live preview
- KaTeX rendering inline in the notes (so you can write $f: A \to B$ next to the diagram)
- Notes and diagram are visible simultaneously, side by side
- Resize the split

**Export to Obsidian / Markdown**
- Export a page or whole notebook as a `.md` file
- Diagrams embedded as SVG (inline in the markdown) or as TikZ-CD code blocks
- Obsidian-compatible: uses standard Markdown, wikilinks work
- Frontmatter with metadata (title, date, tags)
- A full notebook exports as a folder of `.md` files — one per page — which can be dropped directly into an Obsidian vault

**Export to other formats**
- PDF (via browser print or headless rendering)
- LaTeX document (diagrams as TikZ-CD, notes as prose)
- HTML (self-contained, shareable)

---

### Phase 3 — Lean Integration

Lean is a proof assistant with a deep mathematical library (Mathlib). The connection to category theory is not superficial — in Lean's type theory, a morphism `f : A ⟶ B` is literally a term of type `A ⟶ B` in a category. The Curry-Howard correspondence means proofs and programs are the same thing, and category theory makes this visually explicit.

The Lean pane is not meant to require Lean expertise. It is meant to be a window into the formal structure of what you're drawing.

**Lean pane (read-only generation)**
- For each diagram, auto-generate a Lean 4 / Mathlib skeleton
- Objects become type variables or objects in a category
- Morphisms become `f : A ⟶ B` declarations
- Commutativity assertions become `comm : g ∘ f = h` goals
- The output is a valid Lean file you could paste into an editor

**Example output for a commutative triangle:**
```lean
import Mathlib.CategoryTheory.Category.Basic

open CategoryTheory

variable {C : Type*} [Category C]
variable {A B D : C}
variable (f : A ⟶ B) (g : B ⟶ D) (h : A ⟶ D)

-- Commutativity assertion
example (comm : g ∘ f = h) : True := trivial
```

**Diagram verification (longer term)**
- Assert that a square commutes and check whether your labeling of compositions is internally consistent
- Flag contradictions: if you claim h = g∘f and also h = k where k ≠ g∘f, the tool notices
- This is a lightweight proof checker, much simpler than Lean itself but in the same spirit
- Essentially: maintain a set of equations between composable morphisms and run a simple congruence closure check

**Functor diagrams**
- Draw two diagrams (two categories) side by side
- Define a functor F: C → D by mapping objects and morphisms
- The tool draws the image of the source diagram inside the target
- Natural transformations: given F, G: C → D, a natural transformation η is displayed as vertical morphisms η_A: F(A) → G(A) for each object, with the naturality squares highlighted as commutative

---

### Phase 4 — Game Mode

A separate mode accessible from the main navigation. The idea is that mathematical reasoning in category theory can be framed as a puzzle: given some objects and morphisms, can you construct a new morphism? Does this diagram commute? What is the universal property here?

This is inspired by the observation that category theory proofs often feel like diagram chasing — a genuinely game-like activity where you follow arrows and see what you can reach.

**Game mode is currently a placeholder.** The design is open. Some directions:

- **Diagram completion puzzles** — given a partial diagram with some morphisms labeled and some slots empty, fill in the missing morphisms consistently
- **Diagram chasing** — given a commutative diagram with some elements marked, derive what you can (e.g. if this square commutes and f is mono, what follows?)
- **Universal property challenges** — given a cone or cocone, construct the unique morphism to/from the limit/colimit
- **Named theorems as levels** — the Five Lemma, Snake Lemma, Yoneda Lemma, each as a guided puzzle

The game mode would share the same canvas and rendering engine as the editor, with an additional layer for puzzle state, goals, and feedback.

---

## Technical Architecture

```
catdiagram/
├── src/
│   ├── App.jsx              # Main app shell, routing between modes
│   ├── editor/
│   │   ├── Canvas.jsx       # SVG canvas, interaction logic
│   │   ├── Edge.jsx         # Morphism rendering
│   │   ├── Node.jsx         # Object rendering
│   │   ├── geometry.js      # Bezier math, path finding, grid
│   │   ├── defs.jsx         # SVG arrowhead/marker definitions
│   │   └── export.js        # SVG export, TikZ-CD export
│   ├── panels/
│   │   ├── ObjectPanel.jsx
│   │   ├── MorphismPanel.jsx
│   │   └── CommChecker.jsx
│   ├── notebook/
│   │   ├── Notebook.jsx     # Page list sidebar
│   │   ├── Page.jsx         # Diagram + notes split view
│   │   ├── NotesPane.jsx    # Markdown editor
│   │   └── serializer.js    # JSON save/load, Obsidian export
│   ├── lean/
│   │   └── generator.js     # Lean 4 code generation from diagram state
│   ├── game/
│   │   └── GameMode.jsx     # Placeholder
│   └── styles.js
├── index.html
├── vite.config.js
└── package.json
```

**Dependencies (current)**
- React 18
- Vite
- KaTeX (LaTeX rendering)

**Dependencies (planned)**
- CodeMirror or Monaco (Lean / Markdown pane editing)
- `@codemirror/lang-markdown`
- `remark` + `remark-math` + `rehype-katex` (Markdown with math preview)

---

## Design Principles

1. **The diagram is the primary artifact.** Everything else (notes, Lean code, export) is derived from it.
2. **LaTeX everywhere.** Any label field accepts LaTeX math. The tool should feel like a mathematical environment, not a general-purpose app.
3. **No server required.** Everything runs locally. Notebooks are files on your filesystem, not in a cloud database.
4. **Progressive disclosure.** The basic editor is simple. Lean integration, game mode, functor diagrams — these are opt-in and don't clutter the default experience.
5. **Export to the ecosystem.** The tool should fit into how mathematicians already work: Obsidian for notes, Overleaf/LaTeX for papers, Lean for formalization. It exports to all of these, not replaces them.

---

## Comparison to Existing Tools

| Tool | Visual | Math-aware | Lean | Notebook | Export |
|------|--------|------------|------|----------|--------|
| TikZ-CD | ✗ | ✓ | ✗ | ✗ | TeX |
| Quiver (q.uiver.app) | ✓ | partial | ✗ | ✗ | TikZ-CD |
| draw.io | ✓ | ✗ | ✗ | ✗ | SVG/PNG |
| Obsidian | ✗ | partial | ✗ | ✓ | MD |
| **Categorical** | ✓ | ✓ | ✓ | ✓ | all of the above |

---

*Last updated: March 2026*
