import { describe, it, expect } from 'vitest';
import { leanGoalId, levelGoalPropositions, upsertLevelGoals } from '../leanGoals.js';
import { WORLD1_LEVELS } from '../levels/world1-sets.js';
import { fromLegacyDiagram, addMorphism, renameMorphism, markCommuting } from '../../diagram/index.js';
import type { DiagramState, LegacyEdge, LegacyNode } from '../../diagram/index.js';
import { validateDocument } from '../../math/context.js';
import { printProposition } from '../../math/print.js';
import { generateLean } from '../../lean/generate.js';

type Goal = { id: string; type: string; source?: string; target?: string; equals?: string; prop?: string };
type Level = { id: string; givens: { nodes: LegacyNode[]; edges: LegacyEdge[] }; goals: Goal[] };

function load(id: string): { level: Level; state: DiagramState } {
  const level = (WORLD1_LEVELS as Level[]).find(l => l.id === id)!;
  return { level, state: fromLegacyDiagram(level.givens.nodes, level.givens.edges).state };
}

const textOf = (state: DiagramState, id: string) => {
  const goal = state.doc.goals.find(g => g.id === id)!;
  return printProposition(state.doc.context, goal.prop, 'classical');
};

describe('levelGoalPropositions', () => {
  it('has nothing for CATS to prove when a goal is pure existence', () => {
    const { level, state } = load('I-1');
    expect(levelGoalPropositions(level, state)).toEqual([
      { id: 'goal:I-1:g1', reason: 'nothing to prove: existence is part of the context' },
    ]);
  });

  it('waits for the arrow before stating the composite goal', () => {
    const { level, state } = load('I-2');
    const entries = levelGoalPropositions(level, state);
    expect(entries[1]).toEqual({ id: 'goal:I-2:g2', reason: 'draw the arrow first' });
  });

  it('states that the drawn arrow is the composite', () => {
    const { level, state } = load('I-2');
    const [drawn, id] = addMorphism(state, { src: 'A', tgt: 'C' });
    const entry = levelGoalPropositions(level, drawn)[1]!;
    expect(entry.reason).toBeUndefined();
    expect(entry.prop).toEqual({
      kind: 'eq',
      left: { kind: 'morphism', ref: id },
      right: { kind: 'compose', factors: [{ kind: 'morphism', ref: 'f' }, { kind: 'morphism', ref: 'g' }] },
    });
    // An unnamed arrow prints as nothing in LaTeX, but Lean still needs an
    // identifier: the fallback plus collision numbering gives it one.
    const withGoals = upsertLevelGoals(drawn, level);
    expect(generateLean(withGoals.doc).source).toContain('example : f_2 = f ≫ g := by');
  });

  it('states the identity goal for I-3', () => {
    const { level, state } = load('I-3');
    let [s, id] = addMorphism(state, { src: 'A', tgt: 'A' });
    s = renameMorphism(s, id, '\\mathrm{id}_A');
    const withGoals = upsertLevelGoals(s, level);
    expect(textOf(withGoals, 'goal:I-3:g1')).toBe('\\mathrm{id}_A = id_A');
  });

  it('states the square equation for I-4 without needing the mark', () => {
    const { level, state } = load('I-4');
    const withGoals = upsertLevelGoals(state, level);
    expect(textOf(withGoals, 'goal:I-4:g1')).toBe('h ∘ f = k ∘ g');
  });

  it('reports an ambiguous name rather than guessing', () => {
    const { level, state } = load('I-2');
    let [s] = addMorphism(state, { src: 'A', tgt: 'C' });
    [s] = addMorphism(s, { src: 'A', tgt: 'B', name: 'f' });
    expect(levelGoalPropositions(level, s)[1]!.reason).toBe("ambiguous name 'f'");
  });
});

describe('upsertLevelGoals', () => {
  it('uses stable ids', () => {
    expect(leanGoalId('I-4', 'g1')).toBe('goal:I-4:g1');
    const { level, state } = load('I-4');
    expect(upsertLevelGoals(state, level).doc.goals.map((g: { id: string }) => g.id)).toEqual(['goal:I-4:g1']);
  });

  it('is idempotent', () => {
    const { level, state } = load('I-4');
    const once = upsertLevelGoals(state, level);
    expect(upsertLevelGoals(once, level)).toBe(once);
  });

  it('adds nothing when no goal can be stated', () => {
    const { level, state } = load('I-1');
    expect(upsertLevelGoals(state, level)).toBe(state);
  });

  it('drops a goal that stops being statable', () => {
    const { level, state } = load('I-2');
    const [drawn] = addMorphism(state, { src: 'A', tgt: 'C' });
    const withGoals = upsertLevelGoals(drawn, level);
    expect(withGoals.doc.goals).toHaveLength(1);
    // Without the arrow the goal cannot be stated at all.
    const back = upsertLevelGoals({ ...withGoals, doc: state.doc }, level);
    expect(back.doc.goals).toEqual([]);
  });

  it('keeps the document valid and generates Lean for the marked square', () => {
    const { level, state } = load('I-4');
    const marked = markCommuting(state, 'A', 'D');
    const withGoals = upsertLevelGoals(marked, level);
    expect(validateDocument(withGoals.doc)).toEqual([]);

    const gen = generateLean(withGoals.doc);
    expect(gen.goals.map(b => b.id)).toEqual(['goal:I-4:g1']);
    expect(gen.source).toContain('example (h₁ : f ≫ h = g ≫ k) : f ≫ h = g ≫ k := by');
    expect(gen.source).toContain('(CATS: entailed by h₁)');
  });
});
