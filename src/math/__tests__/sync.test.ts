import { describe, it, expect } from 'vitest';
import { emptyDocument, declareObject, declareMorphism, renameDeclaration, getMorphism } from '../context.js';
import { fromDiagram } from '../fromDiagram.js';
import { morphism, identity, compose } from '../expr.js';
import { labelStatus, syncDefinition, inferDefinitions, reprintDependents, setMorphismDefinition } from '../definitions.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from './fixtures.js';

/** Editor defaults: f : A→B (f1), g : B→C (f2), `g \circ f` : A→C (f3). */
function defaults() {
  return { ...emptyDocument(), context: fromDiagram(DEFAULT_NODES, DEFAULT_EDGES).context };
}
const composite = compose(morphism('f1'), morphism('f2'));

describe('inferDefinitions', () => {
  it("makes the editor's `g \\circ f` arrow a real composite", () => {
    const doc = inferDefinitions(defaults());
    expect(getMorphism(doc.context, 'f3')?.definition).toEqual(composite);
    expect(labelStatus(doc.context, 'f3')).toEqual({ kind: 'defined', expr: composite });
    expect(labelStatus(doc.context, 'f1')).toEqual({ kind: 'atomic' });
  });

  it('is idempotent and never strips a stored definition', () => {
    const once = inferDefinitions(defaults());
    expect(inferDefinitions(once)).toEqual(once);
    // A definition whose label stopped resolving survives an import.
    const renamed = renameDeclaration(once, 'f3', 'q');
    expect(getMorphism(inferDefinitions(renamed).context, 'f3')?.definition).toEqual(composite);
  });

  it('reads an identity label', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A' }, 'A');
    [doc] = declareMorphism(doc, { name: '\\mathrm{id}_A', source: 'A', target: 'A' }, 'i');
    expect(getMorphism(inferDefinitions(doc).context, 'i')?.definition).toEqual(identity('A'));
  });
});

describe('syncDefinition', () => {
  it('sets on a composite label and strips on a plain name', () => {
    const doc = inferDefinitions(defaults());
    const plain = syncDefinition(renameDeclaration(doc, 'f3', 'h'), 'f3');
    expect(getMorphism(plain.context, 'f3')).not.toHaveProperty('definition');
    expect(labelStatus(plain.context, 'f3')).toEqual({ kind: 'atomic' });
    const back = syncDefinition(renameDeclaration(plain, 'f3', 'g \\circ f'), 'f3');
    expect(getMorphism(back.context, 'f3')?.definition).toEqual(composite);
  });

  it('strips and reports when the label cannot be resolved', () => {
    const doc = inferDefinitions(defaults());
    const broken = syncDefinition(renameDeclaration(doc, 'f3', 'g \\circ x'), 'f3');
    expect(getMorphism(broken.context, 'f3')).not.toHaveProperty('definition');
    expect(labelStatus(broken.context, 'f3')).toEqual({ kind: 'unresolved', error: "unknown morphism 'x'" });
    const wrongWay = syncDefinition(renameDeclaration(doc, 'f3', 'f \\circ g'), 'f3');
    expect(labelStatus(wrongWay.context, 'f3').kind).toBe('unresolved');
  });

  it('never lets a morphism define itself', () => {
    const doc = inferDefinitions(defaults());
    const self = syncDefinition(renameDeclaration(doc, 'f3', 'g \\circ f'), 'f3');
    // `f3` is excluded from its own lookup, so a label naming itself is atomic.
    const named = syncDefinition(renameDeclaration(self, 'f3', 'q \\circ f'), 'f3');
    expect(labelStatus(named.context, 'f3').kind).toBe('unresolved');
  });

  it('returns the same document when nothing changes', () => {
    const doc = inferDefinitions(defaults());
    expect(syncDefinition(doc, 'f1')).toBe(doc);
  });

  it('an ambiguous factor name leaves the morphism unresolved', () => {
    let doc = inferDefinitions(defaults());
    [doc] = declareMorphism(doc, { name: 'f', source: 'A', target: 'B' }, 'dup');
    const synced = syncDefinition(doc, 'f3');
    expect(labelStatus(synced.context, 'f3')).toEqual({ kind: 'unresolved', error: "ambiguous name 'f'" });
  });
});

describe('reprintDependents', () => {
  it('re-labels a composite when a factor is renamed', () => {
    const doc = inferDefinitions(defaults());
    const renamed = renameDeclaration(doc, 'f1', '\\phi');
    const after = reprintDependents(renamed, 'f1');
    expect(getMorphism(after.context, 'f3')?.name).toBe('g \\circ \\phi');
    expect(getMorphism(after.context, 'f3')?.definition).toEqual(composite);
  });

  it('re-labels an identity when its object is renamed', () => {
    let doc = emptyDocument();
    [doc] = declareObject(doc, { name: 'A' }, 'A');
    [doc] = declareMorphism(doc, { name: '\\mathrm{id}_A', source: 'A', target: 'A' }, 'i');
    doc = inferDefinitions(doc);
    const after = reprintDependents(renameDeclaration(doc, 'A', 'X'), 'A');
    expect(getMorphism(after.context, 'i')?.name).toBe('\\mathrm{id}_X');
  });

  it('parenthesizes a nested composite so the new label still parses', () => {
    let doc = inferDefinitions(defaults());
    [doc] = declareMorphism(doc, { name: 'z', source: 'C', target: 'C' }, 'z');
    [doc] = declareMorphism(doc, { name: 'w', source: 'A', target: 'C' }, 'w');
    doc = setMorphismDefinition(doc, 'w', compose(morphism('f3'), morphism('z')));
    const after = reprintDependents(renameDeclaration(doc, 'z', 'ζ'), 'z');
    expect(getMorphism(after.context, 'w')?.name).toBe('ζ \\circ (g \\circ f)');
  });

  it('leaves unrelated morphisms alone', () => {
    const doc = inferDefinitions(defaults());
    expect(reprintDependents(doc, 'f3')).toBe(doc);
  });
});
