/**
 * Path enumeration over a context's morphism graph.
 *
 * Semantics match the original `findAllPaths` in geometry.js exactly:
 * simple directed paths (no repeated objects), morphisms explored in
 * declaration order, and `[[]]` (the identity path) when start === end.
 * Loops are therefore never traversed.
 */
import type { MathContext, MorphismExpr, MorphismId, ObjectId } from './types.js';
import { morphism, identity, compose } from './expr.js';

export function allPaths(ctx: MathContext, start: ObjectId, end: ObjectId): MorphismId[][] {
  const adj = new Map<ObjectId, { target: ObjectId; id: MorphismId }[]>();
  for (const d of ctx.declarations) {
    if (d.kind === 'object' && !adj.has(d.id)) adj.set(d.id, []);
    if (d.kind === 'morphism') {
      const out = adj.get(d.source);
      if (out) out.push({ target: d.target, id: d.id });
    }
  }
  if (!adj.has(start)) return [];

  const results: MorphismId[][] = [];
  const visited = new Set<ObjectId>();
  const dfs = (cur: ObjectId, path: MorphismId[]): void => {
    if (cur === end) { results.push([...path]); return; }
    visited.add(cur);
    for (const { target, id } of adj.get(cur) ?? []) {
      if (!visited.has(target)) { path.push(id); dfs(target, path); path.pop(); }
    }
    visited.delete(cur);
  };
  dfs(start, []);
  return results;
}

/** `[]` → identity(start); `[m]` → morphism(m); otherwise a composite in path order. */
export function pathExpr(start: ObjectId, path: MorphismId[]): MorphismExpr {
  if (path.length === 0) return identity(start);
  if (path.length === 1) return morphism(path[0]!);
  return compose(...path.map(morphism));
}
