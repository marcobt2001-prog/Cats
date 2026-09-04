/**
 * Definitional unfolding.
 *
 * A morphism declaration may carry a `definition`: the morphism abbreviates
 * that expression and is equal to it by definition. Everything here is pure
 * over a context and imports only `expr.ts`, so `context.ts` can use
 * `definitionError` without a cycle.
 */
import type { MathContext, MorphismDecl, MorphismExpr, MorphismId, Proposition } from './types.js';
import { assertNever } from './types.js';
import { MathError, mentions, normalize, exprEquals, typeOf, morphism } from './expr.js';

function lookup(ctx: MathContext, id: MorphismId): MorphismDecl | undefined {
  for (const d of ctx.declarations) if (d.kind === 'morphism' && d.id === id) return d;
  return undefined;
}

/**
 * Replaces every reference to a defined morphism by its definition, recursively.
 * Throws `MathError` on a circular definition (guarded by the visited set).
 */
export function unfold(ctx: MathContext, e: MorphismExpr, seen: ReadonlySet<MorphismId> = new Set()): MorphismExpr {
  switch (e.kind) {
    case 'morphism': {
      const m = lookup(ctx, e.ref);
      if (!m || !m.definition) return e;
      if (seen.has(e.ref)) throw new MathError(`circular definition through '${m.name || e.ref}'`);
      const next = new Set(seen);
      next.add(e.ref);
      return unfold(ctx, m.definition, next);
    }
    case 'identity':
      return e;
    case 'compose':
      return { kind: 'compose', factors: e.factors.map(f => unfold(ctx, f, seen)) };
    default:
      return assertNever(e);
  }
}

/**
 * `undefined` when `def` is an acceptable definition for morphism `id` in `ctx`:
 * well-typed, parallel to the morphism, and not circular (self-reference included).
 * Checked against the whole context, so a definition may reference later declarations.
 */
export function definitionError(ctx: MathContext, id: MorphismId, def: MorphismExpr): string | undefined {
  const m = lookup(ctx, id);
  if (!m) return `unknown morphism '${id}'`;
  const t = typeOf(ctx, def);
  if (!t.ok) return t.error;
  if (t.source !== m.source || t.target !== m.target) {
    return `definition runs ${t.source} → ${t.target} but the morphism runs ${m.source} → ${m.target}`;
  }
  const candidate: MathContext = {
    declarations: ctx.declarations.map(d => (d.kind === 'morphism' && d.id === id ? { ...d, definition: def } : d)),
  };
  try {
    unfold(candidate, morphism(id));
  } catch (e) {
    if (e instanceof MathError) return e.message;
    throw e;
  }
  return undefined;
}

/** Canonical string key: equal keys ⇔ equal up to definitions, associativity, and unit laws. */
export function exprKey(ctx: MathContext, e: MorphismExpr): string {
  return JSON.stringify(normalize(unfold(ctx, e)));
}

/** Equality up to definitions, associativity, and unit laws. */
export function exprEquivalentIn(ctx: MathContext, a: MorphismExpr, b: MorphismExpr): boolean {
  return exprEquals(normalize(unfold(ctx, a)), normalize(unfold(ctx, b)));
}

/** Both sides equivalent in `ctx`, side by side; symmetry is not applied. */
export function propEquivalentIn(ctx: MathContext, a: Proposition, b: Proposition): boolean {
  return exprEquivalentIn(ctx, a.left, b.left) && exprEquivalentIn(ctx, a.right, b.right);
}

/** Morphisms whose definition mentions `id` (an object or a morphism), in declaration order. */
export function dependentsOf(ctx: MathContext, id: string): MorphismDecl[] {
  const ids = new Set([id]);
  return ctx.declarations.filter(
    (d): d is MorphismDecl => d.kind === 'morphism' && d.definition !== undefined && mentions(d.definition, ids),
  );
}
