import { describe, it, expect } from 'vitest';
import { assignLeanNames, isLeanIdent, leanIdent } from '../names.js';
import { emptyDocument, declareObject, declareMorphism, declareHypothesis } from '../../math/context.js';
import { morphism, compose, identity } from '../../math/expr.js';
import { setMorphismDefinition } from '../../math/definitions.js';
import { defaults, square } from '../../diagram/__tests__/fixtures.js';
import { markCommuting } from '../../diagram/commute.js';

describe('isLeanIdent', () => {
  it('accepts what Lean accepts', () => {
    for (const s of ['f', 'A', 'π₁', "f'", 'h_1', 'id_A', '𝒞', 'x?']) expect(isLeanIdent(s), s).toBe(true);
  });

  it('rejects what Lean rejects', () => {
    for (const s of ['', '1f', 'A B', 'g∘f', 'A×B', 'Prod.fst', 'λ']) expect(isLeanIdent(s), s).toBe(false);
  });
});

describe('leanIdent', () => {
  const cases: [string, string][] = [
    ['f', 'f'],
    ['A', 'A'],
    ['C', 'C'],
    ['\\pi_1', 'π₁'],
    ['\\pi_{12}', 'π₁₂'],
    ['A \\times B', 'A_x_B'],
    ['A \\sqcup B', 'A_sum_B'],
    ['\\ker f', 'ker_f'],
    ['\\mathrm{coker}\\, f', 'coker_f'],
    ['\\tilde{f}', 'f_tilde'],
    ['\\overline{g}', 'g_bar'],
    ['f^{-1}', 'f_inv'],
    ['\\lambda', 'lam'],
    ['\\Sigma', 'Sigma'],
    ['\\varphi', 'φ'],
    ['\\mathcal{C}', 'C'],
    ['1', 'x1'],
    ['by', "by'"],
    ['Type', "Type'"],
    ["f'", "f'"],
  ];
  for (const [input, expected] of cases) {
    it(`${input} maps to ${expected}`, () => expect(leanIdent(input, 'morphism')).toBe(expected));
  }

  it('falls back by kind when nothing survives', () => {
    expect(leanIdent('   ', 'object')).toBe('X');
    expect(leanIdent('', 'morphism')).toBe('f');
    expect(leanIdent('{}', 'hypothesis')).toBe('h');
  });

  it('escapes keywords but leaves generator names to the collision pass', () => {
    expect(leanIdent('by', 'morphism')).toBe("by'");   // `by` can never be an identifier
    expect(leanIdent('id', 'morphism')).toBe('id');    // legal on its own; numbered if taken
  });
});

describe('assignLeanNames', () => {
  it('names the editor defaults, synthesizing the composite', () => {
    const names = assignLeanNames(defaults().doc.context);
    expect([...names.byId.values()]).toEqual(['A', 'B', 'C', 'f', 'g', 'gf']);
    expect(names.category).toBe('𝒞');
  });

  it('numbers hypotheses without colliding with a morphism named h', () => {
    const s = markCommuting(square(), 'A', 'D');
    const names = assignLeanNames(s.doc.context);
    expect(names.byId.get('h')).toBe('h');
    const hyp = s.doc.context.declarations.find(d => d.kind === 'hypothesis')!;
    expect(names.byId.get(hyp.id)).toBe('h₁');
  });

  it('resolves collisions with numeric suffixes, in declaration order', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A' }, 'o1');
    [doc] = declareObject(doc, { name: 'A' }, 'o2');
    [doc] = declareObject(doc, { name: '\\mathrm{A}' }, 'o3');
    const names = assignLeanNames(doc.context);
    expect([names.byId.get('o1'), names.byId.get('o2'), names.byId.get('o3')]).toEqual(['A', 'A_2', 'A_3']);
  });

  it('keeps an auto-numbered hypothesis clear of a morphism already called h₁', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A' }, 'A');
    [doc] = declareMorphism(doc, { name: 'h_1', source: 'A', target: 'A' }, 'm1');
    [doc] = declareHypothesis(doc, { prop: { kind: 'eq', left: morphism('m1'), right: morphism('m1') } }, 'hyp');
    const names = assignLeanNames(doc.context);
    expect(names.byId.get('m1')).toBe('h₁');
    expect(names.byId.get('hyp')).toBe('h₁_2');
  });

  it('never collides with the category variable or the universes', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'u' }, 'o2');
    [doc] = declareObject(doc, { name: '𝒞' }, 'o3');
    const names = assignLeanNames(doc.context);
    expect(names.byId.get('o2')).toBe('u_2');
    expect(names.byId.get('o3')).toBe('𝒞_2');
  });

  it('uses an explicit const reference when it is an identifier', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A \\times B', lean: { kind: 'const', name: 'AxB' } }, 'o1');
    [doc] = declareObject(doc, { name: 'P', lean: { kind: 'const', name: 'Prod.fst' } }, 'o2');
    const names = assignLeanNames(doc.context);
    expect(names.byId.get('o1')).toBe('AxB');
    expect(names.byId.get('o2')).toBe('P');   // dotted: not an identifier, so derived
  });

  it('synthesizes an identity name from its object', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A' }, 'A');
    [doc] = declareMorphism(doc, { name: '\\mathrm{id}_A', source: 'A', target: 'A' }, 'loop');
    doc = setMorphismDefinition(doc, 'loop', identity('A'));
    expect(assignLeanNames(doc.context).byId.get('loop')).toBe('id_A');
  });

  it('joins multi-character factors with an underscore', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A' }, 'A');
    [doc] = declareObject(doc, { name: 'B' }, 'B');
    [doc] = declareObject(doc, { name: 'C' }, 'C');
    [doc] = declareMorphism(doc, { name: '\\pi_1', source: 'A', target: 'B' }, 'p');
    [doc] = declareMorphism(doc, { name: 'q', source: 'B', target: 'C' }, 'q');
    [doc] = declareMorphism(doc, { name: 'q \\circ \\pi_1', source: 'A', target: 'C' }, 'comp');
    doc = setMorphismDefinition(doc, 'comp', compose(morphism('p'), morphism('q')));
    expect(assignLeanNames(doc.context).byId.get('comp')).toBe('q_π₁');
  });

  it('is deterministic', () => {
    const ctx = markCommuting(square(), 'A', 'D').doc.context;
    expect([...assignLeanNames(ctx).byId]).toEqual([...assignLeanNames(ctx).byId]);
  });
});
