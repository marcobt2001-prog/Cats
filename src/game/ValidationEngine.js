import { findAllPaths } from '../geometry.js';

/**
 * Validate level goals against current diagram state.
 *
 * @param {Array} goals       – goal objects from the level definition
 * @param {Array} nodes       – all nodes (given + player)
 * @param {Array} edges       – all edges (given + player)
 * @param {Set}   commEdgeIds – set of edge IDs currently marked commutative
 * @returns {{ updatedGoals, updatedSteps, levelComplete }}
 */
export function validateGoals(goals, nodes, edges, commEdgeIds) {
  const statusMap = {};

  // First pass: evaluate each goal (skip dependency-blocked ones)
  const updatedGoals = goals.map(goal => {
    // Check dependency
    if (goal.dependsOn) {
      const dep = goals.find(g => g.id === goal.dependsOn);
      if (dep && statusMap[dep.id] !== 'verified') {
        statusMap[goal.id] = 'blocked';
        return { ...goal, status: 'blocked' };
      }
    }

    let verified = false;

    if (goal.type === 'draw_morphism') {
      // Check that an edge exists with correct src and tgt node ids
      verified = edges.some(e => e.src === goal.src && e.tgt === goal.tgt);
    }

    if (goal.type === 'mark_commutative') {
      // Check that at least two paths exist between relevant nodes,
      // and that all edges in those paths are marked commutative
      const goalNodes = goal.nodes;
      if (goalNodes && goalNodes.length >= 2) {
        const start = goalNodes[0];
        const end = goalNodes[goalNodes.length - 1];

        // Find all paths from start to end
        const paths = findAllPaths(start, end, edges, nodes);

        if (paths.length >= 2) {
          // All edges involved in these paths must be commutative
          const allPathEdgeIds = new Set();
          paths.forEach(p => p.path.forEach(eid => allPathEdgeIds.add(eid)));
          verified = [...allPathEdgeIds].every(eid => commEdgeIds.has(eid));
        }
      }
    }

    const status = verified ? 'verified' : 'pending';
    statusMap[goal.id] = status;
    return { ...goal, status };
  });

  // Build updated steps from goals
  const updatedSteps = updatedGoals.map(g => ({
    description: g.description,
    status: g.status === 'blocked' ? 'blocked' : g.status,
  }));

  const levelComplete = updatedGoals.every(g => g.status === 'verified');

  return { updatedGoals, updatedSteps, levelComplete };
}
