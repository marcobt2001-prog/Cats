import { uid } from './geometry.js';

// Each template returns { nodes, edges } with relative positions.
// The caller offsets them to center in the viewport.

function n(label, x, y) { return { id: uid('obj'), label, x, y }; }
function e(label, src, tgt, type = 'morphism', curve = 0, commutative = false) {
  return { id: uid('e'), label, src, tgt, type, curve, commutative };
}

export const CONSTRUCTIONS = [
  {
    name: 'Product',
    desc: 'A, B with A\\times B and projections \\pi_1, \\pi_2',
    symbol: '\u00D7',
    build() {
      const A = n('A', 0, 0);
      const B = n('B', 340, 0);
      const P = n('A \\times B', 170, -160);
      return {
        nodes: [A, B, P],
        edges: [
          e('\\pi_1', P.id, A.id),
          e('\\pi_2', P.id, B.id),
        ],
      };
    },
  },
  {
    name: 'Coproduct',
    desc: 'A, B with A\\sqcup B and injections i_1, i_2',
    symbol: '\u2294',
    build() {
      const A = n('A', 0, 0);
      const B = n('B', 340, 0);
      const C = n('A \\sqcup B', 170, 160);
      return {
        nodes: [A, B, C],
        edges: [
          e('i_1', A.id, C.id),
          e('i_2', B.id, C.id),
        ],
      };
    },
  },
  {
    name: 'Pullback',
    desc: 'Pullback square with universal arrow',
    symbol: '\u27D5',
    build() {
      const P = n('P', 0, 0);
      const A = n('A', 240, 0);
      const B = n('B', 0, 200);
      const C = n('C', 240, 200);
      return {
        nodes: [P, A, B, C],
        edges: [
          e('p_1', P.id, A.id),
          e('p_2', P.id, B.id),
          e('f', A.id, C.id),
          e('g', B.id, C.id),
        ],
      };
    },
  },
  {
    name: 'Pushout',
    desc: 'Pushout square with universal arrow',
    symbol: '\u27D6',
    build() {
      const A = n('A', 0, 0);
      const B = n('B', 240, 0);
      const C = n('C', 0, 200);
      const P = n('P', 240, 200);
      return {
        nodes: [A, B, C, P],
        edges: [
          e('f', A.id, B.id),
          e('g', A.id, C.id),
          e('i_1', B.id, P.id),
          e('i_2', C.id, P.id),
        ],
      };
    },
  },
  {
    name: 'Quotient Map',
    desc: 'A \\to A/\\sim with canonical projection',
    symbol: 'A/~',
    build() {
      const A = n('A', 0, 0);
      const Q = n('A/\\!\\sim', 240, 0);
      return {
        nodes: [A, Q],
        edges: [
          e('q', A.id, Q.id, 'epi'),
        ],
      };
    },
  },
  {
    name: 'Kernel / Cokernel',
    desc: '\\ker f \\to A \\to B \\to \\mathrm{coker}\\, f',
    symbol: 'ker/coker',
    build() {
      const K = n('\\ker f', 0, 0);
      const A = n('A', 200, 0);
      const B = n('B', 400, 0);
      const C = n('\\mathrm{coker}\\, f', 600, 0);
      return {
        nodes: [K, A, B, C],
        edges: [
          e('\\iota', K.id, A.id, 'mono'),
          e('f', A.id, B.id),
          e('\\pi', B.id, C.id, 'epi'),
        ],
      };
    },
  },
  {
    name: 'Adjunction',
    desc: 'F \\dashv G with unit \\eta and counit \\varepsilon',
    symbol: '\u22A3',
    build() {
      const C = n('\\mathcal{C}', 0, 0);
      const D = n('\\mathcal{D}', 300, 0);
      return {
        nodes: [C, D],
        edges: [
          e('F', C.id, D.id, 'morphism', -50),
          e('G', D.id, C.id, 'morphism', -50),
        ],
      };
    },
  },
  {
    name: 'Exact Sequence',
    desc: 'A \\to B \\to C with composition zero',
    symbol: '\u2192\u2192',
    build() {
      const A = n('A', 0, 0);
      const B = n('B', 200, 0);
      const C = n('C', 400, 0);
      return {
        nodes: [A, B, C],
        edges: [
          e('f', A.id, B.id, 'mono'),
          e('g', B.id, C.id, 'epi'),
        ],
      };
    },
  },
  {
    name: 'Identity Morphism',
    desc: 'Self-loop \\mathrm{id}_A on an object',
    symbol: 'id',
    build() {
      const A = n('A', 0, 0);
      return {
        nodes: [A],
        edges: [
          e('\\mathrm{id}_A', A.id, A.id),
        ],
      };
    },
  },
  {
    name: 'Commutative Square',
    desc: 'Four objects with four morphisms, marked commutative',
    symbol: '\u25A1',
    build() {
      const A = n('A', 0, 0);
      const B = n('B', 240, 0);
      const C = n('C', 0, 200);
      const D = n('D', 240, 200);
      return {
        nodes: [A, B, C, D],
        edges: [
          e('f', A.id, B.id, 'morphism', 0, true),
          e('g', A.id, C.id, 'morphism', 0, true),
          e('h', B.id, D.id, 'morphism', 0, true),
          e('k', C.id, D.id, 'morphism', 0, true),
        ],
      };
    },
  },
];
