import { describe, it, expect } from 'vitest';
import { parallelPairs, isCommuting, markCommuting, unmarkCommuting, toggleCommuting, commutingEdgeIds } from '../commute.js';
import { addMorphism, deleteElements } from '../state.js';
import { declareHypothesis, hypothesesOf } from '../../math/context.js';
import { morphism, compose } from '../../math/expr.js';
import { printProposition } from '../../math/print.js';
import { defaults, square } from './fixtures.js';

describe('parallelPairs', () => {
  it('finds the A→C pair on the defaults and A→D on the square', () => {
    expect(parallelPairs(defaults())).toEqual([{ src: 'A', tgt: 'C', paths: [['f1', 'f2'], ['f3']] }]);
    expect(parallelPairs(square())).toEqual([{ src: 'A', tgt: 'D', paths: [['f', 'h'], ['g', 'k']] }]);
  });
});

describe('mark / unmark / toggle on the square', () => {
  it('marking adds one equation h ∘ f = k ∘ g', () => {
    const s = markCommuting(square(), 'A', 'D');
    const hyps = hypothesesOf(s.doc.context);
    expect(hyps).toHaveLength(1);
    expect(printProposition(s.doc.context, hyps[0]!.prop, 'classical')).toBe('h ∘ f = k ∘ g');
    expect(isCommuting(s, 'A', 'D')).toBe(true);
    expect([...commutingEdgeIds(s)].sort()).toEqual(['f', 'g', 'h', 'k']);
  });

  it('is not commuting before marking and marking twice adds nothing', () => {
    const s0 = square();
    expect(isCommuting(s0, 'A', 'D')).toBe(false);
    const s1 = markCommuting(s0, 'A', 'D');
    const s2 = markCommuting(s1, 'A', 'D');
    expect(s2).toBe(s1);
  });

  it('unmarking removes the equation; toggling twice restores the original document', () => {
    const s0 = square();
    const s1 = toggleCommuting(s0, 'A', 'D');
    const s2 = toggleCommuting(s1, 'A', 'D');
    expect(hypothesesOf(s2.doc.context)).toEqual([]);
    expect(unmarkCommuting(s0, 'A', 'D')).toBe(s0);
    expect(commutingEdgeIds(s2).size).toBe(0);
  });
});

describe('more than two paths', () => {
  function threePaths() {
    let s = square();
    [s] = addMorphism(s, { src: 'A', tgt: 'D', name: 'd' });
    return s;
  }

  it('marking three paths adds two chained equations', () => {
    const s = markCommuting(threePaths(), 'A', 'D');
    expect(hypothesesOf(s.doc.context)).toHaveLength(2);
    expect(isCommuting(s, 'A', 'D')).toBe(true);
  });

  it('a new path un-commutes the pair and re-marking adds exactly one equation', () => {
    let s = markCommuting(square(), 'A', 'D');
    let e: string;
    [s, e] = addMorphism(s, { src: 'A', tgt: 'D', name: 'e' });
    expect(isCommuting(s, 'A', 'D')).toBe(false);
    s = markCommuting(s, 'A', 'D');
    expect(hypothesesOf(s.doc.context)).toHaveLength(2);
    expect(isCommuting(s, 'A', 'D')).toBe(true);
    s = deleteElements(s, { edgeIds: [e] });
    expect(hypothesesOf(s.doc.context)).toHaveLength(1);
    expect(isCommuting(s, 'A', 'D')).toBe(true);
  });

  it('accepts equations in mixed orientation via transitivity', () => {
    let s = square();
    let dId: string;
    [s, dId] = addMorphism(s, { src: 'A', tgt: 'D', name: 'd' });
    const fh = compose(morphism('f'), morphism('h'));
    const gk = compose(morphism('g'), morphism('k'));
    const d = morphism(dId);
    let doc = s.doc;
    [doc] = declareHypothesis(doc, { prop: { kind: 'eq', left: gk, right: fh } });
    [doc] = declareHypothesis(doc, { prop: { kind: 'eq', left: d, right: gk } });
    s = { ...s, doc };
    expect(isCommuting(s, 'A', 'D')).toBe(true);
    expect(markCommuting(s, 'A', 'D')).toBe(s);
  });
});
