import { describe, it, expect } from 'vitest';
import { emptyDocument, declareObject, declareMorphism, declareHypothesis, validateDocument } from '../context.js';
import { morphism, identity, compose } from '../expr.js';
import { fromDiagram } from '../fromDiagram.js';
import { entailment, entails } from '../entail.js';
import { inferDefinitions } from '../definitions.js';
import { addGoal, getGoal, tryCloseByEntailment, STEP_ENTAIL } from '../proof.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from './fixtures.js';

function square() {
  let doc = emptyDocument();
  for (const o of ['A', 'B', 'C', 'D']) [doc] = declareObject(doc, { name: o }, o);
  [doc] = declareMorphism(doc, { name: 'f', source: 'A', target: 'B' }, 'f');
  [doc] = declareMorphism(doc, { name: 'g', source: 'A', target: 'C' }, 'g');
  [doc] = declareMorphism(doc, { name: 'h', source: 'B', target: 'D' }, 'h');
  [doc] = declareMorphism(doc, { name: 'k', source: 'C', target: 'D' }, 'k');
  return doc;
}
const f = morphism('f'), g = morphism('g'), h = morphism('h'), k = morphism('k');
const fh = compose(f, h), gk = compose(g, k);
const eq = (left: typeof fh, right: typeof fh) => ({ kind: 'eq' as const, left, right });

describe('entailment', () => {
  it('is reflexive up to identities and associativity, using no hypotheses', () => {
    const ctx = square().context;
    expect(entailment(ctx, eq(fh, fh))).toEqual({ holds: true, by: [] });
    expect(entailment(ctx, eq(compose(f, identity('B'), h), fh))).toEqual({ holds: true, by: [] });
    expect(entailment(ctx, eq(compose(compose(f, h)), fh))).toEqual({ holds: true, by: [] });
  });

  it('uses a hypothesis in either orientation', () => {
    let doc = square();
    let h1: string;
    [doc, h1] = declareHypothesis(doc, { prop: eq(fh, gk) });
    expect(entailment(doc.context, eq(fh, gk))).toEqual({ holds: true, by: [h1] });
    expect(entailment(doc.context, eq(gk, fh))).toEqual({ holds: true, by: [h1] });
  });

  it('chains hypotheses transitively', () => {
    let doc = square();
    [doc] = declareMorphism(doc, { name: 'x', source: 'A', target: 'D' }, 'x');
    let h1: string, h2: string;
    [doc, h1] = declareHypothesis(doc, { prop: eq(fh, morphism('x')) });
    [doc, h2] = declareHypothesis(doc, { prop: eq(morphism('x'), gk) });
    const r = entailment(doc.context, eq(fh, gk));
    expect(r).toEqual({ holds: true, by: [h1, h2] });
  });

  it('identifies a defined morphism with its unfolding without any hypothesis', () => {
    const doc = inferDefinitions({ ...emptyDocument(), context: fromDiagram(DEFAULT_NODES, DEFAULT_EDGES).context });
    const composite = compose(morphism('f1'), morphism('f2'));
    expect(entailment(doc.context, eq(morphism('f3'), composite))).toEqual({ holds: true, by: [] });
    expect(entails(doc.context, eq(composite, morphism('f3')))).toBe(true);
  });

  it('does not invent equalities', () => {
    const ctx = square().context;
    expect(entailment(ctx, eq(fh, gk))).toEqual({ holds: false });
    expect(entails(ctx, eq(fh, gk))).toBe(false);
  });

  it('rejects a non-parallel proposition with an explanation', () => {
    const r = entailment(square().context, eq(f, g));
    expect(r.holds).toBe(false);
    expect(r.holds ? '' : r.error).toMatch(/not parallel/);
  });

  it('ignores hypotheses that are not parallel to the goal', () => {
    let doc = square();
    [doc] = declareMorphism(doc, { name: 'u', source: 'A', target: 'B' }, 'u');
    [doc] = declareHypothesis(doc, { prop: eq(f, morphism('u')) });
    // The A→B equation says nothing about the A→D pair.
    expect(entailment(doc.context, eq(fh, gk))).toEqual({ holds: false });
  });
});

describe('tryCloseByEntailment', () => {
  it('closes a goal as believed and records the hypotheses used', () => {
    let doc = square();
    let h1: string, gid: string;
    [doc, h1] = declareHypothesis(doc, { prop: eq(fh, gk) });
    [doc, gid] = addGoal(doc, eq(fh, gk));
    const { doc: closed, closed: ok } = tryCloseByEntailment(doc, gid);
    expect(ok).toBe(true);
    const status = getGoal(closed, gid)!.status;
    expect(status.kind).toBe('believed');
    const step = closed.steps.find(s => s.id === (status.kind === 'believed' ? status.by : ''))!;
    expect(step.kind).toBe(STEP_ENTAIL);
    expect(step.inputs).toEqual([gid, h1]);
    expect(validateDocument(closed)).toEqual([]);
    expect(tryCloseByEntailment(closed, gid).closed).toBe(false);
  });

  it('leaves an unentailed goal open', () => {
    let doc = square();
    let gid: string;
    [doc, gid] = addGoal(doc, eq(fh, gk));
    const { doc: after, closed } = tryCloseByEntailment(doc, gid);
    expect(closed).toBe(false);
    expect(getGoal(after, gid)!.status.kind).toBe('open');
    expect(after.steps).toEqual([]);
  });

  it('does not perform congruence (documented limitation)', () => {
    let doc = square();
    [doc] = declareObject(doc, { name: 'E' }, 'E');
    [doc] = declareMorphism(doc, { name: 'x', source: 'D', target: 'E' }, 'x');
    [doc] = declareHypothesis(doc, { prop: eq(fh, gk) });
    const x = morphism('x');
    expect(entails(doc.context, eq(compose(f, h, x), compose(g, k, x)))).toBe(false);
  });
});
