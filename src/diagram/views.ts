import { objectsOf, morphismsOf } from '../math/context.js';
import type { DiagramState, DiagramViews } from './types.js';
import { styleOf } from './state.js';

/** Projects the state onto the legacy `{nodes, edges}` shape the renderers consume. */
export function toViews(s: DiagramState): DiagramViews {
  const nodes = objectsOf(s.doc.context).map(o => {
    const l = s.layout.nodes[o.id] ?? { x: 0, y: 0 };
    return { id: o.id, label: o.name, x: l.x, y: l.y };
  });
  const edges = morphismsOf(s.doc.context).map(m => ({
    id: m.id,
    label: m.name,
    src: m.source,
    tgt: m.target,
    type: styleOf(s, m.id),
    curve: s.layout.edges[m.id]?.curve ?? 0,
  }));
  return { nodes, edges };
}
