/**
 * What the context already forces to be true.
 *
 * Two expressions are identified when they agree after unfolding definitions
 * and normalizing (associativity and unit laws), or when a chain of equality
 * hypotheses connects them. That chain is what `entailment` searches for, and
 * it reports which hypotheses it used so a proof step can record them.
 *
 * Deliberate limitation: there is no congruence. `h ∘ f = k ∘ g` does not
 * entail `h ∘ f ∘ x = k ∘ g ∘ x`; rewriting under a composition is Lean's job.
 * This is why nothing here may mark a goal `verified`.
 */
import type { HypothesisId, MathContext, Proposition } from './types.js';
import { hypothesesOf, propositionError } from './context.js';
import { typeOf } from './expr.js';
import { exprKey } from './unfold.js';

export type Entailment =
  | { holds: true; by: HypothesisId[] }
  | { holds: false; error?: string };

/**
 * Breadth-first search over expression keys, joined in both directions by the
 * hypotheses parallel to the proposition. `by` is empty when the two sides
 * already agree by definition and the category axioms.
 */
export function entailment(ctx: MathContext, prop: Proposition): Entailment {
  const err = propositionError(ctx, prop);
  if (err) return { holds: false, error: err };

  const t = typeOf(ctx, prop.left);
  if (!t.ok) return { holds: false, error: t.error };

  const start = exprKey(ctx, prop.left);
  const goal = exprKey(ctx, prop.right);
  if (start === goal) return { holds: true, by: [] };

  // Only hypotheses parallel to the proposition can connect its sides.
  const edges = new Map<string, { to: string; via: HypothesisId }[]>();
  const link = (a: string, b: string, via: HypothesisId): void => {
    if (!edges.has(a)) edges.set(a, []);
    edges.get(a)!.push({ to: b, via });
  };
  for (const h of hypothesesOf(ctx)) {
    const ht = typeOf(ctx, h.prop.left);
    if (!ht.ok || ht.source !== t.source || ht.target !== t.target) continue;
    const l = exprKey(ctx, h.prop.left);
    const r = exprKey(ctx, h.prop.right);
    link(l, r, h.id);
    link(r, l, h.id);
  }

  const cameFrom = new Map<string, { prev: string; via: HypothesisId }>();
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === goal) {
      const by: HypothesisId[] = [];
      for (let at = goal; at !== start; ) {
        const step = cameFrom.get(at)!;
        by.push(step.via);
        at = step.prev;
      }
      by.reverse();
      return { holds: true, by };
    }
    for (const { to, via } of edges.get(cur) ?? []) {
      if (seen.has(to)) continue;
      seen.add(to);
      cameFrom.set(to, { prev: cur, via });
      queue.push(to);
    }
  }
  return { holds: false };
}

/** True when the context already forces the proposition. */
export function entails(ctx: MathContext, prop: Proposition): boolean {
  return entailment(ctx, prop).holds;
}
