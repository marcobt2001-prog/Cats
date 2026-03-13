export const WORLD1_LEVELS = [
  {
    id: 'I-2',
    world: 1,
    worldName: 'Sets and Functions',
    title: 'Composition',
    aluffiRef: 'I \u00A72.3',

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
        type: 'draw_morphism',
        src: 'A',
        tgt: 'C',
        description: 'Draw g\\circ f : A \\to C',
      },
      {
        id: 'g2',
        type: 'mark_commutative',
        nodes: ['A', 'B', 'C'],
        description: 'Mark the triangle as commutative',
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
      'The composite of f followed by g goes directly from A to C.',
    ],
  },
];
