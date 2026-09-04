import { describe, it, expect } from 'vitest';
import type { MathContext } from '../types.js';
import { allPaths, pathExpr } from '../paths.js';
import { morphism, identity, compose } from '../expr.js';

const o = (id: string) => ({ kind: 'object' as const, id, name: id });
const m = (id: string, source: string, target: string) => ({ kind: 'morphism' as const, id, name: id, source, target });

describe('allPaths', () => {
  // A --f--> B --g--> C, plus A --h--> C
  const triangle: MathContext = { declarations: [o('A'), o('B'), o('C'), m('f', 'A', 'B'), m('g', 'B', 'C'), m('h', 'A', 'C')] };

  it('lists simple paths in declaration order', () => {
    expect(allPaths(triangle, 'A', 'C')).toEqual([['f', 'g'], ['h']]);
    expect(allPaths(triangle, 'A', 'B')).toEqual([['f']]);
    expect(allPaths(triangle, 'C', 'A')).toEqual([]);
  });

  it('returns the identity path when start equals end', () => {
    expect(allPaths(triangle, 'A', 'A')).toEqual([[]]);
  });

  it('never traverses loops', () => {
    const ctx: MathContext = { declarations: [o('A'), o('B'), m('l', 'A', 'A'), m('f', 'A', 'B')] };
    expect(allPaths(ctx, 'A', 'A')).toEqual([[]]);
    expect(allPaths(ctx, 'A', 'B')).toEqual([['f']]);
  });

  it('terminates on cycles', () => {
    const ctx: MathContext = { declarations: [o('A'), o('B'), o('C'), m('f', 'A', 'B'), m('g', 'B', 'A'), m('h', 'B', 'C')] };
    expect(allPaths(ctx, 'A', 'C')).toEqual([['f', 'h']]);
  });

  it('returns nothing for an unknown start', () => {
    expect(allPaths(triangle, 'Z', 'A')).toEqual([]);
  });
});

describe('pathExpr', () => {
  it('builds identity, single morphism, or composite in path order', () => {
    expect(pathExpr('A', [])).toEqual(identity('A'));
    expect(pathExpr('A', ['f'])).toEqual(morphism('f'));
    expect(pathExpr('A', ['f', 'g'])).toEqual(compose(morphism('f'), morphism('g')));
  });
});
