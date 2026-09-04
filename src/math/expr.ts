import type { MathContext, MorphismDecl, MorphismExpr, MorphismId, ObjectId, Proposition } from './types.js';
import { assertNever } from './types.js';

export class MathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MathError';
  }
}

// ── Constructors ───────────────────────────────────────────────────────────
export function morphism(ref: MorphismId): MorphismExpr {
  return { kind: 'morphism', ref };
}

export function identity(object: ObjectId): MorphismExpr {
  return { kind: 'identity', object };
}

/** Diagrammatic order: `compose(f, g)` is "f then g" = `f ≫ g` = `g ∘ f`. */
export function compose(...factors: MorphismExpr[]): MorphismExpr {
  if (factors.length === 0) throw new MathError('compose requires at least one factor');
  return { kind: 'compose', factors: [...factors] };
}

/** Classical-order helper for code that thinks "g after f": `after(g, f) === compose(f, g)`. */
export function after(g: MorphismExpr, f: MorphismExpr): MorphismExpr {
  return compose(f, g);
}

// ── Typing ─────────────────────────────────────────────────────────────────
export type TypeResult =
  | { ok: true; source: ObjectId; target: ObjectId }
  | { ok: false; error: string };

function lookupMorphism(ctx: MathContext, id: MorphismId): MorphismDecl | undefined {
  for (const d of ctx.declarations) {
    if (d.kind === 'morphism' && d.id === id) return d;
  }
  return undefined;
}

function hasObject(ctx: MathContext, id: ObjectId): boolean {
  return ctx.declarations.some(d => d.kind === 'object' && d.id === id);
}

/** Short human-readable rendering used only in error messages (no ctx names needed). */
function describe(ctx: MathContext, e: MorphismExpr): string {
  switch (e.kind) {
    case 'morphism': {
      const m = lookupMorphism(ctx, e.ref);
      return m ? `${m.name} : ${m.source} → ${m.target}` : `?${e.ref}`;
    }
    case 'identity':
      return `id_${e.object} : ${e.object} → ${e.object}`;
    case 'compose':
      return `(${e.factors.map(f => describe(ctx, f)).join(' ≫ ')})`;
    default:
      return assertNever(e);
  }
}

/**
 * Computes the source and target of an expression, or explains why it is ill-typed:
 * unknown references, or adjacent factors whose target and source disagree.
 */
export function typeOf(ctx: MathContext, e: MorphismExpr): TypeResult {
  switch (e.kind) {
    case 'morphism': {
      const m = lookupMorphism(ctx, e.ref);
      if (!m) return { ok: false, error: `unknown morphism '${e.ref}'` };
      return { ok: true, source: m.source, target: m.target };
    }
    case 'identity': {
      if (!hasObject(ctx, e.object)) return { ok: false, error: `unknown object '${e.object}'` };
      return { ok: true, source: e.object, target: e.object };
    }
    case 'compose': {
      if (e.factors.length === 0) return { ok: false, error: 'empty composition' };
      let source: ObjectId | undefined;
      let target: ObjectId | undefined;
      let prev: MorphismExpr | undefined;
      for (const f of e.factors) {
        const t = typeOf(ctx, f);
        if (!t.ok) return t;
        if (source === undefined) {
          source = t.source;
        } else if (t.source !== target) {
          return {
            ok: false,
            error:
              `cannot compose ${describe(ctx, prev!)} then ${describe(ctx, f)}: ` +
              `target '${target}' ≠ source '${t.source}'`,
          };
        }
        target = t.target;
        prev = f;
      }
      return { ok: true, source: source!, target: target! };
    }
    default:
      return assertNever(e);
  }
}

export function source(ctx: MathContext, e: MorphismExpr): ObjectId {
  const t = typeOf(ctx, e);
  if (!t.ok) throw new MathError(t.error);
  return t.source;
}

export function target(ctx: MathContext, e: MorphismExpr): ObjectId {
  const t = typeOf(ctx, e);
  if (!t.ok) throw new MathError(t.error);
  return t.target;
}

// ── Normalization and equality ─────────────────────────────────────────────
/**
 * Canonical form modulo the category axioms that are purely syntactic:
 * associativity (nested compositions are flattened) and unit laws (identities
 * are dropped). A composition of only identities becomes a single identity; a
 * single remaining factor is unwrapped. Pure; needs no context.
 */
export function normalize(e: MorphismExpr): MorphismExpr {
  switch (e.kind) {
    case 'morphism':
    case 'identity':
      return e;
    case 'compose': {
      const flat: MorphismExpr[] = [];
      let firstIdentity: ObjectId | undefined;
      for (const f of e.factors) {
        const n = normalize(f);
        if (n.kind === 'compose') flat.push(...n.factors);
        else if (n.kind === 'identity') { if (firstIdentity === undefined) firstIdentity = n.object; }
        else flat.push(n);
      }
      if (flat.length === 0) {
        if (firstIdentity === undefined) throw new MathError('empty composition');
        return identity(firstIdentity);
      }
      if (flat.length === 1) return flat[0]!;
      return { kind: 'compose', factors: flat };
    }
    default:
      return assertNever(e);
  }
}

/** Strict structural equality. `compose(f, g)` and `compose(g, f)` are different. */
export function exprEquals(a: MorphismExpr, b: MorphismExpr): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'morphism':
      return a.ref === (b as typeof a).ref;
    case 'identity':
      return a.object === (b as typeof a).object;
    case 'compose': {
      const bf = (b as typeof a).factors;
      return a.factors.length === bf.length && a.factors.every((f, i) => exprEquals(f, bf[i]!));
    }
    default:
      return assertNever(a);
  }
}

/** True when the expression references any of the given object or morphism ids. */
export function mentions(e: MorphismExpr, ids: ReadonlySet<string>): boolean {
  switch (e.kind) {
    case 'morphism':
      return ids.has(e.ref);
    case 'identity':
      return ids.has(e.object);
    case 'compose':
      return e.factors.some(f => mentions(f, ids));
    default:
      return assertNever(e);
  }
}

/** Equality up to associativity and unit laws. */
export function exprEquivalent(a: MorphismExpr, b: MorphismExpr): boolean {
  return exprEquals(normalize(a), normalize(b));
}

/** Both sides equivalent, side by side. Symmetry (`a = b` vs `b = a`) is not applied. */
export function propEquivalent(a: Proposition, b: Proposition): boolean {
  return exprEquivalent(a.left, b.left) && exprEquivalent(a.right, b.right);
}
