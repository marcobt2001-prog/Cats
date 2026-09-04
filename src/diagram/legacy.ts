/**
 * Import of the legacy fused shape: `{id,label,x,y}` nodes and
 * `{id,label,src,tgt,type,curve,commutative}` edges plus `commGroups`.
 *
 * Used for `.cat` v0.1 files, the editor defaults, level givens, construction
 * templates, and paste. Everything mathematical goes through `fromDiagram`;
 * this module only adds the layout and honours the old per-edge flags.
 */
import { emptyDocument } from '../math/context.js';
import { fromDiagram } from '../math/fromDiagram.js';
import type { CommGroups, VisualEdge, VisualNode } from '../math/fromDiagram.js';
import { allPaths } from '../math/paths.js';
import type { DiagramState, EdgeLayout, Layout } from './types.js';
import { isArrowStyle, isDecoration } from './types.js';

export interface LegacyNode extends VisualNode { x?: number; y?: number }
export interface LegacyEdge extends VisualEdge { curve?: number; commutative?: boolean }

export interface LegacyImportResult { state: DiagramState; warnings: string[] }

/**
 * The old validator treated a pair as commuting when ≥2 paths existed and every
 * edge on them carried the flag. Reproduce that as commGroups so the flags are
 * not silently lost.
 */
function groupsFromFlags(nodes: LegacyNode[], edges: LegacyEdge[], warnings: string[]): CommGroups {
  const flagged = new Set(edges.filter(e => e.commutative === true).map(e => e.id));
  if (flagged.size === 0) return {};
  const { context } = fromDiagram(nodes, edges);
  const groups: CommGroups = {};
  const covered = new Set<string>();
  const ids = nodes.map(n => n.id);
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      const paths = allPaths(context, a, b);
      if (paths.length < 2 || !paths.every(p => p.every(id => flagged.has(id)))) continue;
      const union = new Set<string>();
      paths.forEach(p => p.forEach(id => union.add(id)));
      groups[`${a}|${b}`] = [...union];
      union.forEach(id => covered.add(id));
    }
  }
  for (const id of flagged) {
    if (!covered.has(id)) warnings.push(`edge '${id}': commutative flag dropped (no fully flagged pair of paths)`);
  }
  return groups;
}

export function fromLegacyDiagram(nodes: LegacyNode[], edges: LegacyEdge[], commGroups: CommGroups = {}): LegacyImportResult {
  const warnings: string[] = [];

  const groups: CommGroups = { ...groupsFromFlags(nodes, edges, warnings), ...commGroups };
  const { context, warnings: mathWarnings } = fromDiagram(nodes, edges, groups);
  warnings.push(...mathWarnings);
  const doc = { ...emptyDocument(), context };

  const layout: Layout = { nodes: {}, edges: {} };
  const objectIds = new Set(context.declarations.filter(d => d.kind === 'object').map(d => d.id));
  const morphismIds = new Set(context.declarations.filter(d => d.kind === 'morphism').map(d => d.id));

  for (const n of nodes) {
    if (!objectIds.has(n.id) || layout.nodes[n.id]) continue;
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : undefined;
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : undefined;
    if (x === undefined || y === undefined) warnings.push(`node '${n.id}': missing position, placed at origin`);
    layout.nodes[n.id] = { x: x ?? 0, y: y ?? 0 };
  }

  for (const e of edges) {
    if (!morphismIds.has(e.id) || layout.edges[e.id]) continue;
    const curve = typeof e.curve === 'number' && Number.isFinite(e.curve) ? e.curve : 0;
    const entry: EdgeLayout = { curve };
    if (e.type !== undefined) {
      if (isDecoration(e.type)) entry.decoration = e.type;
      else if (!isArrowStyle(e.type)) warnings.push(`edge '${e.id}': unknown type '${e.type}' treated as plain`);
    }
    layout.edges[e.id] = entry;
  }

  return { state: { doc, layout }, warnings };
}
