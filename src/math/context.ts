import type {
  Declaration, HypothesisDecl, HypothesisId, LeanReference, MathContext, MathDocument,
  MorphismDecl, MorphismId, MorphismProperty, ObjectDecl, ObjectId, Proposition,
} from './types.js';
import { MathError, mentions, typeOf } from './expr.js';

export { MathError };

// ── Editing existing declarations ──────────────────────────────────────────
/**
 * Removes the given declarations and everything that depends on them:
 * morphisms of removed objects, hypotheses and goals mentioning removed ids.
 * Steps referencing removed goals are left for `validateDocument` to flag.
 */
export function removeDeclarations(doc: MathDocument, ids: Iterable<string>): MathDocument {
  const gone = new Set(ids);
  // Cascade objects → their morphisms.
  for (const d of doc.context.declarations) {
    if (d.kind === 'morphism' && (gone.has(d.source) || gone.has(d.target))) gone.add(d.id);
  }
  const declarations = doc.context.declarations.filter(d => {
    if (gone.has(d.id)) return false;
    if (d.kind === 'hypothesis' && (mentions(d.prop.left, gone) || mentions(d.prop.right, gone))) return false;
    return true;
  });
  const goals = doc.goals.filter(g => !gone.has(g.id) && !mentions(g.prop.left, gone) && !mentions(g.prop.right, gone));
  return { ...doc, context: { declarations }, goals };
}

export function renameDeclaration(doc: MathDocument, id: string, name: string): MathDocument {
  if (!doc.context.declarations.some(d => d.id === id)) throw new MathError(`unknown declaration '${id}'`);
  return {
    ...doc,
    context: { declarations: doc.context.declarations.map(d => (d.id === id ? { ...d, name } : d)) },
  };
}

export function setMorphismProperties(doc: MathDocument, id: MorphismId, properties: MorphismProperty[]): MathDocument {
  const m = getMorphism(doc.context, id);
  if (!m) throw new MathError(`unknown morphism '${id}'`);
  const { properties: _old, ...rest } = m;
  const next: MorphismDecl = properties.length > 0 ? { ...rest, properties: [...properties] } : rest;
  return {
    ...doc,
    context: { declarations: doc.context.declarations.map(d => (d.id === id ? next : d)) },
  };
}

// ── Documents and ids ──────────────────────────────────────────────────────
export function emptyDocument(): MathDocument {
  return {
    format: 'cats-math',
    version: 1,
    nextId: 1,
    context: { declarations: [] },
    goals: [],
    steps: [],
  };
}

export type IdPrefix = 'o' | 'm' | 'h' | 'g' | 's';

/** Every id already in use anywhere in the document. */
export function usedIds(doc: MathDocument): Set<string> {
  const s = new Set<string>();
  for (const d of doc.context.declarations) s.add(d.id);
  for (const g of doc.goals) s.add(g.id);
  for (const st of doc.steps) s.add(st.id);
  return s;
}

/**
 * Mints an unused id from the document's own counter. Caller-supplied ids
 * (e.g. copied from diagram node ids) are skipped over, never clobbered.
 */
export function freshId(doc: MathDocument, prefix: IdPrefix): [MathDocument, string] {
  const used = usedIds(doc);
  let n = doc.nextId;
  let id = `${prefix}${n}`;
  while (used.has(id)) { n += 1; id = `${prefix}${n}`; }
  return [{ ...doc, nextId: n + 1 }, id];
}

function assertUnused(doc: MathDocument, id: string): void {
  if (usedIds(doc).has(id)) throw new MathError(`id '${id}' is already in use`);
}

function withDecl(doc: MathDocument, d: Declaration): MathDocument {
  return { ...doc, context: { declarations: [...doc.context.declarations, d] } };
}

// ── Declarations ───────────────────────────────────────────────────────────
export function declareObject(
  doc: MathDocument,
  d: { name: string; lean?: LeanReference },
  id?: ObjectId,
): [MathDocument, ObjectId] {
  let next = doc;
  let oid = id;
  if (oid === undefined) [next, oid] = freshId(next, 'o');
  else assertUnused(next, oid);
  const decl: ObjectDecl = { kind: 'object', id: oid, name: d.name, ...(d.lean ? { lean: d.lean } : {}) };
  return [withDecl(next, decl), oid];
}

export function declareMorphism(
  doc: MathDocument,
  d: { name: string; source: ObjectId; target: ObjectId; properties?: MorphismProperty[]; lean?: LeanReference },
  id?: MorphismId,
): [MathDocument, MorphismId] {
  if (!getObject(doc.context, d.source)) throw new MathError(`unknown source object '${d.source}'`);
  if (!getObject(doc.context, d.target)) throw new MathError(`unknown target object '${d.target}'`);
  let next = doc;
  let mid = id;
  if (mid === undefined) [next, mid] = freshId(next, 'm');
  else assertUnused(next, mid);
  const decl: MorphismDecl = {
    kind: 'morphism', id: mid, name: d.name, source: d.source, target: d.target,
    ...(d.properties && d.properties.length > 0 ? { properties: [...d.properties] } : {}),
    ...(d.lean ? { lean: d.lean } : {}),
  };
  return [withDecl(next, decl), mid];
}

export function declareHypothesis(
  doc: MathDocument,
  d: { prop: Proposition; name?: string; lean?: LeanReference },
  id?: HypothesisId,
): [MathDocument, HypothesisId] {
  const err = propositionError(doc.context, d.prop);
  if (err) throw new MathError(err);
  let next = doc;
  let hid = id;
  if (hid === undefined) [next, hid] = freshId(next, 'h');
  else assertUnused(next, hid);
  const decl: HypothesisDecl = {
    kind: 'hypothesis', id: hid, prop: d.prop,
    ...(d.name !== undefined ? { name: d.name } : {}),
    ...(d.lean ? { lean: d.lean } : {}),
  };
  return [withDecl(next, decl), hid];
}

// ── Lookups ────────────────────────────────────────────────────────────────
export function getObject(ctx: MathContext, id: ObjectId): ObjectDecl | undefined {
  return ctx.declarations.find((d): d is ObjectDecl => d.kind === 'object' && d.id === id);
}

export function getMorphism(ctx: MathContext, id: MorphismId): MorphismDecl | undefined {
  return ctx.declarations.find((d): d is MorphismDecl => d.kind === 'morphism' && d.id === id);
}

export function getHypothesis(ctx: MathContext, id: HypothesisId): HypothesisDecl | undefined {
  return ctx.declarations.find((d): d is HypothesisDecl => d.kind === 'hypothesis' && d.id === id);
}

export function objectsOf(ctx: MathContext): ObjectDecl[] {
  return ctx.declarations.filter((d): d is ObjectDecl => d.kind === 'object');
}

export function morphismsOf(ctx: MathContext): MorphismDecl[] {
  return ctx.declarations.filter((d): d is MorphismDecl => d.kind === 'morphism');
}

export function hypothesesOf(ctx: MathContext): HypothesisDecl[] {
  return ctx.declarations.filter((d): d is HypothesisDecl => d.kind === 'hypothesis');
}

// ── Validation ─────────────────────────────────────────────────────────────
/** `undefined` when the proposition is well-formed in `ctx`, else a message. */
export function propositionError(ctx: MathContext, p: Proposition): string | undefined {
  const l = typeOf(ctx, p.left);
  if (!l.ok) return `left side: ${l.error}`;
  const r = typeOf(ctx, p.right);
  if (!r.ok) return `right side: ${r.error}`;
  if (l.source !== r.source || l.target !== r.target) {
    return `sides are not parallel: ${l.source} → ${l.target} vs ${r.source} → ${r.target}`;
  }
  return undefined;
}

/**
 * Well-formedness of a context: unique ids, references resolve to earlier
 * declarations, equalities are between parallel morphisms. Returns [] if OK.
 */
export function validateContext(ctx: MathContext): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const soFar: MathContext = { declarations: [] };
  for (const d of ctx.declarations) {
    if (seen.has(d.id)) errors.push(`duplicate id '${d.id}'`);
    seen.add(d.id);
    switch (d.kind) {
      case 'object':
        break;
      case 'morphism':
        if (!getObject(soFar, d.source)) errors.push(`morphism '${d.id}': unknown source object '${d.source}'`);
        if (!getObject(soFar, d.target)) errors.push(`morphism '${d.id}': unknown target object '${d.target}'`);
        break;
      case 'hypothesis': {
        const err = propositionError(soFar, d.prop);
        if (err) errors.push(`hypothesis '${d.id}': ${err}`);
        break;
      }
    }
    soFar.declarations.push(d);
  }
  return errors;
}

/** Context validity plus goal typing, step reference resolution, and global id uniqueness. */
export function validateDocument(doc: MathDocument): string[] {
  const errors = validateContext(doc.context);
  const ids = new Set(doc.context.declarations.map(d => d.id));
  for (const g of doc.goals) {
    if (ids.has(g.id)) errors.push(`duplicate id '${g.id}'`);
    ids.add(g.id);
    const err = propositionError(doc.context, g.prop);
    if (err) errors.push(`goal '${g.id}': ${err}`);
  }
  for (const s of doc.steps) {
    if (ids.has(s.id)) errors.push(`duplicate id '${s.id}'`);
    ids.add(s.id);
  }
  for (const s of doc.steps) {
    for (const ref of [...s.inputs, ...s.outputs]) {
      if (!ids.has(ref)) errors.push(`step '${s.id}': unknown reference '${ref}'`);
    }
  }
  for (const g of doc.goals) {
    const st = g.status;
    if (st.kind === 'believed' && !doc.steps.some(s => s.id === st.by)) {
      errors.push(`goal '${g.id}': believed by unknown step '${st.by}'`);
    }
  }
  return errors;
}
