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
      steps: [
        { description: 'Draw g\\circ f : A \\to C', status: 'pending' },
        { description: 'Mark triangle as commutative', status: 'pending' },
      ],
    },

    goals: [
      {
        type: 'construct_morphism',
        src: 'A',
        tgt: 'C',
        label: 'g \\circ f',
        justification: 'COMPOSITION',
      },
      {
        type: 'mark_commutative',
        paths: [['f', 'g'], ['g \\circ f']],
      },
    ],

    awardsCard: 'COMPOSITION',

    hints: [
      'The composite of f followed by g goes directly from A to C.',
    ],
  },
];
