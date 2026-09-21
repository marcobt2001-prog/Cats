/**
 * LaTeX labels → Lean identifiers.
 *
 * CATS names are display strings (`\pi_1`, `A \times B`, `g \circ f`); Lean
 * needs identifiers. The mapping is pure and derived on every generation, never
 * stored: a rename changes the generated file, which is exactly what should
 * make an earlier check stale. A declaration carrying `lean: { kind: 'const' }`
 * overrides the derived name when that name is a legal identifier.
 */
import type { MathContext, MorphismDecl } from '../math/types.js';
import { objectsOf, morphismsOf, hypothesesOf } from '../math/context.js';
import { parseLabel } from '../math/label.js';

/** The category every object lives in. Chosen so an object may still be named `C`. */
export const CATEGORY_VAR = '𝒞';

export interface LeanNames {
  byId: Map<string, string>;
  category: string;
}

// ── Lean identifier characters ─────────────────────────────────────────────
// Lean 4 admits letterlike unicode in identifiers but excludes λ, Π and Σ
// because they are binder notation.
const EXCLUDED_GREEK = new Set(['λ', 'Π', 'Σ']);

function isLetterlike(c: string): boolean {
  const cp = c.codePointAt(0)!;
  if (EXCLUDED_GREEK.has(c)) return false;
  if (cp >= 0x3b1 && cp <= 0x3c9) return true;   // α-ω
  if (cp >= 0x391 && cp <= 0x3a9) return true;   // Α-Ω
  if (cp >= 0x2100 && cp <= 0x214f) return true; // letterlike symbols
  if (cp >= 0x1d49c && cp <= 0x1d59f) return true; // math alphanumerics (𝒞 …)
  return false;
}

function isIdFirst(c: string): boolean {
  return /[A-Za-z_]/.test(c) || isLetterlike(c);
}

function isIdRest(c: string): boolean {
  if (isIdFirst(c)) return true;
  if (/[0-9'!?]/.test(c)) return true;
  const cp = c.codePointAt(0)!;
  if (cp >= 0x2080 && cp <= 0x2089) return true; // subscript digits ₀-₉
  if (cp >= 0x2090 && cp <= 0x209c) return true; // subscript letters
  return false;
}

export function isLeanIdent(s: string): boolean {
  const chars = [...s];
  if (chars.length === 0) return false;
  if (!isIdFirst(chars[0]!)) return false;
  return chars.every(isIdRest);
}

// ── Reserved words ─────────────────────────────────────────────────────────
const LEAN_KEYWORDS = [
  'at', 'by', 'do', 'else', 'end', 'example', 'fun', 'have', 'if', 'in', 'let', 'match',
  'open', 'section', 'show', 'then', 'theorem', 'universe', 'variable', 'where', 'with',
  'from', 'import', 'def', 'instance', 'lemma', 'sorry', 'this', 'calc', 'namespace',
  'set_option', 'local', 'notation', 'include', 'omit', 'structure', 'class', 'inductive',
  'abbrev', 'axiom', 'opaque', 'macro', 'syntax', 'elab', 'attribute', 'private', 'protected',
  'noncomputable', 'partial', 'unsafe', 'mutual', 'deriving', 'Type', 'Prop', 'Sort',
  'True', 'False',
];
/** Names the generated file itself uses; shadowing them would break it. */
const GENERATOR_NAMES = [
  CATEGORY_VAR, 'Category', 'CategoryTheory', 'rfl', 'first', 'done', 'simp_all', 'only',
  'aesop_cat', 'id', 'Eq', 'u', 'v',
];
/** Keywords cannot be identifiers at all, so `leanIdent` escapes them with `'`. */
const LEAN_KEYWORD_SET = new Set(LEAN_KEYWORDS);
/** Everything a declaration must not claim; `assignLeanNames` numbers around these. */
const RESERVED = new Set([...LEAN_KEYWORDS, ...GENERATOR_NAMES]);

// ── LaTeX → identifier ─────────────────────────────────────────────────────
const FONT_WRAPPERS = /\\(?:mathrm|mathit|mathbf|mathsf|mathtt|mathcal|mathbb|mathfrak|text|operatorname)\s*\{([^{}]*)\}/g;
const ACCENTS: Record<string, string> = {
  tilde: 'tilde', widetilde: 'tilde', hat: 'hat', widehat: 'hat', bar: 'bar', overline: 'bar',
};
const ACCENT_RE = /\\(tilde|widetilde|hat|widehat|bar|overline)\s*\{([^{}]*)\}/g;

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ', mu: 'μ', nu: 'ν', xi: 'ξ',
  pi: 'π', varpi: 'π', rho: 'ρ', varrho: 'ρ', sigma: 'σ', varsigma: 'σ', tau: 'τ',
  upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Xi: 'Ξ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  // Lean excludes these three from identifiers, so spell them out.
  lambda: 'lam', Lambda: 'Lam', Pi: 'Pi', Sigma: 'Sigma',
};
const OPERATORS: Record<string, string> = {
  times: 'x', otimes: 'tensor', oplus: 'sum', coprod: 'coprod', sqcup: 'sum', circ: 'circ',
  cdot: 'dot', ast: 'star', star: 'star', to: 'to', mapsto: 'mapsto', sim: 'sim',
};

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

function subscriptDigits(digits: string): string {
  return [...digits].map(d => SUBSCRIPT_DIGITS[Number(d)]!).join('');
}

/**
 * A candidate identifier for one label. Not guaranteed unique; `assignLeanNames`
 * resolves collisions.
 */
export function leanIdent(raw: string, kind: 'object' | 'morphism' | 'hypothesis'): string {
  let s = raw.trim();

  // Font wrappers and accents, innermost first.
  for (let i = 0; i < 4 && FONT_WRAPPERS.test(s); i += 1) s = s.replace(FONT_WRAPPERS, '$1');
  s = s.replace(ACCENT_RE, (_m, acc: string, inner: string) => `${inner}_${ACCENTS[acc]}`);

  // Superscripts: the inverse is worth spelling, anything else becomes a suffix.
  s = s.replace(/\^\s*\{?\s*-\s*1\s*\}?/g, '_inv');
  s = s.replace(/\^\s*\{([^{}]*)\}/g, '_$1');
  s = s.replace(/\^\s*(\w)/g, '_$1');

  // Subscripts: all-digit ones become real subscript digits (π₁), others a suffix.
  s = s.replace(/_\s*\{([^{}]*)\}/g, (_m, inner: string) =>
    /^\d+$/.test(inner.trim()) ? subscriptDigits(inner.trim()) : `_${inner}`);
  s = s.replace(/_\s*(\d+)/g, (_m, d: string) => subscriptDigits(d));

  // Commands.
  s = s.replace(/\\([A-Za-z]+)/g, (_m, cmd: string) => {
    if (GREEK[cmd]) return GREEK[cmd]!;
    if (OPERATORS[cmd]) return `_${OPERATORS[cmd]!}_`;
    return `_${cmd}_`;
  });

  // Everything that cannot appear in an identifier.
  s = [...s].map(c => (isIdRest(c) ? c : '_')).join('');
  s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');

  if (s === '') s = kind === 'object' ? 'X' : kind === 'morphism' ? 'f' : 'h';
  if (!isIdFirst([...s][0]!)) s = `x${s}`;
  // A keyword must be escaped here; a name merely taken by another declaration
  // is left alone, because `assignLeanNames` numbers those.
  if (LEAN_KEYWORD_SET.has(s)) s = `${s}'`;
  return s;
}

// ── Assignment over a whole context ────────────────────────────────────────
/** The Lean name a defined morphism should get: `g \circ f` → `gf`, `\mathrm{id}_A` → `id_A`. */
function synthesizedName(ctx: MathContext, d: MorphismDecl): string | undefined {
  if (d.definition === undefined) return undefined;
  const parsed = parseLabel(d.name);
  if (!parsed.ok || parsed.ast.kind === 'name') return undefined;
  if (parsed.ast.kind === 'identity') {
    const obj = objectsOf(ctx).find(o => o.id === (d.definition!.kind === 'identity' ? d.definition!.object : ''));
    return obj ? `id_${leanIdent(obj.name, 'object')}` : undefined;
  }
  // Composite: name the factors in classical order, the way the label reads.
  const parts = parsed.ast.factors.map(f =>
    f.kind === 'name' ? leanIdent(f.text, 'morphism')
      : f.kind === 'identity' ? `id${f.object ? `_${leanIdent(f.object, 'object')}` : ''}`
      : '');
  if (parts.some(p => p === '')) return undefined;
  const classical = [...parts].reverse();
  return classical.every(p => [...p].length === 1) ? classical.join('') : classical.join('_');
}

/** Honour an explicit Lean reference when it is usable as an identifier. */
function override(lean: { kind: 'const'; name: string } | { kind: 'raw'; text: string } | undefined): string | undefined {
  if (lean?.kind === 'const' && isLeanIdent(lean.name)) return lean.name;
  return undefined;
}

/**
 * A Lean identifier for every declaration, collision-free and deterministic.
 * Objects first, then morphisms, then hypotheses, so the short names go to the
 * things a reader looks at most.
 */
export function assignLeanNames(ctx: MathContext): LeanNames {
  const byId = new Map<string, string>();
  const taken = new Set<string>(RESERVED);

  const claim = (id: string, candidate: string): void => {
    let name = candidate;
    for (let n = 2; taken.has(name); n += 1) name = `${candidate}_${n}`;
    taken.add(name);
    byId.set(id, name);
  };

  for (const o of objectsOf(ctx)) claim(o.id, override(o.lean) ?? leanIdent(o.name, 'object'));
  for (const m of morphismsOf(ctx)) {
    claim(m.id, override(m.lean) ?? synthesizedName(ctx, m) ?? leanIdent(m.name, 'morphism'));
  }
  let auto = 0;
  for (const h of hypothesesOf(ctx)) {
    auto += 1;
    const fallback = `h${subscriptDigits(String(auto))}`;
    claim(h.id, override(h.lean) ?? (h.name !== undefined ? leanIdent(h.name, 'hypothesis') : fallback));
  }

  return { byId, category: CATEGORY_VAR };
}
