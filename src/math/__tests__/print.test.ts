import { describe, it, expect } from 'vitest';
import type { MathContext } from '../types.js';
import { morphism, identity, compose } from '../expr.js';
import { printDiagrammatic, printClassical, printProposition, printDecl } from '../print.js';

// Level I-4's square: f: A→B, g: A→C, h: B→D, k: C→D
const ctx: MathContext = {
  declarations: [
    { kind: 'object', id: 'A', name: 'A' },
    { kind: 'object', id: 'B', name: 'B' },
    { kind: 'object', id: 'C', name: 'C' },
    { kind: 'object', id: 'D', name: 'D' },
    { kind: 'morphism', id: 'f', name: 'f', source: 'A', target: 'B' },
    { kind: 'morphism', id: 'g', name: 'g', source: 'A', target: 'C' },
    { kind: 'morphism', id: 'h', name: 'h', source: 'B', target: 'D' },
    { kind: 'morphism', id: 'k', name: 'k', source: 'C', target: 'D' },
  ],
};
const f = morphism('f'), g = morphism('g'), h = morphism('h'), k = morphism('k');

describe('printing', () => {
  it('prints a composite in both conventions', () => {
    expect(printDiagrammatic(ctx, compose(f, h))).toBe('f ≫ h');
    expect(printClassical(ctx, compose(f, h))).toBe('h ∘ f');
  });

  it('prints identities', () => {
    expect(printDiagrammatic(ctx, identity('A'))).toBe('𝟙 A');
    expect(printClassical(ctx, identity('A'))).toBe('id_A');
  });

  it('parenthesizes unnormalized nesting', () => {
    expect(printDiagrammatic(ctx, compose(compose(f, h), identity('D')))).toBe('(f ≫ h) ≫ 𝟙 D');
    expect(printClassical(ctx, compose(compose(f, h), identity('D')))).toBe('id_D ∘ (h ∘ f)');
  });

  it('prints the I-4 proposition exactly as the level stub states it', () => {
    const sq = { kind: 'eq' as const, left: compose(f, h), right: compose(g, k) };
    expect(printProposition(ctx, sq, 'diagrammatic')).toBe('f ≫ h = g ≫ k');
    expect(printProposition(ctx, sq, 'classical')).toBe('h ∘ f = k ∘ g');
  });

  it('prints declarations', () => {
    expect(printDecl(ctx, ctx.declarations[4]!)).toBe('f : A → B');
    expect(printDecl(ctx, { kind: 'hypothesis', id: 'h1', prop: { kind: 'eq', left: f, right: f } })).toBe('h1 : f = f');
  });

  it('falls back to ids for unknown references', () => {
    expect(printClassical(ctx, morphism('zzz'))).toBe('zzz');
  });
});
