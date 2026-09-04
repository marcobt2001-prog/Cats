import type { Declaration, MathContext, MorphismDecl, MorphismExpr, ObjectDecl, Proposition } from './types.js';
import { assertNever } from './types.js';

export type PrintStyle = 'diagrammatic' | 'classical';

function objectName(ctx: MathContext, id: string): string {
  const d = ctx.declarations.find((d): d is ObjectDecl => d.kind === 'object' && d.id === id);
  return d ? d.name : id;
}

function morphismName(ctx: MathContext, id: string): string {
  const d = ctx.declarations.find((d): d is MorphismDecl => d.kind === 'morphism' && d.id === id);
  return d ? d.name : id;
}

function atom(ctx: MathContext, e: MorphismExpr, style: PrintStyle): string {
  switch (e.kind) {
    case 'morphism':
      return morphismName(ctx, e.ref);
    case 'identity':
      return style === 'diagrammatic' ? `𝟙 ${objectName(ctx, e.object)}` : `id_${objectName(ctx, e.object)}`;
    case 'compose':
      return `(${printExpr(ctx, e, style)})`;
    default:
      return assertNever(e);
  }
}

/** Renders without normalizing, so nested compositions show their parentheses. */
export function printExpr(ctx: MathContext, e: MorphismExpr, style: PrintStyle): string {
  if (e.kind !== 'compose') return atom(ctx, e, style);
  const parts = e.factors.map(f => atom(ctx, f, style));
  return style === 'diagrammatic' ? parts.join(' ≫ ') : [...parts].reverse().join(' ∘ ');
}

/** Mathlib order: `f ≫ g`, `𝟙 A`. */
export function printDiagrammatic(ctx: MathContext, e: MorphismExpr): string {
  return printExpr(ctx, e, 'diagrammatic');
}

/** Textbook order: `g ∘ f`, `id_A`. */
export function printClassical(ctx: MathContext, e: MorphismExpr): string {
  return printExpr(ctx, e, 'classical');
}

export function printProposition(ctx: MathContext, p: Proposition, style: PrintStyle): string {
  switch (p.kind) {
    case 'eq':
      return `${printExpr(ctx, p.left, style)} = ${printExpr(ctx, p.right, style)}`;
    default:
      return assertNever(p.kind);
  }
}

export function printDecl(ctx: MathContext, d: Declaration, style: PrintStyle = 'classical'): string {
  switch (d.kind) {
    case 'object':
      return d.name;
    case 'morphism':
      return `${d.name} : ${objectName(ctx, d.source)} → ${objectName(ctx, d.target)}`;
    case 'hypothesis':
      return `${d.name ?? d.id} : ${printProposition(ctx, d.prop, style)}`;
    default:
      return assertNever(d);
  }
}
