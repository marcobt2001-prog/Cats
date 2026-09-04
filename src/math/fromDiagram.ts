/**
 * Adapter from the visual diagram shape used by the canvas (App.jsx, GameMode.jsx,
 * level `givens`) to the mathematical IR.
 *
 * Positions, curvature, and colours are ignored: moving a node changes nothing
 * here. Node ids become object ids and edge ids become morphism ids, so the
 * visual layer can map back without a lookup table.
 */
import type { MathContext, MorphismProperty } from './types.js';
import { emptyDocument, declareObject, declareMorphism, declareHypothesis, MathError } from './context.js';
import { allPaths, pathExpr } from './paths.js';

export interface VisualNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
  [k: string]: unknown;
}

export interface VisualEdge {
  id: string;
  label: string;
  src: string;
  tgt: string;
  type?: string;
  [k: string]: unknown;
}

/** Editor `commGroups`: `"srcId|tgtId"` → ids of the edges on the paths marked as commuting. */
export type CommGroups = Record<string, string[]>;

export interface FromDiagramResult {
  context: MathContext;
  warnings: string[];
}

export const PROPERTY_TYPES: Record<string, MorphismProperty> = { mono: 'mono', epi: 'epi', iso: 'iso' };

export function fromDiagram(nodes: VisualNode[], edges: VisualEdge[], commGroups: CommGroups = {}): FromDiagramResult {
  const warnings: string[] = [];
  let doc = emptyDocument();

  for (const n of nodes) {
    try {
      [doc] = declareObject(doc, { name: n.label }, n.id);
    } catch (e) {
      warnings.push(`node '${n.id}': ${(e as Error).message}`);
    }
  }

  for (const e of edges) {
    const prop = e.type !== undefined ? PROPERTY_TYPES[e.type] : undefined;
    try {
      [doc] = declareMorphism(
        doc,
        { name: e.label, source: e.src, target: e.tgt, ...(prop ? { properties: [prop] } : {}) },
        e.id,
      );
    } catch (err) {
      warnings.push(`edge '${e.id}': ${(err as Error).message}; skipped`);
    }
  }

  for (const [key, groupEdgeIds] of Object.entries(commGroups)) {
    const sep = key.indexOf('|');
    if (sep < 0) { warnings.push(`commGroup '${key}': malformed key`); continue; }
    const start = key.slice(0, sep);
    const end = key.slice(sep + 1);
    const allowed = new Set(groupEdgeIds);
    const paths = allPaths(doc.context, start, end).filter(p => p.every(id => allowed.has(id)));
    if (paths.length < 2) {
      warnings.push(`commGroup '${key}': fewer than two paths survive; no equation emitted`);
      continue;
    }
    const first = pathExpr(start, paths[0]!);
    for (let i = 1; i < paths.length; i += 1) {
      const other = pathExpr(start, paths[i]!);
      try {
        [doc] = declareHypothesis(doc, { prop: { kind: 'eq', left: first, right: other } }, `comm:${key}:${i}`);
      } catch (err) {
        if (err instanceof MathError) warnings.push(`commGroup '${key}': ${err.message}`);
        else throw err;
      }
    }
  }

  return { context: doc.context, warnings };
}
