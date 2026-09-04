import { describe, it, expect } from 'vitest';
import { emptyDocument, declareObject, declareMorphism } from '../context.js';
import { fromDiagram } from '../fromDiagram.js';
import { morphism, identity, compose } from '../expr.js';
import { printClassical, printProposition } from '../print.js';
import { parseLabel, resolveLabel, resolveLabelText, parsePropositionText, nameKey, isPlainName } from '../label.js';
import type { LabelAst } from '../label.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from './fixtures.js';

const name = (text: string): LabelAst => ({ kind: 'name', text });
const ast = (text: string): LabelAst => {
  const r = parseLabel(text);
  if (!r.ok) throw new Error(r.error);
  return r.ast;
};
const err = (text: string): string => {
  const r = parseLabel(text);
  return r.ok ? 'OK' : r.error;
};

describe('parseLabel', () => {
  it('reads classical composition into diagrammatic order', () => {
    expect(ast('g \\circ f')).toEqual({ kind: 'compose', factors: [name('f'), name('g')] });
    expect(ast('g∘f')).toEqual({ kind: 'compose', factors: [name('f'), name('g')] });
    expect(ast('h \\circ g \\circ f')).toEqual({ kind: 'compose', factors: [name('f'), name('g'), name('h')] });
  });

  it('reads diagrammatic composition as written', () => {
    expect(ast('f \\gg g')).toEqual({ kind: 'compose', factors: [name('f'), name('g')] });
    expect(ast('f ≫ g')).toEqual({ kind: 'compose', factors: [name('f'), name('g')] });
  });

  it('nests parentheses', () => {
    expect(ast('h \\circ (g \\circ f)')).toEqual({
      kind: 'compose', factors: [{ kind: 'compose', factors: [name('f'), name('g')] }, name('h')],
    });
    expect(ast('(h \\circ g) \\circ f')).toEqual({
      kind: 'compose', factors: [name('f'), { kind: 'compose', factors: [name('g'), name('h')] }],
    });
  });

  it('recognises every identity spelling', () => {
    for (const s of ['\\mathrm{id}_A', '\\mathrm{id}_{A}', 'id_A', '1_A', '𝟙 A', '\\operatorname{id}_A', '\\text{id}_A', '\\mathbb{1}_A']) {
      expect(ast(s), s).toEqual({ kind: 'identity', object: 'A' });
    }
    expect(ast('\\mathrm{id}')).toEqual({ kind: 'identity' });
    expect(ast('id')).toEqual({ kind: 'identity' });
    expect(ast('\\mathrm{id}_{A \\times B}')).toEqual({ kind: 'identity', object: 'A \\times B' });
  });

  it('treats LaTeX names as single atoms', () => {
    expect(ast('\\pi_1')).toEqual(name('\\pi_1'));
    expect(ast('\\tilde{f}')).toEqual(name('\\tilde{f}'));
    expect(ast("f'")).toEqual(name("f'"));
    expect(ast('\\circled')).toEqual(name('\\circled'));
    expect(ast('identity')).toEqual(name('identity'));
    expect(ast('\\iota')).toEqual(name('\\iota'));
    expect(isPlainName(ast('f'))).toBe(true);
    expect(isPlainName(ast('g \\circ f'))).toBe(false);
  });

  it('rejects malformed labels', () => {
    expect(err('')).toBe('empty label');
    expect(err('   ')).toBe('empty label');
    expect(err('g \\circ')).toMatch(/expected a morphism/);
    expect(err('\\circ f')).toMatch(/expected a morphism/);
    expect(err('(g \\circ f')).toMatch(/parentheses/);
    expect(err('g \\circ f)')).toMatch(/parentheses/);
    expect(err('\\tilde{f')).toMatch(/braces/);
    expect(err('g \\circ f \\gg h')).toMatch(/mixed/);
    expect(err('g f')).toBe('OK'); // a single odd name, not an error
  });
});

function defaults() {
  return fromDiagram(DEFAULT_NODES, DEFAULT_EDGES).context;
}
const f1 = morphism('f1'), f2 = morphism('f2');

describe('resolveLabel', () => {
  it('resolves names to ids and checks the expected endpoints', () => {
    const ctx = defaults();
    const r = resolveLabel(ctx, ast('g \\circ f'), { expected: { source: 'A', target: 'C' } });
    expect(r).toEqual({ ok: true, expr: compose(f1, f2) });
    expect(resolveLabelText(ctx, 'f \\gg g')).toEqual({ ok: true, expr: compose(f1, f2) });
    const wrong = resolveLabel(ctx, ast('g \\circ f'), { expected: { source: 'A', target: 'B' } });
    expect(wrong.ok ? 'OK' : wrong.error).toBe('expected A → B, got A → C');
  });

  it('reports ill-typed, unknown, and ambiguous names', () => {
    const ctx = defaults();
    const bad = resolveLabelText(ctx, 'f \\circ g');
    expect(bad.ok ? 'OK' : bad.error).toMatch(/cannot compose/);
    const unknown = resolveLabelText(ctx, 'g \\circ x');
    expect(unknown.ok ? 'OK' : unknown.error).toBe("unknown morphism 'x'");
    let doc = { ...emptyDocument(), context: ctx };
    [doc] = declareMorphism(doc, { name: 'f', source: 'A', target: 'B' }, 'dup');
    const amb = resolveLabelText(doc.context, 'g \\circ f');
    expect(amb.ok ? 'OK' : amb.error).toBe("ambiguous name 'f'");
  });

  it('excludes the morphism being labelled from name lookup', () => {
    let doc = { ...emptyDocument(), context: defaults() };
    [doc] = declareMorphism(doc, { name: 'f', source: 'A', target: 'B' }, 'self');
    const r = resolveLabelText(doc.context, 'f', { exclude: new Set(['self']) });
    expect(r).toEqual({ ok: true, expr: f1 });
  });

  it('resolves identities by object name, whitespace-insensitively', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A' }, 'A');
    [doc] = declareObject(doc, { name: 'A \\times B' }, 'P');
    expect(resolveLabelText(doc.context, '\\mathrm{id}_A')).toEqual({ ok: true, expr: identity('A') });
    expect(resolveLabelText(doc.context, '\\mathrm{id}_{A\\times B}')).toEqual({ ok: true, expr: identity('P') });
    const unknown = resolveLabelText(doc.context, '\\mathrm{id}_X');
    expect(unknown.ok ? 'OK' : unknown.error).toBe("unknown object 'X'");
  });

  it('accepts a bare id only when the expected endpoints coincide', () => {
    const ctx = defaults();
    expect(resolveLabelText(ctx, 'id', { expected: { source: 'A', target: 'A' } })).toEqual({ ok: true, expr: identity('A') });
    const r = resolveLabelText(ctx, 'id', { expected: { source: 'A', target: 'B' } });
    expect(r.ok ? 'OK' : r.error).toMatch(/subscript/);
    const inner = resolveLabelText(ctx, 'g \\circ id \\circ f', { expected: { source: 'A', target: 'C' } });
    expect(inner.ok ? 'OK' : inner.error).toMatch(/subscript/);
    expect(resolveLabelText(ctx, 'g \\circ \\mathrm{id}_B \\circ f')).toEqual({ ok: true, expr: compose(f1, identity('B'), f2) });
  });

  it('nameKey ignores whitespace', () => {
    expect(nameKey(' g \\circ  f ')).toBe('g\\circf');
  });
});

describe('parsePropositionText', () => {
  function square() {
    let doc = emptyDocument();
    for (const o of ['A', 'B', 'C', 'D']) [doc] = declareObject(doc, { name: o }, o);
    [doc] = declareMorphism(doc, { name: 'f', source: 'A', target: 'B' }, 'f');
    [doc] = declareMorphism(doc, { name: 'g', source: 'A', target: 'C' }, 'g');
    [doc] = declareMorphism(doc, { name: 'h', source: 'B', target: 'D' }, 'h');
    [doc] = declareMorphism(doc, { name: 'k', source: 'C', target: 'D' }, 'k');
    return doc.context;
  }

  it('reads the I-4 equation', () => {
    const ctx = square();
    const r = parsePropositionText(ctx, 'h \\circ f = k \\circ g');
    expect(r.ok).toBe(true);
    if (r.ok) expect(printProposition(ctx, r.prop, 'classical')).toBe('h ∘ f = k ∘ g');
  });

  it('rejects non-parallel sides and malformed equations', () => {
    const ctx = square();
    const np = parsePropositionText(ctx, 'f = g');
    expect(np.ok ? 'OK' : np.error).toMatch(/not parallel/);
    const two = parsePropositionText(ctx, 'f = g = h');
    expect(two.ok ? 'OK' : two.error).toMatch(/exactly one/);
    const none = parsePropositionText(ctx, 'f');
    expect(none.ok ? 'OK' : none.error).toMatch(/exactly one/);
    const unk = parsePropositionText(ctx, 'h \\circ f = x');
    expect(unk.ok ? 'OK' : unk.error).toBe("right side: unknown morphism 'x'");
    expect(printClassical(ctx, compose(morphism('f'), morphism('h')))).toBe('h ∘ f');
  });
});
