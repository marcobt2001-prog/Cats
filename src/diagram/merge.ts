/**
 * Copy/paste and template insertion: extract a fragment of a diagram, and merge
 * a fragment into a diagram with every id freshly minted so nothing collides.
 */
import type { Declaration, MorphismExpr, MorphismId, ObjectId, Proposition } from '../math/types.js';
import { assertNever } from '../math/types.js';
import { emptyDocument, declareObject, declareMorphism, declareHypothesis, MathError } from '../math/context.js';
import type { DiagramState, Layout } from './types.js';

/** Objects in `nodeIds`, morphisms in `edgeIds` whose endpoints are both kept, and hypotheses fully inside. */
export function extractSubdiagram(
  s: DiagramState,
  nodeIds: Iterable<ObjectId>,
  edgeIds: Iterable<MorphismId>,
): DiagramState {
  const wantNodes = new Set(nodeIds);
  const wantEdges = new Set(edgeIds);
  const kept = new Set<string>();
  const declarations: Declaration[] = [];
  for (const d of s.doc.context.declarations) {
    switch (d.kind) {
      case 'object':
        if (wantNodes.has(d.id)) { kept.add(d.id); declarations.push(d); }
        break;
      case 'morphism': {
        const wanted = wantEdges.has(d.id) || (wantNodes.has(d.source) && wantNodes.has(d.target));
        if (wanted && kept.has(d.source) && kept.has(d.target)) { kept.add(d.id); declarations.push(d); }
        break;
      }
      case 'hypothesis': {
        const refs = new Set<string>();
        collectRefs(d.prop.left, refs);
        collectRefs(d.prop.right, refs);
        if ([...refs].every(id => kept.has(id))) { kept.add(d.id); declarations.push(d); }
        break;
      }
      default:
        assertNever(d);
    }
  }
  const layout: Layout = {
    nodes: Object.fromEntries(Object.entries(s.layout.nodes).filter(([id]) => kept.has(id))),
    edges: Object.fromEntries(Object.entries(s.layout.edges).filter(([id]) => kept.has(id))),
  };
  return { doc: { ...emptyDocument(), context: { declarations } }, layout };
}

function collectRefs(e: MorphismExpr, out: Set<string>): void {
  switch (e.kind) {
    case 'morphism': out.add(e.ref); break;
    case 'identity': out.add(e.object); break;
    case 'compose': e.factors.forEach(f => collectRefs(f, out)); break;
    default: assertNever(e);
  }
}

function mapExpr(e: MorphismExpr, idMap: Map<string, string>): MorphismExpr {
  switch (e.kind) {
    case 'morphism': return { kind: 'morphism', ref: idMap.get(e.ref) ?? e.ref };
    case 'identity': return { kind: 'identity', object: idMap.get(e.object) ?? e.object };
    case 'compose': return { kind: 'compose', factors: e.factors.map(f => mapExpr(f, idMap)) };
    default: return assertNever(e);
  }
}

function mapProp(p: Proposition, idMap: Map<string, string>): Proposition {
  return { kind: 'eq', left: mapExpr(p.left, idMap), right: mapExpr(p.right, idMap) };
}

/**
 * Appends `incoming` to `base`, minting a fresh id for every incoming object,
 * morphism, and hypothesis and rewriting references accordingly. Layout
 * positions are shifted by the offset. Returns the new ids for selection.
 */
export function mergeDiagram(
  base: DiagramState,
  incoming: DiagramState,
  offset: { dx: number; dy: number } = { dx: 0, dy: 0 },
): [DiagramState, { nodeIds: ObjectId[]; edgeIds: MorphismId[] }] {
  const idMap = new Map<string, string>();
  let doc = base.doc;
  const nodes = { ...base.layout.nodes };
  const edges = { ...base.layout.edges };
  const nodeIds: ObjectId[] = [];
  const edgeIds: MorphismId[] = [];

  for (const d of incoming.doc.context.declarations) {
    switch (d.kind) {
      case 'object': {
        let id: string;
        [doc, id] = declareObject(doc, { name: d.name, ...(d.lean ? { lean: d.lean } : {}) });
        idMap.set(d.id, id);
        const l = incoming.layout.nodes[d.id] ?? { x: 0, y: 0 };
        nodes[id] = { x: l.x + offset.dx, y: l.y + offset.dy };
        nodeIds.push(id);
        break;
      }
      case 'morphism': {
        const source = idMap.get(d.source), target = idMap.get(d.target);
        if (!source || !target) throw new MathError(`morphism '${d.id}' references an object outside the fragment`);
        let id: string;
        [doc, id] = declareMorphism(doc, {
          name: d.name, source, target,
          ...(d.properties ? { properties: d.properties } : {}),
          ...(d.lean ? { lean: d.lean } : {}),
        });
        idMap.set(d.id, id);
        edges[id] = { ...(incoming.layout.edges[d.id] ?? { curve: 0 }) };
        edgeIds.push(id);
        break;
      }
      case 'hypothesis': {
        const refs = new Set<string>();
        collectRefs(d.prop.left, refs);
        collectRefs(d.prop.right, refs);
        for (const r of refs) {
          if (!idMap.has(r)) throw new MathError(`hypothesis '${d.id}' references '${r}' outside the fragment`);
        }
        const prop = mapProp(d.prop, idMap);
        let id: string;
        [doc, id] = declareHypothesis(doc, {
          prop,
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.lean ? { lean: d.lean } : {}),
        });
        idMap.set(d.id, id);
        break;
      }
      default:
        assertNever(d);
    }
  }

  return [{ doc, layout: { nodes, edges } }, { nodeIds, edgeIds }];
}
