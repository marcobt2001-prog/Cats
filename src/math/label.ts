/**
 * The label grammar: what a morphism label such as `g \circ f` or
 * `\mathrm{id}_A` means.
 *
 *   expr     := term (OP term)*        OP ∈ { \circ, ∘ } classical | { \gg, ≫ } diagrammatic
 *   term     := '(' expr ')' | atom
 *   atom     := identity | name
 *   identity := ( \mathrm{id} | \operatorname{id} | \text{id} | id | 1 | \mathbb{1} | 𝟙 ) subscript?
 *   name     := any other text (LaTeX allowed: \pi_1, f', \iota)
 *
 * Only characters at brace depth 0 are structural, so `\mathrm{id}_{A \times B}`
 * and `\tilde{f}` are single atoms. Classical operators reverse the factors into
 * the diagrammatic order the IR stores; mixing the two conventions at one level
 * is an error. A plain name is just a name: it never becomes a definition.
 *
 * Parsing yields an AST over *names*; resolving turns names into ids against a
 * context (whitespace-insensitive, must be unique).
 */
import type { MathContext, MorphismExpr, MorphismId, ObjectId, Proposition } from './types.js';
import { assertNever } from './types.js';
import { morphism, identity, compose, typeOf } from './expr.js';
import { objectsOf, morphismsOf, propositionError } from './context.js';

export type LabelAst =
  | { kind: 'name'; text: string }
  | { kind: 'identity'; object?: string }
  | { kind: 'compose'; factors: LabelAst[] }; // diagrammatic order

export type ParseResult = { ok: true; ast: LabelAst } | { ok: false; error: string };
export type ResolveResult = { ok: true; expr: MorphismExpr } | { ok: false; error: string };
export interface ResolveOptions {
  /** Endpoints the expression must have; also supplies the object for a bare `id`. */
  expected?: { source: ObjectId; target: ObjectId };
  /** Morphism ids that must not be matched by name (the morphism being labelled). */
  exclude?: ReadonlySet<MorphismId>;
}

/** The lookup key for names: whitespace is not significant in LaTeX-ish labels. */
export function nameKey(s: string): string {
  return s.replace(/\s+/g, '');
}

// ── Tokenizer ──────────────────────────────────────────────────────────────
type Token =
  | { t: 'op'; classical: boolean }
  | { t: '(' }
  | { t: ')' }
  | { t: 'text'; text: string };

function isLetter(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z]/.test(c);
}

function tokenize(text: string): { ok: true; tokens: Token[] } | { ok: false; error: string } {
  const tokens: Token[] = [];
  let buf = '';
  let depth = 0;
  const flush = (): void => {
    const s = buf.trim();
    if (s) tokens.push({ t: 'text', text: s });
    buf = '';
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === '{') { depth += 1; buf += c; continue; }
    if (c === '}') {
      depth -= 1;
      if (depth < 0) return { ok: false, error: 'unbalanced braces' };
      buf += c;
      continue;
    }
    if (depth > 0) { buf += c; continue; }
    if (c === '(') { flush(); tokens.push({ t: '(' }); continue; }
    if (c === ')') { flush(); tokens.push({ t: ')' }); continue; }
    if (c === '∘') { flush(); tokens.push({ t: 'op', classical: true }); continue; }
    if (c === '≫') { flush(); tokens.push({ t: 'op', classical: false }); continue; }
    if (c === '\\') {
      const rest = text.slice(i);
      const m = /^\\(circ|gg)(?![A-Za-z])/.exec(rest);
      if (m) {
        flush();
        tokens.push({ t: 'op', classical: m[1] === 'circ' });
        i += m[0].length - 1;
        continue;
      }
    }
    buf += c;
  }
  if (depth !== 0) return { ok: false, error: 'unbalanced braces' };
  flush();
  return { ok: true, tokens };
}

// ── Atoms ──────────────────────────────────────────────────────────────────
const IDENTITY_RE =
  /^(?:\\mathrm\{\s*id\s*\}|\\operatorname\{\s*id\s*\}|\\text\{\s*id\s*\}|id|1|\\mathbb\{1\}|𝟙)(?:\s*_\s*(?:\{(.*)\}|(\S+))|\s+(.+))?$/su;

function atom(text: string): LabelAst {
  const m = IDENTITY_RE.exec(text);
  if (!m) return { kind: 'name', text };
  const sub = m[1] ?? m[2] ?? m[3];
  if (sub === undefined) return { kind: 'identity' };
  return { kind: 'identity', object: sub.trim() };
}

// ── Parser ─────────────────────────────────────────────────────────────────
class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  peek(): Token | undefined { return this.tokens[this.pos]; }
  next(): Token | undefined { return this.tokens[this.pos++]; }
  done(): boolean { return this.pos >= this.tokens.length; }

  expr(): LabelAst {
    const factors: LabelAst[] = [this.term()];
    let classical: boolean | undefined;
    while (this.peek()?.t === 'op') {
      const op = this.next() as { t: 'op'; classical: boolean };
      if (classical === undefined) classical = op.classical;
      else if (classical !== op.classical) throw new Error('mixed ∘ and ≫ in one expression');
      factors.push(this.term());
    }
    if (factors.length === 1) return factors[0]!;
    return { kind: 'compose', factors: classical ? [...factors].reverse() : factors };
  }

  term(): LabelAst {
    const tok = this.next();
    if (!tok) throw new Error('expected a morphism');
    switch (tok.t) {
      case '(': {
        const inner = this.expr();
        if (this.next()?.t !== ')') throw new Error('unbalanced parentheses');
        return inner;
      }
      case 'text':
        return atom(tok.text);
      case ')':
        throw new Error('unbalanced parentheses');
      case 'op':
        throw new Error('expected a morphism before the operator');
      default:
        return assertNever(tok);
    }
  }
}

export function parseLabel(text: string): ParseResult {
  const tk = tokenize(text);
  if (!tk.ok) return tk;
  if (tk.tokens.length === 0) return { ok: false, error: 'empty label' };
  const p = new Parser(tk.tokens);
  try {
    const ast = p.expr();
    if (!p.done()) throw new Error(p.peek()?.t === ')' ? 'unbalanced parentheses' : 'unexpected trailing text');
    return { ok: true, ast };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function isPlainName(ast: LabelAst): boolean {
  return ast.kind === 'name';
}

// ── Resolver ───────────────────────────────────────────────────────────────
function objectName(ctx: MathContext, id: ObjectId): string {
  return objectsOf(ctx).find(o => o.id === id)?.name ?? id;
}

function resolveAst(ctx: MathContext, ast: LabelAst, opts: ResolveOptions, top: boolean): ResolveResult {
  switch (ast.kind) {
    case 'name': {
      const key = nameKey(ast.text);
      const found = morphismsOf(ctx).filter(m => nameKey(m.name) === key && !(opts.exclude?.has(m.id) ?? false));
      if (found.length === 0) return { ok: false, error: `unknown morphism '${ast.text}'` };
      if (found.length > 1) return { ok: false, error: `ambiguous name '${ast.text}'` };
      return { ok: true, expr: morphism(found[0]!.id) };
    }
    case 'identity': {
      if (ast.object !== undefined) {
        const key = nameKey(ast.object);
        const found = objectsOf(ctx).filter(o => nameKey(o.name) === key);
        if (found.length === 0) return { ok: false, error: `unknown object '${ast.object}'` };
        if (found.length > 1) return { ok: false, error: `ambiguous object name '${ast.object}'` };
        return { ok: true, expr: identity(found[0]!.id) };
      }
      const exp = opts.expected;
      if (top && exp && exp.source === exp.target) return { ok: true, expr: identity(exp.source) };
      return { ok: false, error: 'identity needs a subscript, e.g. \\mathrm{id}_A' };
    }
    case 'compose': {
      const factors: MorphismExpr[] = [];
      for (const f of ast.factors) {
        const r = resolveAst(ctx, f, opts, false);
        if (!r.ok) return r;
        factors.push(r.expr);
      }
      return { ok: true, expr: compose(...factors) };
    }
    default:
      return assertNever(ast);
  }
}

/** Names → ids, then type-checks; with `expected`, the endpoints must match. */
export function resolveLabel(ctx: MathContext, ast: LabelAst, opts: ResolveOptions = {}): ResolveResult {
  const r = resolveAst(ctx, ast, opts, true);
  if (!r.ok) return r;
  const t = typeOf(ctx, r.expr);
  if (!t.ok) return { ok: false, error: t.error };
  const exp = opts.expected;
  if (exp && (t.source !== exp.source || t.target !== exp.target)) {
    return {
      ok: false,
      error:
        `expected ${objectName(ctx, exp.source)} → ${objectName(ctx, exp.target)}, ` +
        `got ${objectName(ctx, t.source)} → ${objectName(ctx, t.target)}`,
    };
  }
  return r;
}

export function resolveLabelText(ctx: MathContext, text: string, opts: ResolveOptions = {}): ResolveResult {
  const p = parseLabel(text);
  if (!p.ok) return p;
  return resolveLabel(ctx, p.ast, opts);
}

/** `lhs = rhs` with one `=` at brace depth 0; both sides resolved and checked parallel. */
export function parsePropositionText(
  ctx: MathContext,
  text: string,
): { ok: true; prop: Proposition } | { ok: false; error: string } {
  const splits: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '=' && depth === 0) splits.push(i);
  }
  if (splits.length !== 1) return { ok: false, error: 'expected exactly one \'=\'' };
  const at = splits[0]!;
  const left = resolveLabelText(ctx, text.slice(0, at));
  if (!left.ok) return { ok: false, error: `left side: ${left.error}` };
  const right = resolveLabelText(ctx, text.slice(at + 1));
  if (!right.ok) return { ok: false, error: `right side: ${right.error}` };
  const prop: Proposition = { kind: 'eq', left: left.expr, right: right.expr };
  const err = propositionError(ctx, prop);
  if (err) return { ok: false, error: err };
  return { ok: true, prop };
}
