import type { MorphismId, MorphismProperty, ObjectId } from '../math/types.js';
import {
  emptyDocument, declareObject, declareMorphism, removeDeclarations, renameDeclaration,
  setMorphismProperties, getMorphism, objectsOf, morphismsOf, validateContext, MathError,
} from '../math/context.js';
import { PROPERTY_TYPES } from '../math/fromDiagram.js';
import { syncDefinition, reprintDependents } from '../math/definitions.js';
import type { ArrowStyle, DiagramState, Layout, NodeLayout } from './types.js';
import { isDecoration } from './types.js';

export function createDiagram(): DiagramState {
  return { doc: emptyDocument(), layout: { nodes: {}, edges: {} } };
}

/** Today's editor behaviour: A, B, C, … by object count, wrapping at Z. */
export function defaultObjectName(s: DiagramState): string {
  return String.fromCharCode(65 + (objectsOf(s.doc.context).length % 26));
}

export function addObject(s: DiagramState, o: { x: number; y: number; name?: string }): [DiagramState, ObjectId] {
  const [doc, id] = declareObject(s.doc, { name: o.name ?? defaultObjectName(s) });
  return [{ doc, layout: { ...s.layout, nodes: { ...s.layout.nodes, [id]: { x: o.x, y: o.y } } } }, id];
}

function splitStyle(style: ArrowStyle): { properties: MorphismProperty[]; decoration?: Layout['edges'][string]['decoration'] } {
  const prop = PROPERTY_TYPES[style];
  if (prop) return { properties: [prop] };
  if (isDecoration(style)) return { properties: [], decoration: style };
  return { properties: [] };
}

export function addMorphism(
  s: DiagramState,
  m: { src: ObjectId; tgt: ObjectId; name?: string; style?: ArrowStyle },
): [DiagramState, MorphismId] {
  const { properties, decoration } = splitStyle(m.style ?? 'morphism');
  let [doc, id] = declareMorphism(s.doc, { name: m.name ?? '', source: m.src, target: m.tgt, properties });
  doc = syncDefinition(doc, id);
  const edge = decoration ? { curve: 0, decoration } : { curve: 0 };
  return [{ doc, layout: { ...s.layout, edges: { ...s.layout.edges, [id]: edge } } }, id];
}

/** Renaming an object re-prints the labels of identities on it. */
export function renameObject(s: DiagramState, id: ObjectId, name: string): DiagramState {
  const doc = reprintDependents(renameDeclaration(s.doc, id, name), id);
  return { ...s, doc };
}

/**
 * Renaming a morphism re-reads its label as a definition, then re-prints every
 * composite defined through it. One state change, so one undo entry.
 */
export function renameMorphism(s: DiagramState, id: MorphismId, name: string): DiagramState {
  const doc = reprintDependents(syncDefinition(renameDeclaration(s.doc, id, name), id), id);
  return { ...s, doc };
}

/** Derived UI style: a mathematical property wins, then a visual decoration, then plain. */
export function styleOf(s: DiagramState, id: MorphismId): ArrowStyle {
  const m = getMorphism(s.doc.context, id);
  if (!m) throw new MathError(`unknown morphism '${id}'`);
  const prop = m.properties?.[0];
  if (prop) return prop;
  return s.layout.edges[id]?.decoration ?? 'morphism';
}

/** The single writer for arrow style: sets one side (doc or layout) and clears the other. */
export function setMorphismStyle(s: DiagramState, id: MorphismId, style: ArrowStyle): DiagramState {
  const { properties, decoration } = splitStyle(style);
  const doc = setMorphismProperties(s.doc, id, properties);
  const prev = s.layout.edges[id] ?? { curve: 0 };
  const { decoration: _old, ...rest } = prev;
  const edge = decoration ? { ...rest, decoration } : rest;
  return { doc, layout: { ...s.layout, edges: { ...s.layout.edges, [id]: edge } } };
}

/** Layout only. Unknown ids are ignored. */
export function moveNodes(s: DiagramState, patches: Record<ObjectId, Partial<NodeLayout>>): DiagramState {
  const nodes = { ...s.layout.nodes };
  for (const [id, patch] of Object.entries(patches)) {
    const cur = nodes[id];
    if (cur) nodes[id] = { ...cur, ...patch };
  }
  return { ...s, layout: { ...s.layout, nodes } };
}

export function setCurve(s: DiagramState, id: MorphismId, curve: number): DiagramState {
  const cur = s.layout.edges[id];
  if (!cur) return s;
  return { ...s, layout: { ...s.layout, edges: { ...s.layout.edges, [id]: { ...cur, curve } } } };
}

/** Cascades: morphisms of deleted objects, hypotheses mentioning them, and their layout entries. */
export function deleteElements(
  s: DiagramState,
  sel: { nodeIds?: Iterable<ObjectId>; edgeIds?: Iterable<MorphismId> },
): DiagramState {
  const ids = [...(sel.nodeIds ?? []), ...(sel.edgeIds ?? [])];
  if (ids.length === 0) return s;
  const doc = removeDeclarations(s.doc, ids);
  return { doc, layout: pruneLayout(doc, s.layout) };
}

/** Keeps only layout entries whose ids still exist in the document. */
export function pruneLayout(doc: DiagramState['doc'], layout: Layout): Layout {
  const objectIds = new Set(objectsOf(doc.context).map(o => o.id));
  const morphismIds = new Set(morphismsOf(doc.context).map(m => m.id));
  return {
    nodes: Object.fromEntries(Object.entries(layout.nodes).filter(([id]) => objectIds.has(id))),
    edges: Object.fromEntries(Object.entries(layout.edges).filter(([id]) => morphismIds.has(id))),
  };
}

/** [] when the document is well-formed and layout coverage is exact in both directions. */
export function checkInvariants(s: DiagramState): string[] {
  const errors = validateContext(s.doc.context);
  const objectIds = new Set(objectsOf(s.doc.context).map(o => o.id));
  const morphismIds = new Set(morphismsOf(s.doc.context).map(m => m.id));
  for (const id of objectIds) if (!s.layout.nodes[id]) errors.push(`object '${id}' has no layout`);
  for (const id of morphismIds) if (!s.layout.edges[id]) errors.push(`morphism '${id}' has no layout`);
  for (const id of Object.keys(s.layout.nodes)) if (!objectIds.has(id)) errors.push(`layout node '${id}' has no object`);
  for (const id of Object.keys(s.layout.edges)) if (!morphismIds.has(id)) errors.push(`layout edge '${id}' has no morphism`);
  return errors;
}
