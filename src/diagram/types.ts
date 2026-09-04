/**
 * Diagram state = mathematics (a MathDocument) + presentation (a Layout).
 *
 * The two are kept in separate fields on purpose. Moving a node or bending an
 * arrow touches only `layout`; renaming, drawing, or asserting an equation
 * touches only `doc`. Ids are the bridge: every object/morphism id in the
 * document has a layout entry and vice versa (see `checkInvariants`).
 */
import type { MathDocument, MorphismId, ObjectId } from '../math/types.js';

/** The nine arrow styles the UI offers. Derived, never stored as such. */
export type ArrowStyle =
  | 'morphism' | 'mono' | 'epi' | 'iso'
  | 'dashed' | 'natural' | 'exact' | 'equiv' | 'dotted';

/** Purely visual arrow styles. Stored in the layout only. */
export type Decoration = 'dashed' | 'dotted' | 'natural' | 'exact' | 'equiv';

export const ARROW_STYLES: readonly ArrowStyle[] =
  ['morphism', 'mono', 'epi', 'iso', 'dashed', 'natural', 'exact', 'equiv', 'dotted'];
export const DECORATIONS: readonly Decoration[] = ['dashed', 'dotted', 'natural', 'exact', 'equiv'];

export function isArrowStyle(s: string): s is ArrowStyle {
  return (ARROW_STYLES as readonly string[]).includes(s);
}
export function isDecoration(s: string): s is Decoration {
  return (DECORATIONS as readonly string[]).includes(s);
}

export interface NodeLayout { x: number; y: number }
export interface EdgeLayout { curve: number; decoration?: Decoration }

export interface Layout {
  nodes: Record<ObjectId, NodeLayout>;
  edges: Record<MorphismId, EdgeLayout>;
}

export interface DiagramState {
  doc: MathDocument;
  layout: Layout;
}

/** Legacy render shape consumed by Node.jsx, AlignToolbar.jsx, export.js. */
export interface NodeView { id: ObjectId; label: string; x: number; y: number }
/** Legacy render shape consumed by Edge.jsx, CommChecker.jsx, export.js. */
export interface EdgeView { id: MorphismId; label: string; src: ObjectId; tgt: ObjectId; type: ArrowStyle; curve: number }
export interface DiagramViews { nodes: NodeView[]; edges: EdgeView[] }
