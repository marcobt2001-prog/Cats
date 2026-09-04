/**
 * Definitions on morphism declarations, and the bridge between a morphism's
 * label and its definition.
 *
 * A label that parses as a composite or an identity and resolves in the context
 * *is* a definition: the arrow labelled `g \circ f` abbreviates that composite.
 * A plain name is just a name. Two entry points differ deliberately:
 *
 *   syncDefinition  set-or-strip, for editing (add a morphism, rename one)
 *   inferDefinitions add-only, for importing (a stored definition is never
 *                    stripped just because its label no longer resolves)
 */
import type { MathContext, MathDocument, MorphismDecl, MorphismExpr, MorphismId } from './types.js';
import { MathError, getMorphism, morphismsOf, renameDeclaration } from './context.js';
import { definitionError, dependentsOf } from './unfold.js';
import { parseLabel, resolveLabel, isPlainName } from './label.js';
import { printLatex } from './print.js';

/** Sets (or, with `undefined`, strips) the definition of a morphism. Throws on an invalid definition. */
export function setMorphismDefinition(doc: MathDocument, id: MorphismId, def: MorphismExpr | undefined): MathDocument {
  const m = getMorphism(doc.context, id);
  if (!m) throw new MathError(`unknown morphism '${id}'`);
  if (def !== undefined) {
    const err = definitionError(doc.context, id, def);
    if (err) throw new MathError(`morphism '${id}': definition: ${err}`);
  }
  const { definition: _old, ...rest } = m;
  const next: MorphismDecl = def !== undefined ? { ...rest, definition: def } : rest;
  return {
    ...doc,
    context: { declarations: doc.context.declarations.map(d => (d.id === id ? next : d)) },
  };
}

/** What a morphism's label currently means. */
export type LabelStatus =
  | { kind: 'atomic' }
  | { kind: 'defined'; expr: MorphismExpr }
  | { kind: 'unresolved'; error: string };

/**
 * The expression a label denotes, or why it denotes nothing. `undefined` means
 * the label is a plain name (or unparsable), i.e. an atomic morphism.
 */
function definitionFromLabel(ctx: MathContext, m: MorphismDecl): { expr?: MorphismExpr; error?: string } {
  const parsed = parseLabel(m.name);
  if (!parsed.ok || isPlainName(parsed.ast)) return {};
  const resolved = resolveLabel(ctx, parsed.ast, {
    expected: { source: m.source, target: m.target },
    exclude: new Set([m.id]),
  });
  if (!resolved.ok) return { error: resolved.error };
  const err = definitionError(ctx, m.id, resolved.expr);
  if (err) return { error: err };
  return { expr: resolved.expr };
}

export function labelStatus(ctx: MathContext, id: MorphismId): LabelStatus {
  const m = getMorphism(ctx, id);
  if (!m) throw new MathError(`unknown morphism '${id}'`);
  if (m.definition) return { kind: 'defined', expr: m.definition };
  const { expr, error } = definitionFromLabel(ctx, m);
  if (expr) return { kind: 'defined', expr };
  if (error) return { kind: 'unresolved', error };
  return { kind: 'atomic' };
}

/**
 * Brings one morphism's definition in line with its label: a resolvable
 * composite or identity becomes the definition, anything else clears it.
 * Returns the same document when nothing changes.
 */
export function syncDefinition(doc: MathDocument, id: MorphismId): MathDocument {
  const m = getMorphism(doc.context, id);
  if (!m) throw new MathError(`unknown morphism '${id}'`);
  const { expr } = definitionFromLabel(doc.context, m);
  if (expr === undefined && m.definition === undefined) return doc;
  return setMorphismDefinition(doc, id, expr);
}

/**
 * Add-only sync over every morphism that has no definition yet. Used when
 * importing a diagram (legacy files, level givens, templates, `.cat` v0.2),
 * where a stored definition is authoritative and must not be stripped.
 */
export function inferDefinitions(doc: MathDocument): MathDocument {
  let next = doc;
  for (const m of morphismsOf(doc.context)) {
    if (m.definition !== undefined) continue;
    const { expr } = definitionFromLabel(next.context, m);
    if (expr) next = setMorphismDefinition(next, m.id, expr);
  }
  return next;
}

/**
 * Re-prints the labels of morphisms defined through `id` after it was renamed.
 * The definition is the truth; the label is derived from it.
 */
export function reprintDependents(doc: MathDocument, id: string): MathDocument {
  let next = doc;
  for (const dep of dependentsOf(doc.context, id)) {
    if (!dep.definition) continue;
    const label = printLatex(next.context, dep.definition);
    if (label !== dep.name) next = renameDeclaration(next, dep.id, label);
  }
  return next;
}
