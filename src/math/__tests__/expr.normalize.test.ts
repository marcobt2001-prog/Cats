import { describe, it, expect } from 'vitest';
import { morphism, identity, compose, normalize, exprEquals, exprEquivalent, propEquivalent } from '../expr.js';

const f = morphism('f'), g = morphism('g'), h = morphism('h');

describe('normalize', () => {
  it('drops identities', () => {
    expect(normalize(compose(f, identity('B'), g))).toEqual(compose(f, g));
  });

  it('flattens nested compositions to one level', () => {
    expect(normalize(compose(compose(f, g), h))).toEqual(compose(f, g, h));
    expect(normalize(compose(f, compose(g, h)))).toEqual(compose(f, g, h));
  });

  it('collapses an all-identity composition to one identity', () => {
    expect(normalize(compose(identity('A'), identity('A')))).toEqual(identity('A'));
  });

  it('unwraps a single remaining factor', () => {
    expect(normalize(compose(f))).toEqual(f);
    expect(normalize(compose(identity('A'), f))).toEqual(f);
  });

  it('is idempotent and leaves normal forms structurally equal', () => {
    const e = compose(f, g);
    expect(normalize(e)).toEqual(e);
    expect(normalize(normalize(compose(compose(f, identity('B')), g)))).toEqual(e);
  });

  it('does not mutate its input', () => {
    const e = compose(compose(f, g), identity('C'));
    const before = JSON.stringify(e);
    normalize(e);
    expect(JSON.stringify(e)).toBe(before);
  });
});

describe('equality', () => {
  it('exprEquals is order-sensitive', () => {
    expect(exprEquals(compose(f, g), compose(f, g))).toBe(true);
    expect(exprEquals(compose(f, g), compose(g, f))).toBe(false);
    expect(exprEquals(f, identity('A'))).toBe(false);
  });

  it('exprEquivalent identifies g∘id∘f with g∘f', () => {
    expect(exprEquivalent(compose(f, identity('B'), g), compose(f, g))).toBe(true);
    expect(exprEquivalent(compose(compose(f, g), h), compose(f, compose(g, h)))).toBe(true);
  });

  it('exprEquivalent does not identify distinct morphisms', () => {
    expect(exprEquivalent(f, g)).toBe(false);
  });

  it('propEquivalent compares sides in place', () => {
    const p = { kind: 'eq' as const, left: compose(f, identity('B'), g), right: h };
    const q = { kind: 'eq' as const, left: compose(f, g), right: h };
    expect(propEquivalent(p, q)).toBe(true);
    expect(propEquivalent(p, { kind: 'eq', left: h, right: compose(f, g) })).toBe(false);
  });
});
