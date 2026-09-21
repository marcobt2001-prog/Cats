import { describe, it, expect } from 'vitest';
import { applyLeanResult, leanCheckOf, isStale, leanViewOf, STEP_LEAN_CHECK } from '../apply.js';
import { generateLean } from '../generate.js';
import { summarize } from '../diagnostics.js';
import type { LeanRaw } from '../diagnostics.js';
import { square } from '../../diagram/__tests__/fixtures.js';
import { markCommuting, unmarkCommuting } from '../../diagram/commute.js';
import { renameMorphism, deleteElements } from '../../diagram/state.js';
import { addGoal, getGoal, tryCloseByEntailment } from '../../math/proof.js';
import { validateDocument } from '../../math/context.js';
import { serializeCat, deserializeCat } from '../../diagram/serialize.js';
import { morphism, compose } from '../../math/expr.js';

const f = morphism('f'), g = morphism('g'), h = morphism('h'), k = morphism('k');

/** The marked I-4 square with its equation as a goal, in diagram state. */
function marked() {
  const s = markCommuting(square(), 'A', 'D');
  const [doc] = addGoal(s.doc, { kind: 'eq', left: compose(f, h), right: compose(g, k) }, 'q1');
  return { ...s, doc };
}

function raw(over: Partial<LeanRaw> = {}): LeanRaw {
  return { stdout: '', stderr: '', exitCode: 0, timedOut: false, command: 'lake env lean', ...over };
}

const success = summarize(raw(), 3200);

describe('applyLeanResult', () => {
  it('writes the one status only Lean may write, with the step that records it', () => {
    const s = marked();
    const gen = generateLean(s.doc);
    const doc = applyLeanResult(s.doc, gen, success);

    const status = getGoal(doc, 'q1')!.status;
    expect(status).toMatchObject({ kind: 'verified', authority: 'lean', message: 'checked in 3.2 s' });

    const step = leanCheckOf(doc, 'q1')!;
    expect(step.kind).toBe(STEP_LEAN_CHECK);
    expect(step.inputs).toEqual(['q1']);
    expect(step.generatedLean).toContain('example (h₁ : f ≫ h = g ≫ k) : f ≫ h = g ≫ k := by');
    if ('by' in status) expect(status.by).toBe(step.id);
    expect(validateDocument(doc)).toEqual([]);
  });

  it('records a failure with Lean\'s own message', () => {
    const s = marked();
    const gen = generateLean(s.doc);
    const result = summarize(
      raw({ stdout: `check.lean:${gen.goals[0]!.line}:2: error: unsolved goals`, exitCode: 1 }),
      900,
    );
    const doc = applyLeanResult(s.doc, gen, result);
    expect(getGoal(doc, 'q1')!.status).toMatchObject({
      kind: 'failed', authority: 'lean', message: 'Lean: unsolved goals',
    });
    expect(validateDocument(doc)).toEqual([]);
  });

  it('replaces an earlier check rather than piling them up', () => {
    const s = marked();
    const gen = generateLean(s.doc);
    let doc = applyLeanResult(s.doc, gen, success);
    doc = applyLeanResult(doc, generateLean(doc), summarize(raw(), 2100));
    expect(doc.steps.filter(st => st.kind === STEP_LEAN_CHECK)).toHaveLength(1);
    expect(getGoal(doc, 'q1')!.status).toMatchObject({ message: 'checked in 2.1 s' });
    expect(validateDocument(doc)).toEqual([]);
  });

  it('leaves a goal that no longer exists alone', () => {
    const s = marked();
    const gen = generateLean(s.doc);
    const without = { ...s.doc, goals: [] };
    expect(applyLeanResult(without, gen, success)).toBe(without);
  });

  it('does not disturb what CATS believed on its own', () => {
    const s = marked();
    const believed = tryCloseByEntailment(s.doc, 'q1').doc;
    expect(getGoal(believed, 'q1')!.status.kind).toBe('believed');
    expect(leanViewOf(believed, 'q1')).toEqual({ kind: 'believed' });
  });

  it('survives a save and load', () => {
    const s = marked();
    const doc = applyLeanResult(s.doc, generateLean(s.doc), success);
    const { state } = deserializeCat(serializeCat({ ...s, doc }));
    expect(getGoal(state.doc, 'q1')!.status).toMatchObject({ kind: 'verified', authority: 'lean' });
    expect(leanCheckOf(state.doc, 'q1')!.generatedLean).toBe(leanCheckOf(doc, 'q1')!.generatedLean);
  });
});

describe('staleness', () => {
  it('is false right after a check', () => {
    const s = marked();
    const doc = applyLeanResult(s.doc, generateLean(s.doc), success);
    expect(isStale(doc, 'q1')).toBe(false);
    expect(leanViewOf(doc, 'q1').kind).toBe('verified');
  });

  it('is true after renaming a morphism the proof mentions', () => {
    const s = marked();
    const checked = { ...s, doc: applyLeanResult(s.doc, generateLean(s.doc), success) };
    const renamed = renameMorphism(checked, 'f', '\\phi');
    expect(isStale(renamed.doc, 'q1')).toBe(true);
    expect(leanViewOf(renamed.doc, 'q1').kind).toBe('stale');
  });

  it('is true after the hypothesis it relied on is withdrawn', () => {
    const s = marked();
    const checked = { ...s, doc: applyLeanResult(s.doc, generateLean(s.doc), success) };
    const unmarked = unmarkCommuting(checked, 'A', 'D');
    expect(isStale(unmarked.doc, 'q1')).toBe(true);
  });

  it('is false again once the change is undone', () => {
    const s = marked();
    const checked = { ...s, doc: applyLeanResult(s.doc, generateLean(s.doc), success) };
    const renamed = renameMorphism(checked, 'f', '\\phi');
    expect(isStale(renamed.doc, 'q1')).toBe(true);
    expect(isStale(renameMorphism(renamed, 'f', 'f').doc, 'q1')).toBe(false);
  });

  it('is false for a goal Lean never saw', () => {
    expect(isStale(marked().doc, 'q1')).toBe(false);
  });

  it('disappears with the goal when the diagram cascades', () => {
    const s = marked();
    const checked = { ...s, doc: applyLeanResult(s.doc, generateLean(s.doc), success) };
    const deleted = deleteElements(checked, { edgeIds: ['f'] });
    expect(deleted.doc.goals).toEqual([]);
    expect(deleted.doc.steps).toEqual([]);
    expect(validateDocument(deleted.doc)).toEqual([]);
  });
});
