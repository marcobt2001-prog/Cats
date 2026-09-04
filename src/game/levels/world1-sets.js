export const WORLD1_LEVELS = [
  {
    id: 'I-1',
    world: 1,
    worldName: 'Sets and Functions',
    title: 'What is a Function?',
    aluffiRef: 'I §1.1',

    givens: {
      nodes: [
        { id: 'A', label: 'A', x: 220, y: 300 },
        { id: 'B', label: 'B', x: 560, y: 300 },
      ],
      edges: [],
    },

    proofLog: {
      given: [
        { label: 'A', description: 'a set' },
        { label: 'B', description: 'a set' },
      ],
      inventory: [],
    },

    goals: [
      {
        id: 'g1',
        type: 'morphism',
        source: 'A',
        target: 'B',
        description: 'Draw a morphism f : A \\to B',
      },
    ],

    awardsCard: 'MORPHISM',

    leanStub: `import Mathlib.CategoryTheory.Category.Basic

variable {C : Type*} [Category C] {A B : C}

-- A morphism from A to B
variable (f : A ⟶ B)`,

    hints: [
      'Use "→ Draw" mode: click A, then click B to create a morphism.',
    ],
  },

  {
    id: 'I-2',
    world: 1,
    worldName: 'Sets and Functions',
    title: 'Composition',
    aluffiRef: 'I §2.3',

    givens: {
      nodes: [
        { id: 'A', label: 'A', x: 200, y: 240 },
        { id: 'B', label: 'B', x: 540, y: 240 },
        { id: 'C', label: 'C', x: 370, y: 460 },
      ],
      edges: [
        { id: 'f', label: 'f', src: 'A', tgt: 'B', type: 'morphism', curve: 0, commutative: false },
        { id: 'g', label: 'g', src: 'B', tgt: 'C', type: 'morphism', curve: 0, commutative: false },
      ],
    },

    proofLog: {
      given: [
        { label: 'f : A \\to B', description: 'given' },
        { label: 'g : B \\to C', description: 'given' },
      ],
      inventory: [],
    },

    goals: [
      {
        id: 'g1',
        type: 'morphism',
        source: 'A',
        target: 'C',
        description: 'Draw a morphism A \\to C',
      },
      {
        id: 'g2',
        type: 'morphism',
        source: 'A',
        target: 'C',
        equals: 'g \\circ f',
        description: 'Make it the composite g \\circ f',
        dependsOn: 'g1',
      },
    ],

    awardsCard: 'COMPOSITION',

    leanStub: `import Mathlib.CategoryTheory.Category.Basic

variable {C : Type*} [Category C] {A B D : C}
variable (f : A ⟶ B) (g : B ⟶ D)

-- Composition
def gf : A ⟶ D := g ∘ f

-- Commutativity: the triangle commutes by definition
example : g ∘ f = gf f g := rfl`,

    hints: [
      'Draw A → C, then select it and type the label "g \\circ f". ' +
      'Or leave it unnamed and mark the pair A → C in "∘ Commutes" to assert that both routes are equal.',
    ],
  },

  {
    id: 'I-3',
    world: 1,
    worldName: 'Sets and Functions',
    title: 'Identity Morphism',
    aluffiRef: 'I §2.1',

    givens: {
      nodes: [
        { id: 'A', label: 'A', x: 400, y: 300 },
      ],
      edges: [],
    },

    proofLog: {
      given: [
        { label: 'A', description: 'an object' },
      ],
      inventory: [],
    },

    goals: [
      {
        id: 'g1',
        type: 'morphism',
        source: 'A',
        target: 'A',
        equals: '\\mathrm{id}_A',
        description: 'Draw and label \\mathrm{id}_A : A \\to A',
      },
    ],

    awardsCard: 'IDENTITY',

    leanStub: `import Mathlib.CategoryTheory.Category.Basic

variable {C : Type*} [Category C] {A : C}

-- The identity morphism
def idA : A ⟶ A := 𝟙 A

-- id composed with any morphism is that morphism
example {B : C} (f : A ⟶ B) : 𝟙 A ≫ f = f := Category.id_comp f`,

    hints: [
      'A self-loop: in "→ Draw" mode click A, then click A again. ' +
      'Then select it and label it "\\mathrm{id}_A" (id_A and 1_A also work) so it really is the identity.',
    ],
  },

  {
    id: 'I-4',
    world: 1,
    worldName: 'Sets and Functions',
    title: 'Commutative Square',
    aluffiRef: 'I §2.5',

    givens: {
      nodes: [
        { id: 'A', label: 'A', x: 200, y: 200 },
        { id: 'B', label: 'B', x: 540, y: 200 },
        { id: 'C', label: 'C', x: 200, y: 460 },
        { id: 'D', label: 'D', x: 540, y: 460 },
      ],
      edges: [
        { id: 'f', label: 'f', src: 'A', tgt: 'B', type: 'morphism', curve: 0, commutative: false },
        { id: 'g', label: 'g', src: 'A', tgt: 'C', type: 'morphism', curve: 0, commutative: false },
        { id: 'h', label: 'h', src: 'B', tgt: 'D', type: 'morphism', curve: 0, commutative: false },
        { id: 'k', label: 'k', src: 'C', tgt: 'D', type: 'morphism', curve: 0, commutative: false },
      ],
    },

    proofLog: {
      given: [
        { label: 'f : A \\to B', description: 'given' },
        { label: 'g : A \\to C', description: 'given' },
        { label: 'h : B \\to D', description: 'given' },
        { label: 'k : C \\to D', description: 'given' },
      ],
      inventory: [],
    },

    goals: [
      {
        id: 'g1',
        type: 'eq',
        prop: 'h \\circ f = k \\circ g',
        description: 'Assert that the square commutes: h \\circ f = k \\circ g',
      },
    ],

    awardsCard: 'COMMUTATIVE DIAGRAM',

    leanStub: `import Mathlib.CategoryTheory.Category.Basic
import Mathlib.CategoryTheory.CommSq

variable {C : Type*} [Category C] {A B D E : C}
variable (f : A ⟶ B) (g : A ⟶ D) (h : B ⟶ E) (k : D ⟶ E)

-- The square commutes: h ∘ f = k ∘ g
example (sq : CommSq f g h k) : f ≫ h = g ≫ k := sq.w`,

    hints: [
      'Open "∘ Commutes", find the pair A → D, and click "mark" to assert that both paths around the square are equal.',
    ],
  },
];
