# CATS — Detailed Development Plan

## Visual Interactive Theorem Proving with Lean

### Project Vision

Cats is a visual interactive theorem-proving environment specialized for mathematics in which categorical structures and relationships are naturally represented by diagrams.

The long-term goal is:

> **A theorem prover where mathematical structures and categorical reasoning are manipulated visually, with Lean providing formal verification underneath.**

Cats is NOT intended to:

- replace Lean;
- reimplement all of mathematics;
- require every proof to be graphical;
- prevent users from writing ordinary mathematical/Lean expressions;
- merely be a diagram editor that exports pictures;
- hardcode every mathematical theorem into the application.

Instead, Cats should provide a graphical mathematical interface to Lean and Mathlib.

The fundamental workflow should eventually be:

```text
Human mathematical reasoning
        ↓
Cats visual interaction
        ↓
Cats mathematical representation
        ↓
Lean expression / proposition / proof
        ↓
Lean + Mathlib
        ↓
Formal verification
        ↓
Verified result returned to Cats
```

---

# 1. Core Architectural Principle

Cats should have three conceptual layers.

```text
┌─────────────────────────────────────────────┐
│                 CATS UI                     │
│                                             │
│  Nodes • Arrows • Diagrams • Cards         │
│  Goals • Proof Log • Notebook • Menus      │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│          CATS MATHEMATICAL LAYER            │
│                                             │
│  Terms • Objects • Morphisms • Expressions │
│  Goals • Claims • Context • Proof Steps    │
│  Constructions • Diagrammatic Assertions   │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│              LEAN / MATHLIB                 │
│                                             │
│ Definitions • Structures • Theorems        │
│ Universal Properties • Proof Checking      │
│ Formal Mathematical Foundation             │
└─────────────────────────────────────────────┘
```

The Cats mathematical layer is an **interface/intermediate representation**, not a second mathematical universe.

For example, Cats should not implement its own complete definition of a group merely because the user creates a group.

Instead, it should be able to represent something corresponding to a Lean context such as:

```lean
G : Type
[Group G]
```

and allow the user to interact with that object visually.

Lean/Mathlib remains authoritative for what a group, product, quotient, homomorphism, isomorphism, etc. actually means.

---

# 2. First Priority: Inspect the Existing Repository

Before modifying code:

1. Inspect the entire existing repository.
2. Identify the current React/TypeScript architecture.
3. Identify:
   - components;
   - state management;
   - diagram representation;
   - node representation;
   - morphism representation;
   - commutativity checker;
   - construction cards;
   - proof log;
   - Lean-related code;
   - existing tests.
4. Run the existing application.
5. Run the existing test suite, if present.
6. Establish a baseline before making changes.

Do NOT throw away existing functionality simply to implement the new architecture.

Refactor where necessary, but preserve useful existing work.

Create a short architectural assessment before making major structural changes.

---

# 3. The Central Mathematical Data Model

The most important architectural requirement is to separate:

### Mathematical semantics

from

### Visual presentation.

A node's screen position is not part of its mathematical meaning.

For example:

```text
A --f--> B
|        |
g        h
v        v
C --k--> D
```

should be represented mathematically as something like:

```text
Objects:
    A
    B
    C
    D

Morphisms:
    f : A → B
    g : A → C
    h : B → D
    k : C → D

Assertion:
    h ∘ f = k ∘ g
```

The coordinates of A, B, C, D belong to the UI layer.

The morphisms and equality belong to the mathematical layer.

---

# 4. Proposed Mathematical IR

Introduce a clean internal representation for mathematical interaction.

The exact TypeScript names can be decided after inspecting the repository, but conceptually the system should support entities such as:

```typescript
MathematicalContext
MathematicalObject
MathematicalMorphism
MathematicalExpression
MathematicalEquality
MathematicalProposition
ProofGoal
ProofStep
Construction
LeanReference
```

A possible conceptual structure is:

```typescript
interface MathematicalObject {
    id: string
    name: string
    leanType?: LeanExpression
    leanTerm?: LeanExpression
}

interface MathematicalMorphism {
    id: string
    name: string
    source: ObjectReference
    target: ObjectReference
    leanTerm?: LeanExpression
}

interface MorphismExpression {
    kind:
        | "morphism"
        | "composition"
        | "identity"
        | "inverse"
        | "application"
        | "custom"

    ...
}

interface EqualityAssertion {
    left: MathematicalExpression
    right: MathematicalExpression
}

interface ProofGoal {
    id: string
    proposition: MathematicalProposition
    status: "open" | "proved" | "failed"
}

interface ProofStep {
    id: string
    kind: string
    inputs: string[]
    outputs: string[]
    generatedLean?: string
}
```

This is illustrative, not prescriptive.

The important requirement is that the model can represent mathematical meaning independently of the React canvas.

---

# 5. Lean References Must Be First-Class

Cats should not assume that every mathematical object has to be defined inside Cats.

A mathematical entity may instead be a reference to something that already exists in Lean/Mathlib.

For example:

```text
G
```

might correspond to a Lean type.

A morphism might correspond to:

```lean
f : G →* H
```

A categorical morphism might correspond to a suitable Mathlib categorical term.

The Cats model should therefore support:

```text
Cats entity
    ↓
Lean reference
```

rather than:

```text
Cats entity
    ↓
Cats reimplementation of mathematics
```

This is essential for scalability.

---

# 6. Mathematical Context

Cats must eventually allow users to establish mathematical context before proving things.

For example:

```text
Let G be a group.
Let H be a group.
Let f : G → H be a group homomorphism.
Assume f is an isomorphism.
```

The UI might eventually show:

```text
CONTEXT

Objects
────────────────────
G    Group
H    Group

Morphisms
────────────────────
f : G → H
    GroupHom

Assumptions
────────────────────
f is an isomorphism
```

Internally this should correspond to a Lean context.

The user should not have to manually define the complete mathematical structure of a group.

Cats should reference Lean/Mathlib's existing definitions and typeclasses.

---

# 7. Two Modes

Cats should eventually support two major modes.

## Mode A — Notebook

The notebook is an open mathematical environment.

The user can:

- define objects;
- define mathematical structures;
- define morphisms;
- introduce hypotheses;
- construct objects;
- state arbitrary claims;
- create proof goals;
- prove claims;
- save results;
- revisit previous work.

The notebook should NOT require the claim to already exist in a predefined database.

A user should be able to invent:

```text
Let A be ...
Let B be ...
Suppose ...
Prove ...
```

and work from there.

The notebook should ultimately make it possible for a mathematician to reconstruct mathematical developments themselves.

In particular, the user should eventually be able to work through a book such as Aluffi's *Algebra: Chapter 0* from beginning to end using the notebook.

---

## Mode B — Problem Solver

The Problem Solver supplies a predefined mathematical problem.

For example:

```text
Problem 5.4

Prove:
A × B ≅ B × A
```

The context and goal can be preloaded.

The user constructs the proof.

The application can track:

```text
Goal
↓
Proof steps
↓
Subgoals
↓
Verified proof
```

The same underlying proof engine should power both modes.

The difference should primarily be the UX and how the initial context/goals are supplied.

---

# 8. The First Vertical Slice

Do NOT begin by implementing groups, rings, fields, Galois theory, topology, etc.

The first real milestone should be a tiny but complete end-to-end proof.

The recommended first target is a simple categorical identity involving objects, morphisms, composition, identity, and commutativity.

The complete pipeline must work:

```text
Create mathematical objects
        ↓
Create morphisms
        ↓
Draw diagram
        ↓
Interpret diagram semantically
        ↓
Create mathematical proposition
        ↓
Generate Lean expression
        ↓
Run Lean
        ↓
Receive result
        ↓
Display verified proof in Cats
```

This is much more important than having a large number of UI features.

---

# 9. Problem 5.4 as a Major Prototype

The first substantial benchmark should be the product/isomorphism problem discussed in the design process.

Conceptually:

```text
A × B
B × A
```

The user constructs the product objects and their projections.

For example:

```text
πA : A × B → A
πB : A × B → B
```

and:

```text
π'B : B × A → B
π'A : B × A → A
```

The user then constructs:

```text
f : A × B → B × A
```

using the universal property of the product.

The user should be able to express the defining requirements diagrammatically:

```text
π'B ∘ f = πB

π'A ∘ f = πA
```

Cats should recognize these as mathematical equations, not merely as visual connections.

Then the user constructs:

```text
g : B × A → A × B
```

and proves:

```text
g ∘ f = id
```

and:

```text
f ∘ g = id
```

The proof should make use of the product's universal property rather than requiring Cats to calculate elements of the product.

---

# 10. Equality Should Be Semantic

The commutativity engine must eventually be redesigned/extended so that it does NOT primarily ask:

> "Does the drawing look like a commutative diagram?"

Instead, it should ask:

> "What equality of morphism expressions does this diagram assert?"

For example:

```text
A --f--> B --g--> C
|h              ^
v               |
D -----k--------C
```

represents an equality such as:

```text
g ∘ f = k ∘ h
```

The exact composition convention must be consistent with the Lean/Mathlib representation.

The diagram therefore becomes a graphical interface for constructing a proposition.

---

# 11. Proof Goals

Cats needs a concept of a mathematical goal.

For example:

```text
GOAL

g ∘ f = id(A × B)
```

The UI should make the goal visible.

The user can then apply mathematical reasoning operations.

For example:

```text
Apply product uniqueness
```

could transform:

```text
g ∘ f = id
```

into:

```text
πA ∘ g ∘ f = πA
πB ∘ g ∘ f = πB
```

These are subgoals.

The user works on each subgoal.

Once both are established, Cats reconstructs the original proof.

This is an important design pattern:

```text
Mathematical theorem/reasoning principle
              ↓
        Goal transformation
              ↓
           Subgoals
```

---

# 12. Construction Cards

Construction cards should become a core part of the mathematical UX.

They are NOT intended to be a database of every mathematical proof.

They are human-friendly interfaces to mathematical constructions, theorems, and reasoning patterns available through Lean/Mathlib.

Examples:

### Product

```text
PRODUCT

Input:
    A
    B

Creates:
    P
    πA : P → A
    πB : P → B

Universal Property:
    Given f : X → A
          g : X → B

    construct unique u : X → P

    satisfying:
        πA ∘ u = f
        πB ∘ u = g
```

### Quotient

```text
QUOTIENT

Input:
    A
    equivalence relation ~

Creates:
    A/~ 
    q : A → A/~

Provides:
    quotient universal property
```

### Product Uniqueness

```text
PRODUCT UNIQUENESS

Given:
    f,g : X → A × B

Goal:
    f = g

Reduces goal to:
    πA ∘ f = πA ∘ g
    πB ∘ f = πB ∘ g
```

### Induced Map Through Quotient

```text
INDUCED QUOTIENT MAP

Given:
    q : A → A/~
    f : A → B

Need:
    proof that f respects ~

Produces:
    f̄ : A/~ → B

with:
    f̄ ∘ q = f
```

The underlying mathematics must still come from Lean/Mathlib wherever possible.

---

# 13. Problem 5.11 as the Second Major Prototype

The quotient problem provides a second important benchmark.

The system should eventually support reasoning involving:

```text
A
B
A/~A
B/~B
A × B
(A × B)/~
```

The user should be able to define the relevant equivalence relations and construct the quotient.

Then they should be able to construct maps such as:

```text
(A × B)/~ → A/~A
```

and:

```text
(A × B)/~ → B/~B
```

using induced maps / quotient universal properties.

The important point is that Cats should support the reasoning pattern:

```text
Define map before quotient
        ↓
Prove it respects equivalence relation
        ↓
Invoke quotient universal property
        ↓
Obtain induced map
        ↓
Work with induced map diagrammatically
```

This is a much more powerful test of Cats than simply checking whether arrows commute.

---

# 14. Universal Properties Should Be a First-Class Concept

Universal properties are one of the places where Cats can provide a genuinely different mathematical interaction model.

The system should eventually recognize concepts such as:

- products;
- coproducts;
- equalizers;
- coequalizers;
- pullbacks;
- pushouts;
- limits;
- colimits;
- quotients;
- free constructions;
- kernels;
- cokernels;
- other universal constructions formalized in Mathlib.

However, do NOT attempt to implement all of these initially.

Build a generic abstraction that allows a construction to specify:

```text
Inputs
Outputs
Canonical morphisms
Universal property
Existence
Uniqueness
Lean implementation
```

Then individual constructions can be added incrementally.

---

# 15. Lean Integration

Initially, prioritize a simple local Lean integration rather than browser/WASM integration.

A reasonable initial architecture is:

```text
Cats frontend
      ↓
Cats mathematical IR
      ↓
Lean generator
      ↓
.lean file / Lean process
      ↓
Lean compiler/checker
      ↓
stdout / stderr / result
      ↓
Cats
```

Do NOT make Lean WASM the first technical challenge.

First prove that Cats can successfully generate and verify actual Lean mathematics.

Later, investigate:

- persistent Lean processes;
- faster incremental checking;
- Lean server protocols;
- browser/WASM;
- richer error information;
- direct syntax/AST interaction.

---

# 16. Lean Generation

Avoid relying exclusively on fragile string concatenation.

The architecture should leave room for structured Lean syntax generation.

For every mathematical operation, Cats should ideally be able to produce:

```text
Lean expression
```

and/or:

```text
Lean proposition
```

and eventually:

```text
Lean proof term
```

For example, a Cats goal:

```text
g ∘ f = id
```

should eventually correspond to an actual Lean proposition.

A proof step such as:

```text
Apply product uniqueness
```

should correspond to an appropriate Lean theorem/application/tactic/proof term.

The exact Lean implementation should be determined by inspecting current Mathlib APIs rather than invented abstractions.

---

# 17. Lean Must Be the Authority

Cats should never mark a proof as mathematically verified merely because its internal diagram checker thinks it is correct.

There are two different concepts:

```text
Cats reasoning state
```

and:

```text
Lean verification state
```

Cats can say:

```text
This diagram represents:
g ∘ f = h
```

But only Lean should ultimately say:

```text
✓ Proven
```

This distinction is essential.

---

# 18. Hybrid Graphical + Textual Proofs

Cats must NOT force everything into diagrams.

There will be mathematical arguments where diagrams are excellent and others where they are terrible.

Graphical interaction should be emphasized for:

- objects;
- morphisms;
- composition;
- commutative diagrams;
- universal properties;
- products;
- coproducts;
- pullbacks;
- pushouts;
- functors;
- natural transformations;
- exact sequences;
- categorical constructions.

Textual/Lean interaction should remain available for:

- induction;
- case analysis;
- arbitrary logical arguments;
- calculations;
- inequalities;
- analytic proofs;
- complicated propositions;
- situations where no useful diagrammatic representation exists.

A single proof should be able to alternate between the two.

For example:

```text
Graphical step
      ↓
Graphical step
      ↓
Lean/textual step
      ↓
Graphical step
      ↓
Graphical step
      ↓
Verified proof
```

This hybrid model is fundamental to the project.

---

# 19. Infinite and Complicated Structures

Cats must reason symbolically.

It should NOT attempt to enumerate the elements of mathematical structures.

For example, if:

```text
G : Group
```

then G may be finite or infinite.

The user interacts with:

```text
G
f : G → H
```

rather than with a list of every element of G.

This is another reason Lean/Mathlib should provide the mathematical foundation.

Cats represents the mathematical entities and their relationships; Lean handles the underlying formal mathematics.

---

# 20. Extensibility

The project should be designed so that new mathematical domains can eventually be added without modifying the entire core.

Potential future packages might conceptually include:

```text
Cats.CategoryTheory
Cats.HomologicalAlgebra
Cats.GaloisTheory
Cats.Topology
Cats.Algebra
Cats.LinearAlgebra
...
```

A package could provide:

- visual representations;
- construction cards;
- theorem interfaces;
- diagram templates;
- mappings to Lean/Mathlib APIs;
- specialized proof interactions.

The core Cats engine should remain generic.

This is how Cats can eventually support mathematics that the original developer does not personally know in detail.

If Lean/Mathlib already formalizes the mathematics, Cats should ideally be able to interact with it without Cats reimplementing the mathematics.

---

# 21. Long-Term Goal: Broad Mathematical Coverage

The ambition is for Cats to eventually interact with essentially any mathematical theory that:

1. has been formalized in Lean/Mathlib;
2. contains structures/relationships that can be meaningfully exposed through the Cats interface.

Do NOT claim that Lean/Mathlib already formalizes all known mathematics.

The architecture should instead make this possible:

```text
New mathematics formalized in Lean
              ↓
      Existing Lean definitions
              ↓
        Cats can reference them
              ↓
 Optional visual interface/card
              ↓
      Visual interaction
              ↓
       Lean verification
```

The Cats core should therefore not contain a giant hardcoded list of mathematical theories.

---

# 22. Saved Proofs

The notebook should eventually allow the user to save:

```text
Mathematical context
+
Goal
+
Diagram state
+
Proof steps
+
Lean representation
+
Verification result
```

A saved proof should be reproducible.

Ideally, reopening a proof should allow Cats to reconstruct the visual proof state and re-run Lean verification.

Do not make the diagram image the canonical saved artifact.

The mathematical/proof representation should be canonical.

The visual layout should be presentation state.

---

# 23. Problem Solver / Aluffi Architecture

Eventually, problems can be represented as:

```text
Problem
├── title
├── context
├── assumptions
├── goal
├── hints
├── available constructions
└── optional reference solution
```

For example:

```text
Problem 5.4
    Context:
        A
        B

    Available:
        Product

    Goal:
        A × B ≅ B × A
```

The reference solution should NOT be required for Cats to verify the user's solution.

A user should be able to discover a different valid proof.

The system should verify the actual proof, not compare it against a hardcoded solution.

---

# 24. HCI Philosophy

The goal is not merely to make mathematics "look pretty."

The UI should investigate whether mathematical diagram manipulation can become a genuine proof-construction interface.

Important questions for later user testing:

- Is dragging an arrow more intuitive than typing a morphism?
- How should a user invoke a universal property?
- How should the application communicate that a construction is available?
- How does a user know what information is missing?
- How should failed proof attempts be explained?
- How should Lean errors be translated into useful mathematical feedback?
- When should Cats show a card?
- When should Cats ask the user to type something?
- How much mathematical notation should be visible?
- How should complicated diagrams be navigated?

Do not attempt to solve all HCI questions immediately.

Build a coherent first prototype and use it to discover the answers.

---

# 25. Development Phases

## Phase 0 — Repository and Architecture Audit

Tasks:

- inspect existing repository;
- run application;
- run tests;
- document current architecture;
- identify reusable components;
- identify technical debt;
- identify existing diagram model;
- identify existing Lean functionality.

Deliverable:

```text
ARCHITECTURE.md
```

containing the current-state assessment and proposed target architecture.

Do not rewrite the application yet.

---

## Phase 1 — Mathematical Core

Implement the minimum mathematical representation for:

- objects;
- morphisms;
- identities;
- composition;
- expressions;
- equality assertions;
- mathematical context;
- proof goals;
- proof steps.

Example:

```text
A
B
C

f : A → B
g : B → C

Goal:
g ∘ f = h
```

The model must be independent of React rendering.

Add serialization/deserialization tests.

---

## Phase 2 — Separate Diagram State from Mathematical State

Ensure the application has a clean distinction between:

### Mathematical state

```text
A
B
f : A → B
```

and:

### Visual state

```text
A = (x:100,y:200)
B = (x:400,y:200)
f = curved/straight/etc.
```

Moving A around the screen must NOT change the mathematics.

Changing an arrow's visual curvature must NOT change the mathematical morphism.

This separation is mandatory.

---

## Phase 3 — Semantic Diagram Interpretation

Implement a system that converts diagrams into mathematical expressions.

For a path:

```text
A --f--> B --g--> C
```

produce:

```text
g ∘ f
```

For two paths from A to C:

```text
A → B → C
A → D → C
```

produce an equality:

```text
g ∘ f = k ∘ h
```

The commutativity checker should use this semantic representation.

---

## Phase 4 — Lean Proof-of-Concept

Create a minimal Lean integration.

The system should:

1. create a Lean context;
2. generate a proposition;
3. generate or invoke a proof;
4. run Lean;
5. parse success/failure;
6. return the result to Cats.

Start with extremely simple propositions.

For example:

```lean
example (A B : Type) (f : A → B) :
    f = f := by
  rfl
```

Then move to categorical composition and identities.

Do not attempt universal properties yet.

The purpose of this phase is to establish the complete Cats → Lean → Cats loop.

---

## Phase 5 — Mathematical Context + Lean References

Implement the ability to represent things such as:

```text
A : Type
B : Type

f : A → B
```

and eventually structured contexts such as:

```text
G : Type
[Group G]

H : Type
[Group H]
```

The important feature is that Cats can reference existing Lean types/terms rather than implementing them itself.

---

## Phase 6 — Product Construction

Implement the first serious construction card:

```text
Product
```

Support:

- product object;
- projections;
- universal property;
- induced morphism;
- uniqueness principle.

The card should create genuine mathematical state.

Do not implement a fake visual-only product.

---

## Phase 7 — Problem 5.4 Vertical Slice

Make Problem 5.4 the first end-to-end major benchmark.

The user should be able to:

1. Create A and B.
2. Construct A × B.
3. Construct B × A.
4. View projections.
5. Construct the morphism (f).
6. Construct the morphism (g).
7. State the identity-composition goals.
8. Apply product uniqueness.
9. Solve the resulting subgoals.
10. Generate Lean proof.
11. Have Lean verify the result.
12. Display the proof as verified in Cats.

This should be considered a major milestone.

---

## Phase 8 — Quotient Construction

Implement the conceptual framework needed for:

- equivalence relations;
- quotient objects;
- quotient maps;
- well-definedness;
- induced maps;
- quotient universal properties.

Do not attempt to support every possible quotient construction initially.

---

## Phase 9 — Problem 5.11 Vertical Slice

Use the quotient problem as the second major benchmark.

The user should be able to:

1. Define A and B.
2. Define the equivalence relations.
3. Construct A × B.
4. Construct the relevant product equivalence relation.
5. Construct the quotient.
6. Define the underlying map.
7. prove compatibility/well-definedness.
8. invoke the quotient universal property.
9. construct the induced map.
10. manipulate the resulting diagram.
11. verify the proof with Lean.

This will test whether Cats can handle a significantly more sophisticated construction pattern than basic commutativity.

---

# 26. Phase 10 — Generic Construction Framework

Once Product and Quotient work, abstract the common pattern.

A construction should conceptually contain:

```typescript
interface ConstructionDefinition {
    id: string
    name: string

    inputs: ...
    outputs: ...

    canonicalMorphisms: ...

    conditions: ...

    universalProperty?: ...

    leanReferences: ...

    goalTransformations?: ...
}
```

This should allow future constructions to be added without rewriting the proof engine.

---

# 27. Phase 11 — Proof State UI

Build a proper proof-state interface.

Example:

```text
┌──────────────────────────────────────────────┐
│ GOAL                                         │
│                                              │
│ g ∘ f = id(A × B)                            │
└──────────────────────────────────────────────┘

                 ↓ Apply Product Uniqueness

┌──────────────────────────────────────────────┐
│ SUBGOALS                                     │
│                                              │
│ □ πA ∘ g ∘ f = πA                            │
│ □ πB ∘ g ∘ f = πB                            │
└──────────────────────────────────────────────┘
```

The diagram should update to correspond to the active goal.

The proof log should show:

```text
1. Construct A × B
2. Construct B × A
3. Construct f using Product
4. Construct g using Product
5. Goal: g ∘ f = id
6. Apply Product Uniqueness
7. Prove projection equality
8. Prove projection equality
9. ✓ Goal verified
```

---

# 28. Phase 12 — Hybrid Text/Diagram Interface

Introduce a way to insert a textual/Lean proof step into the graphical proof.

For example:

```text
[Diagram]
      ↓
[Apply universal property]
      ↓
[Lean step]
      ↓
[Diagram]
```

The user should never become trapped because a particular proof step is not diagrammatic.

---

# 29. Phase 13 — Notebook Mode

Build the open-ended notebook.

Features:

- create context;
- create definitions;
- create objects;
- create morphisms;
- create goals;
- construct diagrams;
- invoke constructions;
- use textual Lean;
- save proof;
- reload proof;
- verify proof.

The notebook should not require a preset problem.

---

# 30. Phase 14 — Problem Solver

Build the problem framework.

Initially create a few manually authored benchmark problems.

Do NOT build a huge database.

Use the framework to test:

- loading context;
- loading goal;
- restricting/allowing constructions;
- tracking progress;
- hints;
- proof verification.

---

# 31. Phase 15 — Expand Mathematical Coverage

Only after the core architecture is stable should additional mathematical areas be introduced.

Potential order:

```text
Basic Category Theory
        ↓
Products / Coproducts
        ↓
Equalizers / Coequalizers
        ↓
Pullbacks / Pushouts
        ↓
Isomorphisms
        ↓
Functors
        ↓
Natural Transformations
        ↓
Limits / Colimits
        ↓
Algebraic Structures
        ↓
Modules / Linear Algebra
        ↓
Homological Algebra
        ↓
Galois Theory
        ↓
More advanced mathematics
```

This is illustrative, not a requirement to follow exactly.

The important thing is that new mathematics should be added through the extensible architecture rather than hardcoded into the entire application.

---

# 32. Testing Strategy

Every mathematical feature should have tests at several levels.

### Mathematical model tests

Example:

```text
f : A → B
g : B → C

compose(f,g)
```

must produce the correct semantic expression.

### Diagram tests

Moving nodes should not change semantic meaning.

### Serialization tests

Save/load must preserve mathematical state.

### Lean generation tests

Given a mathematical IR, generated Lean must parse.

### Lean verification tests

Known-valid proofs must succeed.

Known-invalid proofs must fail.

### Integration tests

A complete interaction should work:

```text
UI
→ mathematical model
→ Lean
→ verification
→ UI
```

---

# 33. Error Handling

Lean errors should not simply be dumped into the UI.

Eventually Cats should distinguish:

```text
Syntax Error
Type Error
Unknown Object
Invalid Morphism
Composition Mismatch
Missing Hypothesis
Failed Universal Property Condition
Unproved Goal
Lean Verification Failure
```

For example, instead of:

```text
type mismatch
```

Cats might eventually explain:

```text
These morphisms cannot be composed.

The target of f is:
    B

but the source of g is:
    C

Expected:
    B = C
```

However, initially it is acceptable to expose raw Lean output alongside a basic Cats interpretation.

---

# 34. Do Not Build Yet

The following should explicitly NOT be first-phase goals:

- all of category theory;
- all of algebra;
- all of Aluffi;
- Galois theory;
- automated proving of arbitrary mathematics;
- a complete theorem database;
- browser-based Lean/WASM;
- AI-generated proofs;
- sophisticated collaborative features;
- polished HCI for every possible mathematical domain.

The first objective is proving that the core interaction model works.

---

# 35. Definition of Success for the First Prototype

The first major success criterion is NOT:

> "Cats has lots of mathematical features."

It is:

> **A user can construct a genuine mathematical proof by manipulating a diagram, Cats can translate the interaction into a formal Lean proof, and Lean can independently verify it.**

Specifically, the Problem 5.4 prototype should demonstrate:

```text
User
 │
 │ creates A, B
 ▼
Cats
 │
 │ constructs products
 ▼
Diagram
 │
 │ constructs morphisms using universal property
 ▼
Mathematical IR
 │
 │ creates equality goals
 ▼
Proof Engine
 │
 │ translates proof steps
 ▼
Lean
 │
 │ verifies
 ▼
Cats
 │
 ▼
✓ PROOF VERIFIED
```

Once this works, the project has demonstrated its fundamental thesis.

---

# 36. The Long-Term Vision

The ultimate Cats experience should feel less like:

> "I'm drawing a picture and then exporting it to Lean."

and more like:

> "I'm doing mathematics."

The user should be able to think in mathematical structures:

```text
Give me the product.
Construct the induced map.
Make this diagram commute.
Use the universal property.
These two morphisms should be equal.
Now prove the remaining statement in Lean.
```

Cats should turn those mathematical actions into formal proof construction.

Lean should remain underneath the entire system as the trusted formal foundation and verifier.

The resulting architecture should therefore be:

```text
                    MATHEMATICS
                         │
                         ▼
              ┌─────────────────────┐
              │        CATS         │
              │                     │
              │ Visual mathematics  │
              │ Diagram interaction │
              │ Construction cards  │
              │ Proof state         │
              │ Notebook             │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   CATS MATHEMATICAL │
              │        IR           │
              │                     │
              │ Terms               │
              │ Morphisms           │
              │ Expressions         │
              │ Goals               │
              │ Proof steps         │
              │ Lean references     │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    LEAN / MATHLIB   │
              │                     │
              │ Definitions         │
              │ Theorems            │
              │ Structures          │
              │ Universal properties│
              │ Proof verification  │
              └─────────────────────┘
```

## Final development principle

**Build the smallest complete version of this architecture first.**

Do not build a large diagram editor and postpone Lean.

Do not build a giant mathematical library inside Cats.

Do not build hundreds of construction cards before proving that one construction works end-to-end.

Instead:

> **Build one complete mathematical loop.**

Start with:

```text
Objects
    ↓
Morphisms
    ↓
Composition
    ↓
Equality
    ↓
Proof goal
    ↓
Lean
    ↓
Verification
```

Then:

```text
Product
    ↓
Universal property
    ↓
Induced morphism
    ↓
Uniqueness
    ↓
Problem 5.4
```

Then:

```text
Quotient
    ↓
Well-definedness
    ↓
Induced morphism
    ↓
Problem 5.11
```

If those two examples can be handled naturally, the architecture will have demonstrated that Cats is becoming what it is intended to be: **a visual interface for constructing real formal mathematics, rather than merely a diagram editor.**
