import { describe, it, expect } from 'vitest';
import type { GoalStatus } from '../types.js';
import { emptyDocument, declareObject, declareMorphism, validateDocument, MathError } from '../context.js';
import { morphism, identity, compose } from '../expr.js';
import { addGoal, addStep, setGoalStatus, tryCloseByNormalization, getGoal, STEP_REFL_NORMALIZE } from '../proof.js';

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

describe('goals and steps', () => {
  it('rejects an ill-typed goal', () => {
    expect(() => addGoal(square(), { kind: 'eq', left: f, right: g })).toThrow(MathError);
  });

  it('adds an open goal and a step with generated ids', () => {
    let doc = square();
    let gid: string, sid: string;
    [doc, gid] = addGoal(doc, { kind: 'eq', left: compose(f, h), right: compose(g, k) });
    [doc, sid] = addStep(doc, { kind: 'note', inputs: [gid], outputs: [] });
    expect(getGoal(doc, gid)?.status).toEqual({ kind: 'open' });
    expect(doc.steps.map(s => s.id)).toEqual([sid]);
    expect(validateDocument(doc)).toEqual([]);
  });
});

describe('tryCloseByNormalization', () => {
  it('closes g∘id∘f = g∘f as believed, recording the step', () => {
    let doc = square();
    let gid: string;
    [doc, gid] = addGoal(doc, { kind: 'eq', left: compose(f, identity('B'), h), right: compose(f, h) });
    const r = tryCloseByNormalization(doc, gid);
    expect(r.closed).toBe(true);
    const goal = getGoal(r.doc, gid)!;
    expect(goal.status.kind).toBe('believed');
    const step = r.doc.steps[0]!;
    expect(step.kind).toBe(STEP_REFL_NORMALIZE);
    expect(step.inputs).toEqual([gid]);
    if (goal.status.kind === 'believed') expect(goal.status.by).toBe(step.id);
    expect(validateDocument(r.doc)).toEqual([]);
  });

  it('leaves a genuinely non-trivial square open', () => {
    let doc = square();
    let gid: string;
    [doc, gid] = addGoal(doc, { kind: 'eq', left: compose(f, h), right: compose(g, k) });
    const r = tryCloseByNormalization(doc, gid);
    expect(r.closed).toBe(false);
    expect(r.doc).toBe(doc);
    expect(getGoal(r.doc, gid)?.status).toEqual({ kind: 'open' });
  });

  it('does nothing to a goal that is not open', () => {
    let doc = square();
    let gid: string;
    [doc, gid] = addGoal(doc, { kind: 'eq', left: f, right: f });
    doc = setGoalStatus(doc, gid, { kind: 'failed', authority: 'cats', message: 'x' });
    expect(tryCloseByNormalization(doc, gid).closed).toBe(false);
  });
});

describe('verified status is Lean-only by construction', () => {
  it('round-trips through setGoalStatus when supplied by an external authority', () => {
    let doc = square();
    let gid: string;
    [doc, gid] = addGoal(doc, { kind: 'eq', left: f, right: f });
    const verified: GoalStatus = { kind: 'verified', authority: 'lean' };
    doc = setGoalStatus(doc, gid, verified);
    expect(getGoal(doc, gid)?.status).toEqual(verified);
  });

  it('cannot be constructed with any other authority (type-level)', () => {
    // @ts-expect-error 'cats' is not an allowed authority for 'verified'
    const bad: GoalStatus = { kind: 'verified', authority: 'cats' };
    expect(bad).toBeTruthy();
  });
});
