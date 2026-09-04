// The diagram the editor opens with, in the legacy visual shape
// (imported through fromLegacyDiagram at startup).
export const DEFAULT_NODES = [
  { id: 'A', label: 'A', x: 200, y: 240 },
  { id: 'B', label: 'B', x: 540, y: 240 },
  { id: 'C', label: 'C', x: 370, y: 460 },
];

export const DEFAULT_EDGES = [
  { id: 'f1', label: 'f',           src: 'A', tgt: 'B', type: 'morphism', curve: 0 },
  { id: 'f2', label: 'g',           src: 'B', tgt: 'C', type: 'morphism', curve: 0 },
  { id: 'f3', label: 'g \\circ f', src: 'A', tgt: 'C', type: 'morphism', curve: -60 },
];
