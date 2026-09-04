/**
 * CATS mathematical intermediate representation (IR).
 *
 * This module holds types only. It describes mathematical meaning independently
 * of any canvas: no coordinates, no curvature, no colours. The visual layer maps
 * onto these entities by id (see fromDiagram.ts).
 *
 * Lean/Mathlib is the authority on what a proof is. Nothing here can claim a
 * goal is verified; see `GoalStatus`.
 */

// ── Ids ────────────────────────────────────────────────────────────────────
export type ObjectId = string;
export type MorphismId = string;
export type HypothesisId = string;
export type GoalId = string;
export type StepId = string;

// ── Lean references ────────────────────────────────────────────────────────
/**
 * A pointer from a CATS entity to something that already exists in Lean/Mathlib.
 * Phase 1 only reserves the slot; generation and checking come later.
 */
export type LeanReference =
  | { kind: 'const'; name: string; module?: string } // e.g. { name: 'Prod.fst' }
  | { kind: 'raw'; text: string };                    // verbatim Lean expression text

// ── Morphism expressions ───────────────────────────────────────────────────
/**
 * Composition is stored in DIAGRAMMATIC (path) order: `factors[0]` is applied
 * first. So `compose(f, g)` means "f, then g", which is Mathlib's `f ≫ g` and
 * the classical `g ∘ f`. Invariant: `factors.length >= 1`.
 */
export type MorphismExpr =
  | { kind: 'morphism'; ref: MorphismId }
  | { kind: 'identity'; object: ObjectId }
  | { kind: 'compose'; factors: MorphismExpr[] };

// ── Propositions ───────────────────────────────────────────────────────────
/** Well-formed only when `left` and `right` are parallel (same source and target). */
export type Proposition = { kind: 'eq'; left: MorphismExpr; right: MorphismExpr };

/** Mathematical properties a morphism may be tagged with. Promoted to propositions later. */
export type MorphismProperty = 'mono' | 'epi' | 'iso';

// ── Declarations (ordered, like a Lean context) ────────────────────────────
export interface ObjectDecl {
  kind: 'object';
  id: ObjectId;
  name: string;
  lean?: LeanReference;
}

export interface MorphismDecl {
  kind: 'morphism';
  id: MorphismId;
  name: string;
  source: ObjectId;
  target: ObjectId;
  properties?: MorphismProperty[];
  /**
   * The morphism abbreviates this expression and equals it by definition.
   * Must be parallel to the morphism and acyclic; it may reference declarations
   * that come later in the context (an arrow is usually drawn before it is labelled).
   */
  definition?: MorphismExpr;
  lean?: LeanReference;
}

export interface HypothesisDecl {
  kind: 'hypothesis';
  id: HypothesisId;
  name?: string;
  prop: Proposition;
  lean?: LeanReference;
}

export type Declaration = ObjectDecl | MorphismDecl | HypothesisDecl;

/** Order matters: a morphism must follow its objects, a hypothesis its morphisms. */
export interface MathContext {
  declarations: Declaration[];
}

// ── Goals and proof steps ──────────────────────────────────────────────────
/**
 * `believed` is CATS' own reasoning and is NOT a proof.
 * `verified` requires `authority: 'lean'`; no function in src/math constructs it.
 */
export type GoalStatus =
  | { kind: 'open' }
  | { kind: 'believed'; by: StepId }
  | { kind: 'verified'; authority: 'lean'; message?: string }
  | { kind: 'failed'; authority: 'lean' | 'cats'; message: string };

export interface ProofGoal {
  id: GoalId;
  prop: Proposition;
  status: GoalStatus;
}

export interface ProofStep {
  id: StepId;
  /** e.g. 'refl-normalize'; later 'product-uniqueness', 'lean-tactic', ... */
  kind: string;
  /** Ids of goals / hypotheses / morphisms this step consumed. */
  inputs: string[];
  /** Ids of goals / hypotheses / morphisms this step produced. */
  outputs: string[];
  /** Reserved for the Lean generator (Phase 4+). */
  generatedLean?: string;
}

// ── The serialized unit ────────────────────────────────────────────────────
export interface MathDocument {
  format: 'cats-math';
  version: 1;
  /** Id counter travels with the document so ids survive save/load. */
  nextId: number;
  context: MathContext;
  goals: ProofGoal[];
  steps: ProofStep[];
}

/** Exhaustiveness helper: `default: return assertNever(x)` in switches over unions. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
