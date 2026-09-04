import type { Declaration, MathContext, MorphismDecl, MorphismExpr, ObjectDecl, Proposition } from './types.js';
import { assertNever } from './types.js';

/** `latex` is the label syntax (`g \circ f`, `\mathrm{id}_A`), used to re-print derived labels. */
export type PrintStyle = 'diagrammatic' | 'classical' | 'latex';

function objectName(ctx: MathContext, id: string): string {
  const d = ctx.declarations.find((d): d is ObjectDecl => d.kind === 'object' && d.id === id);
  return d ? d.name : id;
}

function morphismDecl(ctx: MathContext, id: string): MorphismDecl | undefined {
  return ctx.declarations.find((d): d is MorphismDecl => d.kind === 'morphism' && d.id === id);
}

function morphismName(ctx: MathContext, id: string): string {
  return morphismDecl(ctx, id)?.name ?? id;
}

function latexIdentity(ctx: MathContext, object: string): string {
  const name = objectName(ctx, object);
  return name.length === 1 ? `\\mathrm{id}_${name}` : `\\mathrm{id}_{${name}}`;
}

/** A factor inside a composition. */
function atom(ctx: MathContext, e: MorphismExpr, style: PrintStyle): string {
  switch (e.kind) {
    case 'morphism': {
      const name = morphismName(ctx, e.ref);
      // In label syntax a defined composite's name is itself an expression; keep it unambiguous.
      if (style === 'latex' && morphismDecl(ctx, e.ref)?.definition?.kind === 'compose') return `(${name})`;
      return name;
    }
    case 'identity':
      if (style === 'diagrammatic') return `𝟙 ${objectName(ctx, e.object)}`;
      if (style === 'latex') return latexIdentity(ctx, e.object);
      return `id_${objectName(ctx, e.object)}`;
    case 'compose':
      return `(${printExpr(ctx, e, style)})`;
    default:
      return assertNever(e);
  }
}

/** Renders without normalizing, so nested compositions show their parentheses. */
export function printExpr(ctx: MathContext, e: MorphismExpr, style: PrintStyle): string {
  if (e.kind === 'morphism') return morphismName(ctx, e.ref);
  if (e.kind !== 'compose') return atom(ctx, e, style);
  const parts = e.factors.map(f => atom(ctx, f, style));
  switch (style) {
    case 'diagrammatic': return parts.join(' ≫ ');
    case 'classical': return [...parts].reverse().join(' ∘ ');
    case 'latex': return [...parts].reverse().join(' \\circ ');
    default: return assertNever(style);
  }
}

/** Mathlib order: `f ≫ g`, `𝟙 A`. */
export function printDiagrammatic(ctx: MathContext, e: MorphismExpr): string {
  return printExpr(ctx, e, 'diagrammatic');
}

/** Textbook order: `g ∘ f`, `id_A`. */
export function printClassical(ctx: MathContext, e: MorphismExpr): string {
  return printExpr(ctx, e, 'classical');
}

/** Label syntax: `g \circ f`, `\mathrm{id}_A`; parses back with `parseLabel`. */
export function printLatex(ctx: MathContext, e: MorphismExpr): string {
  return printExpr(ctx, e, 'latex');
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
