import { describe, it, expect } from 'vitest';
import { addMorphism, renameMorphism, renameObject, deleteElements, checkInvariants } from '../state.js';
import { isCommuting, markCommuting, describePairs, unmarkCommuting } from '../commute.js';
import { extractSubdiagram, mergeDiagram } from '../merge.js';
import { serializeCat, deserializeCat } from '../serialize.js';
import { fromLegacyDiagram } from '../legacy.js';
import { toViews } from '../views.js';
import { getMorphism, morphismsOf, hypothesesOf } from '../../math/context.js';
import { morphism, compose, identity } from '../../math/expr.js';
import { labelStatus } from '../../math/definitions.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from '../../math/__tests__/fixtures.js';
import { defaults, square } from './fixtures.js';

const composite = compose(morphism('f1'), morphism('f2'));

describe('labels become definitions in diagram state', () => {
  it('the editor defaults arrive with `g ∘ f` defined', () => {
    const s = defaults();
    expect(getMorphism(s.doc.context, 'f3')?.definition).toEqual(composite);
    expect(labelStatus(s.doc.context, 'f3')).toEqual({ kind: 'defined', expr: composite });
    expect(checkInvariants(s)).toEqual([]);
  });

  it('drawing an arrow and labelling it makes it a composite', () => {
    let [s, id] = addMorphism(square(), { src: 'A', tgt: 'D' });
    expect(labelStatus(s.doc.context, id)).toEqual({ kind: 'atomic' });
    s = renameMorphism(s, id, 'h \\circ f');
    expect(getMorphism(s.doc.context, id)?.definition).toEqual(compose(morphism('f'), morphism('h')));
    expect(checkInvariants(s)).toEqual([]);
  });

  it('renaming back to a plain name strips the definition', () => {
    const s = renameMorphism(defaults(), 'f3', 'h');
    expect(getMorphism(s.doc.context, 'f3')).not.toHaveProperty('definition');
    expect(labelStatus(s.doc.context, 'f3')).toEqual({ kind: 'atomic' });
  });

  it('reports a label that cannot be resolved', () => {
    const s = renameMorphism(defaults(), 'f3', 'g \\circ x');
    expect(labelStatus(s.doc.context, 'f3')).toEqual({ kind: 'unresolved', error: "unknown morphism 'x'" });
    expect(checkInvariants(s)).toEqual([]);
  });

  it('renaming a factor re-labels the composite', () => {
    const s = renameMorphism(defaults(), 'f1', '\\phi');
    expect(toViews(s).edges.find(e => e.id === 'f3')?.label).toBe('g \\circ \\phi');
    expect(getMorphism(s.doc.context, 'f3')?.definition).toEqual(composite);
  });

  it('renaming an object re-labels an identity loop', () => {
    let [s, id] = addMorphism(square(), { src: 'A', tgt: 'A', name: '\\mathrm{id}_A' });
    expect(getMorphism(s.doc.context, id)?.definition).toEqual(identity('A'));
    s = renameObject(s, 'A', 'X');
    expect(getMorphism(s.doc.context, id)?.name).toBe('\\mathrm{id}_X');
  });

  it('deleting a factor deletes the composite defined from it', () => {
    const s = deleteElements(defaults(), { edgeIds: ['f1'] });
    expect(morphismsOf(s.doc.context).map(m => m.id)).toEqual(['f2']);
    expect(checkInvariants(s)).toEqual([]);
  });
});

describe('commutativity sees definitions', () => {
  it('the defaults commute by definition, with no equation', () => {
    const s = defaults();
    expect(isCommuting(s, 'A', 'C')).toBe(true);
    expect(hypothesesOf(s.doc.context)).toEqual([]);
    // Nothing left to assert, so marking is a no-op.
    expect(markCommuting(s, 'A', 'C')).toBe(s);
  });

  it('a third unrelated path breaks it until marked', () => {
    let [s] = addMorphism(defaults(), { src: 'A', tgt: 'C', name: 'x' });
    expect(isCommuting(s, 'A', 'C')).toBe(false);
    s = markCommuting(s, 'A', 'C');
    expect(hypothesesOf(s.doc.context)).toHaveLength(1);
    expect(isCommuting(s, 'A', 'C')).toBe(true);
  });

  it('unmarking cannot undo a definitional equality', () => {
    const s = unmarkCommuting(defaults(), 'A', 'C');
    expect(isCommuting(s, 'A', 'C')).toBe(true);
  });
});

describe('describePairs', () => {
  it('prints the defaults pair in classical order and flags it as definitional', () => {
    const [d] = describePairs(defaults());
    expect(d!.srcName).toBe('A');
    expect(d!.tgtName).toBe('C');
    expect(d!.paths.map(p => p.text)).toEqual(['g ∘ f', 'g \\circ f']);
    expect(d!.commutes).toBe(true);
    expect(d!.byDefinition).toBe(true);
    expect(d!.hypotheses).toEqual([]);
  });

  it('lists the equation of a marked square', () => {
    const [d] = describePairs(markCommuting(square(), 'A', 'D'));
    expect(d!.paths.map(p => p.text)).toEqual(['h ∘ f', 'k ∘ g']);
    expect(d!.hypotheses.map(h => h.text)).toEqual(['h ∘ f = k ∘ g']);
    expect(d!.byDefinition).toBe(false);
    expect(d!.commutes).toBe(true);
  });

  it('is empty when nothing is parallel', () => {
    expect(describePairs(square()).map(p => p.src)).toEqual(['A']);
    const [s] = addMorphism(square(), { src: 'B', tgt: 'C' });
    expect(describePairs(s).length).toBeGreaterThan(0);
  });
});

describe('definitions survive import, save, and paste', () => {
  it('a legacy import defines the composite label', () => {
    const { state, warnings } = fromLegacyDiagram(DEFAULT_NODES, DEFAULT_EDGES);
    expect(warnings).toEqual([]);
    expect(getMorphism(state.doc.context, 'f3')?.definition).toEqual(composite);
  });

  it('round-trips through .cat v0.2', () => {
    const back = deserializeCat(serializeCat(defaults()));
    expect(back.warnings).toEqual([]);
    expect(getMorphism(back.state.doc.context, 'f3')?.definition).toEqual(composite);
  });

  it('reads a Phase 2 file that has the label but no definition', () => {
    const raw = JSON.parse(serializeCat(defaults()));
    raw.math.context.declarations = raw.math.context.declarations.map(
      (d: { id: string; definition?: unknown }) => {
        if (d.id !== 'f3') return d;
        const { definition: _drop, ...rest } = d;
        return rest;
      },
    );
    const back = deserializeCat(JSON.stringify(raw));
    expect(back.warnings).toEqual([]);
    expect(getMorphism(back.state.doc.context, 'f3')?.definition).toEqual(composite);
  });

  it('pasting remaps a definition onto the new ids', () => {
    const s = defaults();
    const fragment = extractSubdiagram(s, ['A', 'B', 'C'], ['f1', 'f2', 'f3']);
    const [merged, { edgeIds }] = mergeDiagram(s, fragment, { dx: 40, dy: 40 });
    const pasted = getMorphism(merged.doc.context, edgeIds[2]!);
    expect(pasted?.definition).toEqual(compose(morphism(edgeIds[0]!), morphism(edgeIds[1]!)));
    expect(checkInvariants(merged)).toEqual([]);
    expect(isCommuting(merged, edgeIds[0] ? 'A' : 'A', 'C')).toBe(true);
  });

  it('extracting a composite without its factors strips the definition', () => {
    const fragment = extractSubdiagram(defaults(), ['A', 'C'], ['f3']);
    const m = getMorphism(fragment.doc.context, 'f3');
    expect(m).toBeDefined();
    expect(m).not.toHaveProperty('definition');
    expect(labelStatus(fragment.doc.context, 'f3').kind).toBe('unresolved');
  });
});
