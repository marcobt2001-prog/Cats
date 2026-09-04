import { describe, it, expect } from 'vitest';
import { validateGoals } from '../ValidationEngine.js';
import { WORLD1_LEVELS } from '../levels/world1-sets.js';
import { fromLegacyDiagram, addMorphism, renameMorphism, markCommuting, unmarkCommuting } from '../../diagram/index.js';
import type { DiagramState, LegacyEdge, LegacyNode } from '../../diagram/index.js';
import { resolveLabelText, parsePropositionText } from '../../math/index.js';

type Goal = {
  id: string; type: string; source?: string; target?: string; equals?: string; prop?: string;
  dependsOn?: string; description: string;
};
type Level = { id: string; givens: { nodes: LegacyNode[]; edges: LegacyEdge[] }; goals: Goal[] };

function load(id: string): { level: Level; state: DiagramState } {
  const level = (WORLD1_LEVELS as Level[]).find(l => l.id === id)!;
  return { level, state: fromLegacyDiagram(level.givens.nodes, level.givens.edges).state };
}

const statuses = (goals: Goal[], state: DiagramState) =>
  validateGoals(goals, state).updatedGoals.map((g: { status: string }) => g.status);
const complete = (goals: Goal[], state: DiagramState) => validateGoals(goals, state).levelComplete;

describe('I-1: existence', () => {
  it('is satisfied by any morphism A → B', () => {
    const { level, state } = load('I-1');
    expect(complete(level.goals, state)).toBe(false);
    const [drawn] = addMorphism(state, { src: 'A', tgt: 'B' });
    expect(complete(level.goals, drawn)).toBe(true);
  });

  it('is not satisfied by an arrow in the wrong direction', () => {
    const { level, state } = load('I-1');
    const [drawn] = addMorphism(state, { src: 'B', tgt: 'A' });
    expect(complete(level.goals, drawn)).toBe(false);
  });
});

describe('I-2: the composite must really be the composite', () => {
  it('an unnamed arrow satisfies the first goal only', () => {
    const { level, state } = load('I-2');
    expect(statuses(level.goals, state)).toEqual(['pending', 'blocked']);
    const [drawn] = addMorphism(state, { src: 'A', tgt: 'C' });
    expect(statuses(level.goals, drawn)).toEqual(['satisfied', 'pending']);
  });

  it('route 1: labelling the arrow `g \\circ f`', () => {
    const { level, state } = load('I-2');
    let [s, id] = addMorphism(state, { src: 'A', tgt: 'C' });
    s = renameMorphism(s, id, 'g \\circ f');
    expect(statuses(level.goals, s)).toEqual(['satisfied', 'satisfied']);
    expect(complete(level.goals, s)).toBe(true);
  });

  it('route 2: asserting the equation in the Commutes panel', () => {
    const { level, state } = load('I-2');
    const [drawn] = addMorphism(state, { src: 'A', tgt: 'C' });
    const marked = markCommuting(drawn, 'A', 'C');
    expect(statuses(level.goals, marked)).toEqual(['satisfied', 'satisfied']);
    expect(validateGoals(level.goals, marked).updatedSteps[1])
      .toEqual({ description: level.goals[1]!.description, status: 'satisfied' });
  });

  it('accepts the diagrammatic spelling `f \\gg g`', () => {
    const { level, state } = load('I-2');
    let [s, id] = addMorphism(state, { src: 'A', tgt: 'C' });
    s = renameMorphism(s, id, 'f \\gg g');
    expect(complete(level.goals, s)).toBe(true);
  });

  it('rejects the wrong order and an unrelated name', () => {
    const { level, state } = load('I-2');
    let [s, id] = addMorphism(state, { src: 'A', tgt: 'C' });
    expect(statuses(level.goals, renameMorphism(s, id, 'f \\circ g'))).toEqual(['satisfied', 'pending']);
    expect(statuses(level.goals, renameMorphism(s, id, 'q'))).toEqual(['satisfied', 'pending']);
  });

  it('an ambiguous name leaves the goal pending with a reason', () => {
    const { level, state } = load('I-2');
    let [s, id] = addMorphism(state, { src: 'A', tgt: 'C' });
    s = renameMorphism(s, id, 'g \\circ f');
    // A second arrow also called `f` makes the goal text ambiguous.
    let [s2] = addMorphism(s, { src: 'A', tgt: 'B', name: 'f' });
    const g2 = validateGoals(level.goals, s2).updatedGoals[1] as { status: string; error?: string };
    expect(g2.status).toBe('pending');
    expect(g2.error).toBe("ambiguous name 'f'");
  });

  it('unmarking the pair takes the goal back to pending', () => {
    const { level, state } = load('I-2');
    const [drawn] = addMorphism(state, { src: 'A', tgt: 'C' });
    const marked = markCommuting(drawn, 'A', 'C');
    expect(statuses(level.goals, unmarkCommuting(marked, 'A', 'C'))).toEqual(['satisfied', 'pending']);
  });
});

describe('I-3: the loop must be the identity', () => {
  it('an unlabelled loop is not enough', () => {
    const { level, state } = load('I-3');
    const [drawn] = addMorphism(state, { src: 'A', tgt: 'A' });
    expect(complete(level.goals, drawn)).toBe(false);
  });

  it('accepts every identity spelling', () => {
    const { level, state } = load('I-3');
    for (const label of ['\\mathrm{id}_A', 'id_A', '1_A', 'id']) {
      let [s, id] = addMorphism(state, { src: 'A', tgt: 'A' });
      s = renameMorphism(s, id, label);
      expect(complete(level.goals, s), label).toBe(true);
    }
  });

  it('rejects an arbitrary name', () => {
    const { level, state } = load('I-3');
    let [s, id] = addMorphism(state, { src: 'A', tgt: 'A' });
    expect(complete(level.goals, renameMorphism(s, id, 'x'))).toBe(false);
  });
});

describe('I-4: the square equation', () => {
  it('is satisfied by marking and lost by unmarking', () => {
    const { level, state } = load('I-4');
    expect(complete(level.goals, state)).toBe(false);
    const marked = markCommuting(state, 'A', 'D');
    expect(complete(level.goals, marked)).toBe(true);
    expect(complete(level.goals, unmarkCommuting(marked, 'A', 'D'))).toBe(false);
  });

  it('is also satisfied by a diagonal defined both ways', () => {
    const { level, state } = load('I-4');
    // `h ∘ f = k ∘ g` follows if one arrow is defined as both composites in turn.
    let [s, d1] = addMorphism(state, { src: 'A', tgt: 'D', name: 'h \\circ f' });
    const marked = markCommuting(s, 'A', 'D');
    expect(complete(level.goals, marked)).toBe(true);
    expect(d1).toBeTruthy();
  });
});

describe('level authoring', () => {
  it('every goal text resolves against its own givens', () => {
    for (const level of WORLD1_LEVELS as Level[]) {
      const { state } = load(level.id);
      const ctx = state.doc.context;
      for (const goal of level.goals) {
        if (goal.type === 'eq') {
          const r = parsePropositionText(ctx, goal.prop!);
          expect(r.ok, `${level.id}/${goal.id}: ${r.ok ? '' : r.error}`).toBe(true);
        }
        if (goal.type === 'morphism' && goal.equals !== undefined) {
          // The composite may name morphisms the player has yet to draw, but in
          // World 1 every factor is given, so it must resolve now.
          const r = resolveLabelText(ctx, goal.equals, {
            expected: { source: goal.source!, target: goal.target! },
          });
          expect(r.ok, `${level.id}/${goal.id}: ${r.ok ? '' : r.error}`).toBe(true);
        }
      }
    }
  });

  it('uses only the two supported goal kinds', () => {
    for (const level of WORLD1_LEVELS as Level[]) {
      for (const goal of level.goals) expect(['morphism', 'eq']).toContain(goal.type);
    }
  });
});
