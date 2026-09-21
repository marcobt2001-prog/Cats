/**
 * Writing Lean's verdict back into the document.
 *
 * This file is the ONLY place in CATS that constructs
 * `GoalStatus { kind: 'verified', authority: 'lean' }`, and it does so only
 * from a `LeanResult` that a real Lean process produced. CATS' own reasoning
 * reaches `believed` and stops there (development plan §17).
 *
 * Every function is pure, so the UI gets undo for free through the history
 * snapshots it already keeps.
 */
import type { GoalId, MathDocument, ProofStep } from '../math/types.js';
import { addStep, getGoal, setGoalStatus } from '../math/proof.js';
import { generateLean } from './generate.js';
import type { GeneratedLean } from './generate.js';
import { reportByGoal } from './diagnostics.js';
import type { LeanResult } from './diagnostics.js';

export const STEP_LEAN_CHECK = 'lean-check';

/** The check recorded for a goal, if Lean has ever run on it. */
export function leanCheckOf(doc: MathDocument, goalId: GoalId): ProofStep | undefined {
  return doc.steps.find(s => s.kind === STEP_LEAN_CHECK && s.inputs[0] === goalId);
}

/**
 * True when the statement or its context has changed since the recorded check,
 * so the verdict no longer describes the current diagram. Comparing the stored
 * source with a freshly generated one catches renames and new hypotheses alike.
 */
export function isStale(doc: MathDocument, goalId: GoalId): boolean {
  const step = leanCheckOf(doc, goalId);
  if (!step || step.generatedLean === undefined) return false;
  return step.generatedLean !== generateLean(doc, { goalIds: [goalId] }).source;
}

export type LeanGoalView =
  | { kind: 'open' }
  | { kind: 'believed' }
  | { kind: 'verified'; message?: string }
  | { kind: 'failed'; message: string }
  | { kind: 'stale'; message?: string };

/** What the UI should show for one goal. `believed` is never dressed up as verified. */
export function leanViewOf(doc: MathDocument, goalId: GoalId): LeanGoalView {
  const goal = getGoal(doc, goalId);
  if (!goal) return { kind: 'open' };
  const status = goal.status;
  switch (status.kind) {
    case 'open':
      return { kind: 'open' };
    case 'believed':
      return { kind: 'believed' };
    case 'verified':
      return isStale(doc, goalId)
        ? { kind: 'stale', ...(status.message !== undefined ? { message: status.message } : {}) }
        : { kind: 'verified', ...(status.message !== undefined ? { message: status.message } : {}) };
    case 'failed':
      return isStale(doc, goalId) ? { kind: 'stale', message: status.message } : { kind: 'failed', message: status.message };
  }
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Records what Lean said about each goal in the run: one `lean-check` step per
 * goal, carrying the exact source that was checked, and the resulting status.
 * Goals that have since disappeared from the document are skipped.
 */
export function applyLeanResult(doc: MathDocument, gen: GeneratedLean, result: LeanResult): MathDocument {
  const { goals } = reportByGoal(gen, result);
  let next = doc;

  for (const report of goals) {
    if (!getGoal(next, report.id)) continue;

    // One check per goal: the previous verdict is superseded, not accumulated.
    const previous = leanCheckOf(next, report.id);
    if (previous) next = { ...next, steps: next.steps.filter(s => s.id !== previous.id) };

    const source = generateLean(next, { goalIds: [report.id] }).source;
    let stepId: string;
    [next, stepId] = addStep(next, {
      kind: STEP_LEAN_CHECK,
      inputs: [report.id],
      outputs: [],
      generatedLean: source,
    });

    next = setGoalStatus(next, report.id, report.ok
      ? { kind: 'verified', authority: 'lean', message: `checked in ${seconds(result.durationMs)}`, by: stepId }
      : { kind: 'failed', authority: 'lean', message: report.message ?? 'Lean reported a failure', by: stepId });
  }

  return next;
}
