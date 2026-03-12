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

**Panel restructuring** *(prerequisite for game mode)*
- The current layout has ObjectPanel fixed on the left and MorphismPanel fixed on the right
- Both panels should become toggleable: small tab buttons on the canvas edge collapse/expand each panel
- When game mode is active, both side panels collapse by default and the right side is occupied by the Proof Log
- A `sidebarMode` state per side: `open | collapsed`
- This makes room for the two-panel game interface: diagram canvas left, proof log right

**Multi-select and clipboard** *(added v0.1.1)*
- Shift-click to add objects/morphisms to selection
- Click-drag on empty canvas to draw a selection box
- `Ctrl+C` / `Ctrl+V` to copy and paste selected subdiagrams
- `Ctrl+A` to select all
- Move multiple selected nodes together

**TikZ-CD export** *(added v0.1.1)*
- Button in toolbar copies valid TikZ-CD LaTeX to clipboard
- Automatically computes grid positions from canvas coordinates

**Save / Load**
- Serialize the entire diagram state to JSON
- Save to a local file, load from file

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

**Structure**
- A notebook is a `.cat` file (JSON) containing a list of pages
- Each page has a name, a diagram canvas, and a Markdown notes pane
- Pages shown in a sidebar, reorderable, renameable, duplicatable

**Notes pane**
- Markdown editor with live preview
- KaTeX rendering inline

**Export**
- Obsidian-compatible Markdown (diagrams as inline SVG or TikZ-CD code blocks)
- PDF, LaTeX document, HTML

---

### Phase 3 — Game Mode

#### Overview

Game mode is a guided proof construction environment built on top of the same canvas and rendering engine as the editor. The player constructs mathematical objects by drawing diagrams, and the game validates their work both structurally (does the diagram commute?) and logically (is the justification valid?).

The game follows **Aluffi, Algebra: Chapter 0**, Chapters I and II, as its primary curriculum. It is not a complete treatment of the book but a complement to it — the player should be reading the book alongside playing, and the game reinforces the constructions and proofs by making the player enact them.

The game is not a quiz. It does not ask multiple-choice questions about definitions. It asks the player to **build things** — place objects, draw morphisms, invoke universal properties, and justify each step — in the same way a mathematician would construct a proof on paper, except the diagram is live and the logic is checked.

---

#### The Two-Panel Interface

The game interface has two panels:

**Left: Diagram canvas**
- The same SVG canvas as the editor, but in a restricted mode
- Some objects and morphisms are pre-placed as "givens" (rendered in a muted color, not moveable or deleteable)
- The player draws in the missing pieces in the interactive region
- The canvas may have locked regions (e.g. a given diagram) and a free region (where the player constructs)

**Right: Proof Log**
- A structured, growing log of the proof so far
- Divided into three sections: **Given**, **Inventory**, **Steps**
- As the player draws each morphism, a new step appears in the log
- The player must attach a **justification** to each step by selecting from a dropdown of available reasons (their current inventory of proven constructions and axioms)
- The game validates that the justification is applicable given the current state

Example proof log state mid-level:

```
GIVEN
─────────────────────────────────
G  : Group
X  : Set
ι  : X → |G|   (set map, inclusion)

INVENTORY
─────────────────────────────────
[✓] FREE GROUP         F(X), η: X → F(X)
[✓] IMAGE SUBGROUP     im(φ) ≤ G

STEPS
─────────────────────────────────
1. η : X → F(X)
   by: Universal property of free groups (given)

2. φ : F(X) → G
   by: UP of free groups applied to ι
   ✓ diagram check: φ ∘ η = ι

3. im(φ) ≤ G
   by: Image of group homomorphism is a subgroup
   [draw the inclusion im(φ) ↪ G to continue]

4. [?] im(φ) contains X
   [not yet justified]
```

When the player draws an arrow that matches a pending step, it checks off. If the justification is wrong (e.g. player claims a morphism exists by a universal property but the conditions aren't met), the step is flagged in red with an explanation.

---

#### The Inventory / Construction Card System

Constructions are not re-proved in every level. Once a player completes a level proving a universal property or constructing an object, they receive a **construction card** that can be invoked in future levels.

Each card specifies:
- What is given (inputs)
- What is produced (outputs: objects and morphisms)
- The key property (usually a universal property stated as a diagram condition)
- The Lean term it generates when invoked

Example card:

```
┌─────────────────────────────────────────┐
│  FREE GROUP                             │
│  Aluffi II §5                           │
├─────────────────────────────────────────┤
│  Given:   set X                         │
│  Gives:   group F(X)                    │
│           map η : X → |F(X)|            │
│  Property: for any group G and          │
│  set map f : X → |G|, there exists      │
│  a unique group hom φ : F(X) → G        │
│  such that φ ∘ η = f                    │
├─────────────────────────────────────────┤
│  Lean: FreeGroup.lift                   │
└─────────────────────────────────────────┘
```

When the player invokes a card in a level, it:
1. Places the guaranteed objects and morphisms on the canvas (or prompts the player to place them)
2. Adds the corresponding step to the proof log with the card as justification
3. Emits the correct Lean term into the generated proof stub

This models exactly how Aluffi uses previously proven constructions — as black boxes whose universal properties are invoked without re-proof.

---

#### Lean Integration

Every level generates a Lean 4 / Mathlib proof stub in real time as the player works. This stub is displayed at the bottom of the proof log and updates as steps are completed.

**Architecture:**

```
diagram state + proof log justifications
            ↓
     [Lean term generator]
            ↓
     lean4 stub (.lean text)
            ↓
  lean4web WASM runtime (embedded)
  OR lean4web API (POST to server)
            ↓
  proof state / diagnostics
            ↓
  displayed in proof log panel
```

The lean4web project (live.lean-lang.org, open source) runs Lean 4 + Mathlib in the browser via WebAssembly or as a server. The hard engineering of running Lean is already solved. What we build is the **term generator**: the mapping from diagram state and player justifications to correct Lean 4 / Mathlib syntax.

**Why this matters pedagogically:**
Lean's type errors *are* the feedback. If the player invokes the wrong universal property, or draws a morphism in the wrong direction, Lean tells them exactly why the term doesn't typecheck. This is more precise than any game-authored error message. The player learns to read type errors as mathematical statements.

**Mathlib APIs used by the term generator (Chapters I-II content):**

```lean
-- Free group and its UP
FreeGroup.lift : (X → G) → (FreeGroup X →* G)
FreeGroup.lift_eq_iff  -- uniqueness

-- Subgroup generated by a set
Subgroup.closure : Set G → Subgroup G
Subgroup.closure_le   -- minimality

-- Image of a homomorphism
MonoidHom.range : (G →* H) → Subgroup H
-- or equivalently:
Set.range : (α → β) → Set β

-- Quotient group and its UP
QuotientGroup.mk : G →* G ⧸ N
QuotientGroup.lift : N ≤ f.ker → (G ⧸ N →* H)

-- First isomorphism theorem
QuotientGroup.quotientKerEquivRange : G ⧸ f.ker ≃* f.range

-- Products
Prod.mk, Prod.fst, Prod.snd
-- UP: MonoidHom.prod

-- Initial/terminal objects (in Set/Grp)
-- These are handled via PUnit and the unique morphism to it
```

The term generator is a function `diagramState × proofLog → string` that produces a valid `.lean` file. Each construction card has an associated term template. When the player invokes the free group card with input `X` and output `φ : F(X) → G` justified by `ι : X → G`, the generator emits:

```lean
def φ : FreeGroup X →* G := FreeGroup.lift (fun x => ι x)
```

**Integration options (in order of complexity):**
1. **Generate stub only, no runtime**: Display the Lean file, let player copy it into lean4web or a local Lean install. Zero engineering overhead, still pedagogically useful.
2. **lean4web API**: POST the stub to `https://live.lean-lang.org/api/lean` (or self-hosted instance), render the response. One day of work once the term generator is built.
3. **Embedded WASM**: Bundle the lean4web WASM runtime locally. Fully offline, no server. More complex setup but matches the project's local-first philosophy.

Start with option 1, ship option 2, eventually reach option 3.

---

#### Level Structure: Chapters I and II

Levels are grouped into **worlds** matching Aluffi's chapters and sections. Completing all levels in a world unlocks the next. Construction cards earned in one world are available as inventory in all subsequent worlds.

---

**WORLD 1 — Sets and Functions** (Aluffi I §1-2)

*I-1: What is a function?*
Given: two finite sets A = {1,2,3}, B = {a,b}. Draw any function f: A → B.
Validates: every element of A has exactly one arrow out.
Lean: `fun : Fin 3 → Fin 2`
Card earned: none (introductory)

*I-2: Composition*
Given: f: A → B, g: B → C (drawn as givens). Draw g∘f: A → C.
Validates: the triangle commutes (g∘f agrees with going via B).
Lean: `g ∘ f`
Card earned: **COMPOSITION**

*I-3: Mono and epi in Set*
Two sub-levels: (a) draw an injective function, verify it is mono; (b) draw a surjective function, verify it is epi.
Lean: `Function.Injective`, `Function.Surjective`
Cards earned: **MONOMORPHISM**, **EPIMORPHISM**

*I-4: Canonical decomposition*
Given: f: A → B. Construct the canonical decomposition A → im(f) ↪ B.
Validates: the composition of the two drawn morphisms equals f; left arrow is epi; right is mono.
Lean: `Set.rangeFactorization`, `Subtype.val`
Card earned: **CANONICAL DECOMPOSITION**

---

**WORLD 2 — Categories** (Aluffi I §3-4)

*II-1: Verify a category*
Given: three objects and some morphisms. Player must add identity morphisms and check associativity holds for the given composition table (shown as a small grid).
Lean: `CategoryTheory.Category`
Card earned: **CATEGORY**

*II-2: Isomorphism*
Given: f: A → B. Draw g: B → A such that g∘f = id_A and f∘g = id_B.
Validates: both triangles commute.
Lean: `CategoryTheory.Iso`
Card earned: **ISOMORPHISM**

*II-3: Mono and epi in a general category*
Player is shown the categorical definitions (not the set-theoretic ones) and must verify them for a specific small category drawn out.
Card earned: updates **MONOMORPHISM** and **EPIMORPHISM** cards to categorical versions

---

**WORLD 3 — Universal Properties** (Aluffi I §5)

*III-1: Initial object*
Given: a small finite category. Player must identify the initial object by drawing exactly one morphism from it to every other object. Game checks uniqueness by asking: if you drew a *different* morphism to object X, does the diagram still work? (It shouldn't — uniqueness.)
Card earned: **INITIAL OBJECT**

*III-2: Terminal object*
Same structure, reversed direction.
Card earned: **TERMINAL OBJECT**

*III-3: The quotient universal property* (Aluffi I §5.3)
Given: a set A and an equivalence relation ~. Construct the quotient A/~ and the projection π: A → A/~.
Then: given any set B and function f: A → B compatible with ~, draw the unique f̄: A/~ → B making the triangle commute.
Validates: f̄ ∘ π = f; uniqueness check.
Lean: `Quotient.lift`
Card earned: **QUOTIENT (SET)**

*III-4: Product*
Given: sets A, B. Construct A×B with projections π₁: A×B → A and π₂: A×B → B.
Then: given test object Z and maps f: Z→A, g: Z→B, draw the unique ⟨f,g⟩: Z→A×B.
Validates: both projection triangles commute.
Lean: `Prod.mk`, `Prod.fst`, `Prod.snd`
Card earned: **PRODUCT**

*III-5: Coproduct*
Dual of III-4.
Lean: `Sum.inl`, `Sum.inr`, `Sum.elim`
Card earned: **COPRODUCT**

---

**WORLD 4 — Groups** (Aluffi II §1-4)

*IV-1: Verify a group*
Given: a multiplication table for a small set. Player must identify and draw: the identity morphism (id loop), inverses (for each element), and verify associativity is satisfied. The canvas shows the group as a one-object category.
Lean: `Group`
Card earned: **GROUP**

*IV-2: Group homomorphism*
Given: groups G and H (shown as one-object categories with labeled morphisms). Draw a functor F: G → H. The game checks F preserves multiplication.
Lean: `MonoidHom`
Card earned: **GROUP HOMOMORPHISM**

*IV-3: Kernel*
Given: φ: G → H. Construct ker(φ) as a subgroup of G. Draw the inclusion ker(φ) ↪ G.
Validates: everything in ker(φ) maps to e_H under φ.
Lean: `MonoidHom.ker`
Card earned: **KERNEL**

*IV-4: Isomorphism theorem preview*
Given: φ: G → H injective. Show φ is mono in Grp by the categorical definition.
Connects cards: **GROUP HOMOMORPHISM** + **MONOMORPHISM**

---

**WORLD 5 — Free Groups** (Aluffi II §5)

*V-1: Motivation — why do we need free groups?*
Narrative level. Player is shown a set X = {a, b} and asked: can you build a group that contains X with no relations other than what group axioms force? The game guides the player to see that words in a, b, a⁻¹, b⁻¹ form such a group.

*V-2: The universal property of F(X)*
Given: set X, group G, set map f: X → |G|.
Construct: F(X), η: X → |F(X)|, and the unique φ: F(X) → G with φ∘η = f.
Validates: the triangle commutes; φ is a group homomorphism; uniqueness (game gives a second candidate ψ and asks whether ψ = φ — it must be).
Lean: `FreeGroup.lift`, `FreeGroup.lift_eq_iff`
Card earned: **FREE GROUP**

*V-3: Free abelian groups*
Same structure but for the abelian case.
Lean: `FreeAbelianGroup.lift`
Card earned: **FREE ABELIAN GROUP**

---

**WORLD 6 — Subgroups** (Aluffi II §6)

*VI-1: Subgroup definition*
Given: group G and a subset H. Player must verify H is a subgroup by checking (in the diagram): identity is in H, H is closed under multiplication (draw the multiplication morphism landing in H), and H is closed under inverses.
Card earned: **SUBGROUP**

*VI-2: Kernel and image as subgroups*
Given: φ: G → H. Use cards **KERNEL** and the new IMAGE card to construct ker(φ) ≤ G and im(φ) ≤ H.
Lean: `MonoidHom.ker`, `MonoidHom.range`
Card earned: **IMAGE SUBGROUP**

*VI-3: Subgroup generated by a subset — THE KEY PROOF*
This is the proof that motivated the whole game. It is the culmination of World 6.

Given: group G, subset X ⊆ |G|, inclusion ι: X → |G|.
Task: construct the smallest subgroup of G containing X, written ⟨X⟩.

The player must:
1. Invoke **FREE GROUP** card with input X → produce F(X) and η: X → |F(X)|
2. Note ι: X → |G| is a set map → invoke **FREE GROUP** UP to produce unique φ: F(X) → G with φ∘η = ι
3. Invoke **IMAGE SUBGROUP** to construct im(φ) ≤ G
4. In the proof log, justify: im(φ) contains X (because for x∈X, ι(x) = φ(η(x)) ∈ im(φ))
5. Draw the minimality argument: for any subgroup K ≤ G with X ⊆ K, draw the chain F(X) →^φ_K K ↪ G and show it factors through im(φ), hence im(φ) ≤ K

The generated Lean:
```lean
-- Smallest subgroup containing X
def generated (G : Type*) [Group G] (X : Set G) : Subgroup G :=
  (FreeGroup.lift (fun x : X => (x : G))).range

-- Equivalence with Subgroup.closure
theorem generated_eq_closure : generated G X = Subgroup.closure X := by
  ext g
  simp [generated, MonoidHom.mem_range, Subgroup.mem_closure_iff]
  -- player's diagram chase becomes this proof
```

Card earned: **SUBGROUP GENERATED BY SUBSET** (= Subgroup.closure)

---

**WORLD 7 — Quotient Groups** (Aluffi II §7-8)

*VII-1: Normal subgroups*
Given: group G and subgroup N. Player must verify N is normal by drawing the conjugation diagram: for all g∈G, the morphism n ↦ gng⁻¹ maps N → N.
Card earned: **NORMAL SUBGROUP**

*VII-2: Quotient group construction*
Given: G and normal N ⊴ G. Construct G/N and projection π: G → G/N.
Verify: π is a group homomorphism; ker(π) = N.
Lean: `QuotientGroup.mk`, `QuotientGroup.ker_mk`
Card earned: **QUOTIENT GROUP**

*VII-3: Universal property of quotients*
Given: G, N ⊴ G, group H, homomorphism φ: G → H with N ≤ ker(φ).
Draw the unique φ̄: G/N → H making the diagram commute.
Validates: φ̄ ∘ π = φ; φ̄ is a group homomorphism.
Lean: `QuotientGroup.lift`
Updates card: **QUOTIENT GROUP** (adds UP to the card)

*VII-4: kernel ↔ normal (Aluffi II §7.6)*
Two sub-levels: (a) given φ: G → H, show ker(φ) ⊴ G; (b) given N ⊴ G, construct π: G → G/N and show N = ker(π).
Lean: `QuotientGroup.ker_mk`, `MonoidHom.ker_normalSubgroup`

*VII-5: First isomorphism theorem*
Given: φ: G → H. Using **QUOTIENT GROUP** UP and **CANONICAL DECOMPOSITION**, construct the isomorphism G/ker(φ) ≅ im(φ).
This is the boss level of World 7.
Lean: `QuotientGroup.quotientKerEquivRange`
Card earned: **FIRST ISOMORPHISM THEOREM**

---

**WORLD 8 — The Category Grp** (Aluffi II §3, §8-10)

*VIII-1: Products in Grp*
Invoke **PRODUCT** card in the category Grp. Verify the product G×H with projections satisfies the UP.

*VIII-2: Epimorphisms and cokernels*
Given: φ: G → H epi. Construct coker(φ) = H/im(φ). Show that epi ↔ surjective in Grp (contrast with Ring later).

*VIII-3: Group objects in categories* (Aluffi II §10)
Meta-level: player is shown that a group is a category with one object where all morphisms are invertible. They draw Z/3Z as such a one-object category and verify it satisfies the group axioms categorically.
This level explicitly connects World 4 back to World 2, reinforcing the categorical viewpoint.

---

#### Level Definition Format (for Claude Code to implement)

Each level is a JavaScript/TypeScript object:

```js
{
  id: 'VI-3',
  world: 6,
  title: 'Subgroup generated by a subset',
  aluffiRef: 'II §6.3',

  // Pre-placed objects and morphisms (locked, shown in muted color)
  givens: {
    nodes: [
      { id: 'G', label: 'G', x: 400, y: 200, type: 'group' },
      { id: 'X', label: 'X', x: 200, y: 200, type: 'set' },
    ],
    edges: [
      { id: 'iota', label: '\\iota', src: 'X', tgt: 'G', type: 'mono',
        note: 'inclusion of X into |G|' },
    ],
  },

  // What the player needs to produce (used for validation)
  goals: [
    {
      type: 'construct_object',
      id: 'FX', label: 'F(X)',
      justification: 'FREE_GROUP',
    },
    {
      type: 'construct_morphism',
      src: 'X', tgt: 'FX', label: '\\eta',
      justification: 'FREE_GROUP',
    },
    {
      type: 'construct_morphism',
      src: 'FX', tgt: 'G', label: '\\varphi',
      justification: 'FREE_GROUP_UP',
      commutativity: [['varphi', 'eta'], ['iota']], // φ∘η = ι
    },
    {
      type: 'construct_object',
      id: 'imPhi', label: '\\mathrm{im}(\\varphi)',
      justification: 'IMAGE_SUBGROUP',
    },
    {
      type: 'construct_morphism',
      src: 'imPhi', tgt: 'G', label: '',
      type: 'mono',
      justification: 'IMAGE_SUBGROUP',
      note: 'subgroup inclusion',
    },
    {
      type: 'proof_log_step',
      claim: 'im(φ) contains X',
      justification_options: ['COMPOSITION', 'FREE_GROUP_UP'],
      correct: 'FREE_GROUP_UP',
    },
  ],

  // Inventory cards available in this level
  availableCards: ['FREE_GROUP', 'IMAGE_SUBGROUP', 'SUBGROUP', 'COMPOSITION'],

  // Card awarded on completion
  awardsCard: 'SUBGROUP_GENERATED',

  // Lean stub template (filled in by term generator)
  leanContext: `
import Mathlib.GroupTheory.FreeGroup.Basic
import Mathlib.GroupTheory.Subgroup.Basic

variable {G : Type*} [Group G] (X : Set G) (ι : X → G)
  `,

  // Hint sequence (revealed progressively)
  hints: [
    'You have a set map ι: X → |G|. Which card lets you turn a set map into a group homomorphism?',
    'Invoke the FREE GROUP card with X as input. This gives you F(X) and η: X → |F(X)|.',
    'Now apply the universal property: ι is a set map X → |G|, so you get a unique φ: F(X) → G.',
    'The image of φ is a subgroup of G (use IMAGE SUBGROUP card). Can you show X ⊆ im(φ)?',
    'For minimality: any subgroup K containing X must receive a homomorphism from F(X) via the UP. So im(φ) ≤ K.',
  ],
}
```

---

#### Validation Engine

The game needs a validation layer that checks:

1. **Diagram commutativity**: given the player's drawn edges, do the specified paths agree? This uses the existing `findAllPaths` from `geometry.js` and checks composition equality. For finite groups this can be checked concretely; for general groups it checks symbolically via the proof log.

2. **Justification validity**: when the player claims an arrow exists "by the universal property of F(X)", the engine checks that the preconditions are satisfied — specifically that the source set map has been established in the proof log.

3. **Uniqueness**: for universal properties, the engine can present a "uniqueness challenge" — it places a second candidate morphism and asks the player to show the two must be equal. This is done by having the player draw the equality in the proof log.

4. **Lean typecheck** (via lean4web): the generated stub is sent to the Lean runtime. A green checkmark means all terms typecheck. Red diagnostics show exactly which step failed and why.

---

#### Technical Architecture for Game Mode

New files to create:

```
src/game/
├── GameMode.jsx          # Top-level game component, replaces GamePlaceholder
├── GameCanvas.jsx        # Editor canvas in restricted/guided mode
├── ProofLog.jsx          # Right panel: Given / Inventory / Steps
├── InventoryCard.jsx     # Individual construction card display
├── LevelLoader.jsx       # Loads level definition, manages level state
├── ValidationEngine.js   # Checks diagram goals, justifications
├── LeanGenerator.js      # diagram state + proof log → Lean 4 stub
├── lean4web.js           # API wrapper for lean4web server/WASM
├── levels/
    ├── index.js          # Level registry and world structure
    ├── world1-sets.js
    ├── world2-categories.js
    ├── world3-universal.js
    ├── world4-groups.js
    ├── world5-free-groups.js
    ├── world6-subgroups.js
    ├── world7-quotients.js
    └── world8-grp.js

src/
├── cards/
│   └── cards.js          # Construction card definitions and Lean templates
```

**State shape for game mode:**

```js
{
  currentLevel: 'VI-3',
  inventory: ['FREE_GROUP', 'IMAGE_SUBGROUP', 'SUBGROUP', 'COMPOSITION', ...],
  proofLog: {
    given: [...],       // from level definition
    steps: [
      {
        id: 's1',
        description: 'η : X → F(X)',
        justification: 'FREE_GROUP',
        diagramElementId: 'eta',
        status: 'verified',  // 'pending' | 'verified' | 'rejected'
        leanTerm: 'FreeGroup.of',
      },
      ...
    ],
  },
  leanStub: '-- generated lean code...',
  leanDiagnostics: [],  // from lean4web response
  goals: [...],         // remaining unmet goals from level definition
  hintsRevealed: 0,
}
```

---

#### Design Principles for the Game

1. **Drawing is reasoning.** Every arrow the player draws must be justified. There are no decorative arrows.

2. **Inventory grows monotonically.** You never lose a construction card. The game is cumulative, not competitive.

3. **The proof log is the output.** At the end of a level, the player has produced a valid proof artifact — both a diagram and a Lean stub — that they can save and reference.

4. **Hints cite the book.** Every hint links to a specific section of Aluffi. The game is a companion to the book, not a replacement.

5. **Lean errors are not failures.** When the Lean stub doesn't typecheck, the game presents the error as a clue, not a red X. The student learns to read type errors as mathematical information.

6. **Each world ends with a theorem.** World 5 ends with the free group UP; World 6 ends with the subgroup generation proof; World 7 ends with the first isomorphism theorem. These are the payoffs that justify the preceding levels.

---

### Phase 4 — Extended Content (Chapters III-IV and beyond)

Once Chapters I-II are complete, natural extensions following Aluffi:

- **World 9 — Rings**: category Ring, ring homomorphisms, ideals, quotient rings, first isomorphism theorem for rings (Aluffi III §1-3)
- **World 10 — Modules**: R-Mod, submodules, free modules (Aluffi III §5-6)
- **World 11 — Exact sequences and the Snake Lemma**: complexes, exactness, the snake lemma as a boss level (Aluffi III §7)
- **World 12 — Groups II**: Sylow theorems, semidirect products (Aluffi IV)
- **World 13 — Functors and natural transformations**: formally introduces these now that the player has many examples (Aluffi VIII §1)

The snake lemma and five lemma are natural "boss fights" — large diagram chasing proofs where the player must track many parallel paths and invoke many previously earned cards.

---

## Technical Architecture (overall)

```
catdiagram/
├── src/
│   ├── App.jsx              # Main app shell, routing between modes
│   ├── Canvas.jsx           # SVG canvas, interaction logic (shared by editor and game)
│   ├── Edge.jsx             # Morphism rendering
│   ├── Node.jsx             # Object rendering
│   ├── geometry.js          # Bezier math, path finding, grid
│   ├── defs.jsx             # SVG arrowhead/marker definitions
│   ├── export.js            # SVG export, TikZ-CD export
│   ├── styles.js            # Shared styles
│   ├── panels/
│   │   ├── ObjectPanel.jsx  # Toggleable left panel
│   │   ├── MorphismPanel.jsx # Toggleable right panel
│   │   └── CommChecker.jsx
│   ├── game/
│   │   ├── GameMode.jsx
│   │   ├── GameCanvas.jsx
│   │   ├── ProofLog.jsx
│   │   ├── InventoryCard.jsx
│   │   ├── LevelLoader.jsx
│   │   ├── ValidationEngine.js
│   │   ├── LeanGenerator.js
│   │   ├── lean4web.js
│   │   └── levels/
│   ├── cards/
│   │   └── cards.js
│   ├── notebook/
│   │   ├── Notebook.jsx
│   │   ├── Page.jsx
│   │   ├── NotesPane.jsx
│   │   └── serializer.js
│   └── lean/
│       └── generator.js     # Standalone Lean generation (editor mode)
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
- `remark` + `remark-math` + `rehype-katex` (Markdown with math)
- lean4web WASM runtime or API client

---

## Comparison to Existing Tools

| Tool | Visual | Math-aware | Lean | Notebook | Game/Pedagogy | Export |
|------|--------|------------|------|----------|----------------|--------|
| TikZ-CD | ✗ | ✓ | ✗ | ✗ | ✗ | TeX |
| Quiver (q.uiver.app) | ✓ | partial | ✗ | ✗ | ✗ | TikZ-CD |
| draw.io | ✓ | ✗ | ✗ | ✗ | ✗ | SVG/PNG |
| Obsidian | ✗ | partial | ✗ | ✓ | ✗ | MD |
| **Categorical** | ✓ | ✓ | ✓ | ✓ | ✓ | all of the above |

---

*Last updated: March 2026*
*Game mode design informed by Aluffi, Algebra: Chapter 0 (AMS GSM Vol. 104)*
