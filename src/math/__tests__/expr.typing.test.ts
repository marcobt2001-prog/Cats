import { describe, it, expect } from 'vitest';
import type { MathContext } from '../types.js';
import { morphism, identity, compose, after, typeOf, source, target, MathError } from '../expr.js';

// A --f--> B --g--> C --h--> D
const ctx: MathContext = {
  declarations: [
    { kind: 'object', id: 'A', name: 'A' },
    { kind: 'object', id: 'B', name: 'B' },
    { kind: 'object', id: 'C', name: 'C' },
    { kind: 'object', id: 'D', name: 'D' },
    { kind: 'morphism', id: 'f', name: 'f', source: 'A', target: 'B' },
    { kind: 'morphism', id: 'g', name: 'g', source: 'B', target: 'C' },
    { kind: 'morphism', id: 'h', name: 'h', source: 'C', target: 'D' },
    { kind: 'morphism', id: 'k', name: 'k', source: 'C', target: 'D' },
  ],
};
const f = morphism('f'), g = morphism('g'), h = morphism('h'), k = morphism('k');

describe('typeOf', () => {
  it('types a single morphism', () => {
    expect(typeOf(ctx, f)).toEqual({ ok: true, source: 'A', target: 'B' });
  });

  it('types an identity as an endomorphism', () => {
    expect(typeOf(ctx, identity('A'))).toEqual({ ok: true, source: 'A', target: 'A' });
  });

  it('accepts a composable pair in diagrammatic order', () => {
    expect(typeOf(ctx, compose(f, g))).toEqual({ ok: true, source: 'A', target: 'C' });
  });

  it('rejects the classical order compose(g, f)', () => {
    const t = typeOf(ctx, compose(g, f));
    expect(t.ok).toBe(false);
  });

  it('rejects non-composable morphisms and names both', () => {
    const t = typeOf(ctx, compose(f, k)); // f: A→B then k: C→D
    expect(t.ok).toBe(false);
    if (!t.ok) {
      expect(t.error).toContain('f : A → B');
      expect(t.error).toContain('k : C → D');
      expect(t.error).toContain("'B'");
      expect(t.error).toContain("'C'");
    }
  });

  it('rejects unknown morphism and object ids', () => {
    expect(typeOf(ctx, morphism('nope')).ok).toBe(false);
    expect(typeOf(ctx, identity('nope')).ok).toBe(false);
  });

  it('accepts identities inside compositions', () => {
    expect(typeOf(ctx, compose(identity('A'), f, identity('B')))).toEqual({ ok: true, source: 'A', target: 'B' });
  });

  it('types nested compositions', () => {
    const e = compose(compose(f, g), h);
    expect(source(ctx, e)).toBe('A');
    expect(target(ctx, e)).toBe('D');
  });
});

describe('constructors', () => {
  it('after(g, f) is compose(f, g)', () => {
    expect(after(g, f)).toEqual(compose(f, g));
  });

  it('compose() with no factors throws', () => {
    expect(() => compose()).toThrow(MathError);
  });

  it('source/target throw MathError on ill-typed input', () => {
    expect(() => source(ctx, compose(g, f))).toThrow(MathError);
    expect(() => target(ctx, morphism('nope'))).toThrow(MathError);
  });
});
