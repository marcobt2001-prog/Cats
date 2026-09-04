import { morphismsOf, morphism, entails, resolveLabelText, parsePropositionText } from '../math/index.ts';

/**
 * Validate level goals against the current diagram state.
 *
 * @param {Array} goals  – goal objects from the level definition
 * @param {object} state – DiagramState ({ doc, layout })
 * @returns {{ updatedGoals, updatedSteps, levelComplete }}
 *
 * Goals are propositions written in the label grammar and resolved against the
 * live context, so they mean the same thing the diagram means:
 *
 *   morphism { source, target, equals? }
 *     Some morphism source → target exists. With `equals`, one of them must
 *     equal that expression: satisfied by labelling the arrow `g \circ f`, or
 *     by asserting the equation in the Commutes panel — both routes are real
 *     mathematics, so both count.
 *
 *   eq { prop: 'h \circ f = k \circ g' }
 *     The context entails the equation.
 *
 * A goal whose text does not resolve yet (the morphisms it names are missing)
 * is simply pending; it carries the reason for the UI.
 *
 * Statuses are 'satisfied' | 'pending' | 'blocked'. Not "verified": CATS'
 * own reasoning is never a proof, only Lean's is (Phase 4).
 */
export function validateGoals(goals, state) {
  const ctx = state.doc.context;
  const statusMap = {};

  const updatedGoals = goals.map(goal => {
    if (goal.dependsOn) {
      const dep = goals.find(g => g.id === goal.dependsOn);
      if (dep && statusMap[dep.id] !== 'satisfied') {
        statusMap[goal.id] = 'blocked';
        return { ...goal, status: 'blocked' };
      }
    }

    let satisfied = false;
    let error;

    if (goal.type === 'morphism') {
      const candidates = morphismsOf(ctx).filter(m => m.source === goal.source && m.target === goal.target);
      if (goal.equals === undefined) {
        satisfied = candidates.length > 0;
      } else if (candidates.length > 0) {
        const expected = { source: goal.source, target: goal.target };
        const resolved = resolveLabelText(ctx, goal.equals, { expected });
        if (!resolved.ok) error = resolved.error;
        else satisfied = candidates.some(m => entails(ctx, { kind: 'eq', left: morphism(m.id), right: resolved.expr }));
      }
    } else if (goal.type === 'eq') {
      const parsed = parsePropositionText(ctx, goal.prop);
      if (!parsed.ok) error = parsed.error;
      else satisfied = entails(ctx, parsed.prop);
    }

    const status = satisfied ? 'satisfied' : 'pending';
    statusMap[goal.id] = status;
    return { ...goal, status, ...(error ? { error } : {}) };
  });

  const updatedSteps = updatedGoals.map(g => ({ description: g.description, status: g.status }));
  const levelComplete = updatedGoals.every(g => g.status === 'satisfied');

  return { updatedGoals, updatedSteps, levelComplete };
}
