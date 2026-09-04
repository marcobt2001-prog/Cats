import { morphismsOf } from '../math/index.ts';
import { isCommuting } from '../diagram/index.ts';

/**
 * Validate level goals against the current diagram state.
 *
 * @param {Array} goals  – goal objects from the level definition
 * @param {object} state – DiagramState ({ doc, layout })
 * @returns {{ updatedGoals, updatedSteps, levelComplete }}
 *
 * Goal types (Phase 2; Phase 3 replaces these with real propositions):
 *   draw_morphism     { src, tgt }   – some morphism src → tgt exists
 *   mark_commutative  { nodes }      – every path from nodes[0] to nodes[last] is
 *                                      asserted equal by the document's hypotheses
 */
export function validateGoals(goals, state) {
  const statusMap = {};
  const morphisms = morphismsOf(state.doc.context);

  const updatedGoals = goals.map(goal => {
    if (goal.dependsOn) {
      const dep = goals.find(g => g.id === goal.dependsOn);
      if (dep && statusMap[dep.id] !== 'verified') {
        statusMap[goal.id] = 'blocked';
        return { ...goal, status: 'blocked' };
      }
    }

    let verified = false;

    if (goal.type === 'draw_morphism') {
      verified = morphisms.some(m => m.source === goal.src && m.target === goal.tgt);
    }

    if (goal.type === 'mark_commutative') {
      const goalNodes = goal.nodes;
      if (goalNodes && goalNodes.length >= 2) {
        verified = isCommuting(state, goalNodes[0], goalNodes[goalNodes.length - 1]);
      }
    }

    const status = verified ? 'verified' : 'pending';
    statusMap[goal.id] = status;
    return { ...goal, status };
  });

  const updatedSteps = updatedGoals.map(g => ({ description: g.description, status: g.status }));
  const levelComplete = updatedGoals.every(g => g.status === 'verified');

  return { updatedGoals, updatedSteps, levelComplete };
}
