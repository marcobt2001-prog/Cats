/**
 * Level goals as real propositions in the document.
 *
 * `ValidationEngine` answers "has the player done this yet?" against the level
 * text. Lean needs something else: a statement in the document, with a stable
 * id, that a verdict can be attached to. This module is the bridge, and it is
 * idempotent so re-running it on every check does not churn the history.
 */
import { morphism, morphismsOf, entails, resolveLabelText, parsePropositionText, upsertGoal, removeGoals } from '../math/index.ts';

/** Stable across runs and reloads, so a verdict survives a re-check. */
export function leanGoalId(levelId, goalId) {
  return `goal:${levelId}:${goalId}`;
}

/**
 * What each level goal says mathematically, or why it cannot say anything yet.
 * A goal the player has not started (no arrow drawn) has no proposition, which
 * is different from having a false one.
 */
export function levelGoalPropositions(level, state) {
  const ctx = state.doc.context;

  return level.goals.map(goal => {
    const id = leanGoalId(level.id, goal.id);

    if (goal.type === 'eq') {
      const parsed = parsePropositionText(ctx, goal.prop);
      return parsed.ok ? { id, prop: parsed.prop } : { id, reason: parsed.error };
    }

    if (goal.type === 'morphism') {
      const candidates = morphismsOf(ctx).filter(m => m.source === goal.source && m.target === goal.target);
      if (goal.equals === undefined) {
        // Existence is part of the context once the arrow is there; Lean has
        // nothing to decide.
        return { id, reason: 'nothing to prove: existence is part of the context' };
      }
      if (candidates.length === 0) return { id, reason: 'draw the arrow first' };
      const expected = { source: goal.source, target: goal.target };
      const resolved = resolveLabelText(ctx, goal.equals, { expected });
      if (!resolved.ok) return { id, reason: resolved.error };
      // Prefer the arrow CATS already believes is the right one; otherwise the
      // first, so a wrong answer is still something Lean can reject.
      const chosen = candidates.find(m => entails(ctx, { kind: 'eq', left: morphism(m.id), right: resolved.expr }))
        ?? candidates[0];
      return { id, prop: { kind: 'eq', left: morphism(chosen.id), right: resolved.expr } };
    }

    return { id, reason: `unsupported goal type '${goal.type}'` };
  });
}

/**
 * Brings `doc.goals` in line with the level: statable goals are added or
 * refreshed, and ones that no longer say anything are dropped.
 */
export function upsertLevelGoals(state, level) {
  const entries = levelGoalPropositions(level, state);
  let doc = state.doc;

  for (const entry of entries) {
    if (entry.prop) doc = upsertGoal(doc, entry.id, entry.prop);
  }

  const wanted = new Set(entries.filter(e => e.prop).map(e => e.id));
  const prefix = `goal:${level.id}:`;
  const orphans = doc.goals.filter(g => g.id.startsWith(prefix) && !wanted.has(g.id)).map(g => g.id);
  if (orphans.length > 0) doc = removeGoals(doc, orphans);

  return doc === state.doc ? state : { ...state, doc };
}
