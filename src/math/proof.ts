import type { GoalId, GoalStatus, MathDocument, ProofGoal, ProofStep, Proposition, StepId } from './types.js';
import { MathError, freshId, propositionError, usedIds } from './context.js';
import { exprEquivalent } from './expr.js';

export const STEP_REFL_NORMALIZE = 'refl-normalize';

export function getGoal(doc: MathDocument, id: GoalId): ProofGoal | undefined {
  return doc.goals.find(g => g.id === id);
}

/** Adds an open goal. Throws if the proposition is ill-typed in the document's context. */
export function addGoal(doc: MathDocument, prop: Proposition, id?: GoalId): [MathDocument, GoalId] {
  const err = propositionError(doc.context, prop);
  if (err) throw new MathError(`goal: ${err}`);
  let next = doc;
  let gid = id;
  if (gid === undefined) [next, gid] = freshId(next, 'g');
  else if (usedIds(next).has(gid)) throw new MathError(`id '${gid}' is already in use`);
  const goal: ProofGoal = { id: gid, prop, status: { kind: 'open' } };
  return [{ ...next, goals: [...next.goals, goal] }, gid];
}

export function addStep(doc: MathDocument, step: Omit<ProofStep, 'id'>, id?: StepId): [MathDocument, StepId] {
  let next = doc;
  let sid = id;
  if (sid === undefined) [next, sid] = freshId(next, 's');
  else if (usedIds(next).has(sid)) throw new MathError(`id '${sid}' is already in use`);
  const full: ProofStep = { id: sid, ...step };
  return [{ ...next, steps: [...next.steps, full] }, sid];
}

export function setGoalStatus(doc: MathDocument, goalId: GoalId, status: GoalStatus): MathDocument {
  if (!getGoal(doc, goalId)) throw new MathError(`unknown goal '${goalId}'`);
  return { ...doc, goals: doc.goals.map(g => (g.id === goalId ? { ...g, status } : g)) };
}

/**
 * The one piece of reasoning CATS performs on its own: if both sides of an
 * equality goal agree after dropping identities and re-associating, record a
 * step and mark the goal `believed`. This is never `verified`; only Lean can
 * say that.
 */
export function tryCloseByNormalization(doc: MathDocument, goalId: GoalId): { doc: MathDocument; closed: boolean } {
  const goal = getGoal(doc, goalId);
  if (!goal) throw new MathError(`unknown goal '${goalId}'`);
  if (goal.status.kind !== 'open') return { doc, closed: false };
  if (!exprEquivalent(goal.prop.left, goal.prop.right)) return { doc, closed: false };
  const [withStep, stepId] = addStep(doc, { kind: STEP_REFL_NORMALIZE, inputs: [goalId], outputs: [] });
  return { doc: setGoalStatus(withStep, goalId, { kind: 'believed', by: stepId }), closed: true };
}
