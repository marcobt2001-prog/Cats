/**
 * Commutativity as equality hypotheses.
 *
 * A pair (src, tgt) "commutes" when every current path from src to tgt is
 * identified with every other by the hypotheses in the document (transitively,
 * in either orientation). Marking adds the missing equations; unmarking removes
 * every equation parallel at that pair.
 */
import type { HypothesisDecl, HypothesisId, MorphismExpr, MorphismId, ObjectId } from '../math/types.js';
import { declareHypothesis, removeDeclarations, objectsOf, hypothesesOf, getObject } from '../math/context.js';
import { typeOf } from '../math/expr.js';
import { exprKey } from '../math/unfold.js';
import { printClassical, printProposition } from '../math/print.js';
import { allPaths, pathExpr } from '../math/paths.js';
import type { DiagramState } from './types.js';

export interface ParallelPair { src: ObjectId; tgt: ObjectId; paths: MorphismId[][] }

/** One pair of objects with several paths, described in mathematical terms for the UI. */
export interface PairDescription {
  src: ObjectId;
  tgt: ObjectId;
  srcName: string;
  tgtName: string;
  paths: { ids: MorphismId[]; expr: MorphismExpr; text: string }[];
  hypotheses: { id: HypothesisId; text: string }[];
  commutes: boolean;
  /** Commutes with no equation of its own: the paths are equal by definition. */
  byDefinition: boolean;
}

/** Ordered pairs of distinct objects with at least two paths, in declaration order. */
export function parallelPairs(s: DiagramState): ParallelPair[] {
  const objects = objectsOf(s.doc.context);
  const out: ParallelPair[] = [];
  for (const a of objects) {
    for (const b of objects) {
      if (a.id === b.id) continue;
      const paths = allPaths(s.doc.context, a.id, b.id);
      if (paths.length >= 2) out.push({ src: a.id, tgt: b.id, paths });
    }
  }
  return out;
}

/** Hypotheses whose (well-typed) sides run from src to tgt. */
export function hypothesesAt(s: DiagramState, src: ObjectId, tgt: ObjectId): HypothesisDecl[] {
  return hypothesesOf(s.doc.context).filter(h => {
    const t = typeOf(s.doc.context, h.prop.left);
    return t.ok && t.source === src && t.target === tgt;
  });
}

/** Definitions are unfolded first, so a composite arrow and the path it abbreviates share a key. */
const key = (s: DiagramState, e: MorphismExpr): string => exprKey(s.doc.context, e);

/** Union-find over the current paths, joined by the hypotheses at (src, tgt). */
function pathClasses(s: DiagramState, src: ObjectId, tgt: ObjectId): { paths: MorphismId[][]; find: (k: string) => string } {
  const paths = allPaths(s.doc.context, src, tgt);
  const parent = new Map<string, string>();
  for (const p of paths) { const k = key(s, pathExpr(src, p)); parent.set(k, k); }
  const find = (k: string): string => {
    let cur = k;
    while (parent.get(cur) !== cur) cur = parent.get(cur)!;
    return cur;
  };
  const union = (a: string, b: string): void => { parent.set(find(a), find(b)); };
  for (const h of hypothesesAt(s, src, tgt)) {
    const l = key(s, h.prop.left), r = key(s, h.prop.right);
    if (parent.has(l) && parent.has(r)) union(l, r);
  }
  return { paths, find };
}

export function isCommuting(s: DiagramState, src: ObjectId, tgt: ObjectId): boolean {
  const { paths, find } = pathClasses(s, src, tgt);
  if (paths.length < 2) return false;
  const root = find(key(s, pathExpr(src, paths[0]!)));
  return paths.every(p => find(key(s, pathExpr(src, p))) === root);
}

/** Adds `p0 = pi` for every path not already identified with the first one. */
export function markCommuting(s: DiagramState, src: ObjectId, tgt: ObjectId): DiagramState {
  const { paths, find } = pathClasses(s, src, tgt);
  if (paths.length < 2) return s;
  const first = pathExpr(src, paths[0]!);
  const root = find(key(s, first));
  let doc = s.doc;
  for (const p of paths.slice(1)) {
    const other = pathExpr(src, p);
    if (find(key(s, other)) === root) continue;
    [doc] = declareHypothesis(doc, { prop: { kind: 'eq', left: first, right: other } });
  }
  return doc === s.doc ? s : { ...s, doc };
}

export function unmarkCommuting(s: DiagramState, src: ObjectId, tgt: ObjectId): DiagramState {
  const ids = hypothesesAt(s, src, tgt).map(h => h.id);
  if (ids.length === 0) return s;
  return { ...s, doc: removeDeclarations(s.doc, ids) };
}

export function toggleCommuting(s: DiagramState, src: ObjectId, tgt: ObjectId): DiagramState {
  return isCommuting(s, src, tgt) ? unmarkCommuting(s, src, tgt) : markCommuting(s, src, tgt);
}

function collectMorphisms(e: MorphismExpr, out: Set<MorphismId>): void {
  if (e.kind === 'morphism') out.add(e.ref);
  else if (e.kind === 'compose') e.factors.forEach(f => collectMorphisms(f, out));
}

/**
 * Every parallel pair with its paths as expressions and its equations as text,
 * ready for the commutativity panel. The UI does no mathematics of its own.
 */
export function describePairs(s: DiagramState): PairDescription[] {
  const ctx = s.doc.context;
  const name = (id: ObjectId): string => getObject(ctx, id)?.name ?? id;
  return parallelPairs(s).map(({ src, tgt, paths }) => {
    const hypotheses = hypothesesAt(s, src, tgt).map(h => ({
      id: h.id,
      text: printProposition(ctx, h.prop, 'classical'),
    }));
    const commutes = isCommuting(s, src, tgt);
    return {
      src,
      tgt,
      srcName: name(src),
      tgtName: name(tgt),
      paths: paths.map(ids => {
        const expr = pathExpr(src, ids);
        return { ids, expr, text: printClassical(ctx, expr) };
      }),
      hypotheses,
      commutes,
      byDefinition: commutes && hypotheses.length === 0,
    };
  });
}

/** Morphisms that appear in any hypothesis. Used for the teal highlight. */
export function commutingEdgeIds(s: DiagramState): Set<MorphismId> {
  const out = new Set<MorphismId>();
  for (const h of hypothesesOf(s.doc.context)) {
    collectMorphisms(h.prop.left, out);
    collectMorphisms(h.prop.right, out);
  }
  return out;
}
