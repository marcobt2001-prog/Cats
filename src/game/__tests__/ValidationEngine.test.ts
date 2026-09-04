import { describe, it, expect } from 'vitest';
import { validateGoals } from '../ValidationEngine.js';
import { WORLD1_LEVELS } from '../levels/world1-sets.js';
import { fromLegacyDiagram, addMorphism, markCommuting, unmarkCommuting } from '../../diagram/index.js';
import type { DiagramState, LegacyEdge, LegacyNode } from '../../diagram/index.js';

type Goal = { id: string; type: string; src?: string; tgt?: string; nodes?: string[]; dependsOn?: string; description: string };
type Level = { id: string; givens: { nodes: LegacyNode[]; edges: LegacyEdge[] }; goals: Goal[] };

function load(id: string): { level: Level; state: DiagramState } {
  const level = (WORLD1_LEVELS as Level[]).find(l => l.id === id)!;
  return { level, state: fromLegacyDiagram(level.givens.nodes, level.givens.edges).state };
}

const statuses = (goals: Goal[], state: DiagramState) =>
  validateGoals(goals, state).updatedGoals.map((g: { status: string }) => g.status);

describe('validateGoals on World 1', () => {
  it('I-1: drawing A → B verifies the level', () => {
    const { level, state } = load('I-1');
    expect(validateGoals(level.goals, state).levelComplete).toBe(false);
    const [drawn] = addMorphism(state, { src: 'A', tgt: 'B' });
    expect(validateGoals(level.goals, drawn).levelComplete).toBe(true);
  });

  it('I-3: an identity loop verifies the level', () => {
    const { level, state } = load('I-3');
    const [drawn] = addMorphism(state, { src: 'A', tgt: 'A' });
    expect(validateGoals(level.goals, drawn).levelComplete).toBe(true);
  });

  it('I-2: the commutativity goal is blocked until the composite is drawn, then needs an equation', () => {
    const { level, state } = load('I-2');
    expect(statuses(level.goals, state)).toEqual(['pending', 'blocked']);
    const [drawn] = addMorphism(state, { src: 'A', tgt: 'C', name: 'g \\circ f' });
    expect(statuses(level.goals, drawn)).toEqual(['verified', 'pending']);
    const marked = markCommuting(drawn, 'A', 'C');
    expect(statuses(level.goals, marked)).toEqual(['verified', 'verified']);
    expect(validateGoals(level.goals, marked).levelComplete).toBe(true);
    expect(validateGoals(level.goals, marked).updatedSteps[1]).toEqual({ description: level.goals[1]!.description, status: 'verified' });
  });

  it('I-4: verified after marking the square, pending after unmarking', () => {
    const { level, state } = load('I-4');
    expect(validateGoals(level.goals, state).levelComplete).toBe(false);
    const marked = markCommuting(state, 'A', 'D');
    expect(validateGoals(level.goals, marked).levelComplete).toBe(true);
    expect(validateGoals(level.goals, unmarkCommuting(marked, 'A', 'D')).levelComplete).toBe(false);
  });
});
