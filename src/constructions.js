// Common constructions as pure data in the legacy visual shape, with local ids.
// Positions are relative; the editor centers the fragment in the viewport and
// mergeDiagram mints fresh ids, so templates never collide with the document.
// Commutativity is expressed with `commGroups` ("src|tgt" → edge ids), which
// becomes an equality hypothesis on insertion.

const n = (id, label, x, y) => ({ id, label, x, y });
const e = (id, label, src, tgt, type = 'morphism', curve = 0) => ({ id, label, src, tgt, type, curve });

export const CONSTRUCTIONS = [
  {
    name: 'Product',
    desc: 'A, B with A\\times B and projections \\pi_1, \\pi_2',
    symbol: '×',
    nodes: [n('A', 'A', 0, 0), n('B', 'B', 340, 0), n('P', 'A \\times B', 170, -160)],
    edges: [e('p1', '\\pi_1', 'P', 'A'), e('p2', '\\pi_2', 'P', 'B')],
  },
  {
    name: 'Coproduct',
    desc: 'A, B with A\\sqcup B and injections i_1, i_2',
    symbol: '⊔',
    nodes: [n('A', 'A', 0, 0), n('B', 'B', 340, 0), n('C', 'A \\sqcup B', 170, 160)],
    edges: [e('i1', 'i_1', 'A', 'C'), e('i2', 'i_2', 'B', 'C')],
  },
  {
    name: 'Pullback',
    desc: 'Pullback square with universal arrow',
    symbol: '⟕',
    nodes: [n('P', 'P', 0, 0), n('A', 'A', 240, 0), n('B', 'B', 0, 200), n('C', 'C', 240, 200)],
    edges: [e('p1', 'p_1', 'P', 'A'), e('p2', 'p_2', 'P', 'B'), e('f', 'f', 'A', 'C'), e('g', 'g', 'B', 'C')],
  },
  {
    name: 'Pushout',
    desc: 'Pushout square with universal arrow',
    symbol: '⟖',
    nodes: [n('A', 'A', 0, 0), n('B', 'B', 240, 0), n('C', 'C', 0, 200), n('P', 'P', 240, 200)],
    edges: [e('f', 'f', 'A', 'B'), e('g', 'g', 'A', 'C'), e('i1', 'i_1', 'B', 'P'), e('i2', 'i_2', 'C', 'P')],
  },
  {
    name: 'Quotient Map',
    desc: 'A \\to A/\\sim with canonical projection',
    symbol: 'A/~',
    nodes: [n('A', 'A', 0, 0), n('Q', 'A/\\!\\sim', 240, 0)],
    edges: [e('q', 'q', 'A', 'Q', 'epi')],
  },
  {
    name: 'Kernel / Cokernel',
    desc: '\\ker f \\to A \\to B \\to \\mathrm{coker}\\, f',
    symbol: 'ker/coker',
    nodes: [n('K', '\\ker f', 0, 0), n('A', 'A', 200, 0), n('B', 'B', 400, 0), n('C', '\\mathrm{coker}\\, f', 600, 0)],
    edges: [e('i', '\\iota', 'K', 'A', 'mono'), e('f', 'f', 'A', 'B'), e('p', '\\pi', 'B', 'C', 'epi')],
  },
  {
    name: 'Adjunction',
    desc: 'F \\dashv G with unit \\eta and counit \\varepsilon',
    symbol: '⊣',
    nodes: [n('C', '\\mathcal{C}', 0, 0), n('D', '\\mathcal{D}', 300, 0)],
    edges: [e('F', 'F', 'C', 'D', 'morphism', -50), e('G', 'G', 'D', 'C', 'morphism', -50)],
  },
  {
    name: 'Exact Sequence',
    desc: 'A \\to B \\to C with composition zero',
    symbol: '→→',
    nodes: [n('A', 'A', 0, 0), n('B', 'B', 200, 0), n('C', 'C', 400, 0)],
    edges: [e('f', 'f', 'A', 'B', 'mono'), e('g', 'g', 'B', 'C', 'epi')],
  },
  {
    name: 'Identity Morphism',
    desc: 'Self-loop \\mathrm{id}_A on an object',
    symbol: 'id',
    nodes: [n('A', 'A', 0, 0)],
    edges: [e('id', '\\mathrm{id}_A', 'A', 'A')],
  },
  {
    name: 'Commutative Square',
    desc: 'Four objects with four morphisms, marked commutative',
    symbol: '□',
    nodes: [n('A', 'A', 0, 0), n('B', 'B', 240, 0), n('C', 'C', 0, 200), n('D', 'D', 240, 200)],
    edges: [e('f', 'f', 'A', 'B'), e('g', 'g', 'A', 'C'), e('h', 'h', 'B', 'D'), e('k', 'k', 'C', 'D')],
    commGroups: { 'A|D': ['f', 'g', 'h', 'k'] },
  },
];
