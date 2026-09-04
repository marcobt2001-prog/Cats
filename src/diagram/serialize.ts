/**
 * The `.cat` file format.
 *
 * v0.2: `{ version: '0.2', meta, math: MathDocument, layout: Layout }`
 * v0.1 (legacy, also when `version` is absent): `{ version: '0.1', meta, nodes, edges, commGroups }`
 */
import { MathError } from '../math/context.js';
import { deserializeDocument } from '../math/serialize.js';
import { objectsOf, morphismsOf } from '../math/context.js';
import type { DiagramState, EdgeLayout, Layout, NodeLayout } from './types.js';
import { isDecoration } from './types.js';
import { checkInvariants } from './state.js';
import { fromLegacyDiagram } from './legacy.js';

export const CAT_VERSION = '0.2';

export interface CatMeta { title?: string; date?: string; [k: string]: unknown }

export interface CatLoadResult { state: DiagramState; meta: CatMeta; warnings: string[] }

export function serializeCat(s: DiagramState, meta: CatMeta = {}): string {
  return JSON.stringify(
    {
      version: CAT_VERSION,
      meta: { title: 'Untitled', date: new Date().toISOString(), ...meta },
      math: s.doc,
      layout: s.layout,
    },
    null,
    2,
  );
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function num(x: unknown): number | undefined {
  return typeof x === 'number' && Number.isFinite(x) ? x : undefined;
}

export function deserializeCat(json: string): CatLoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new MathError(`invalid JSON: ${(e as Error).message}`);
  }
  if (!isRecord(raw)) throw new MathError('file must be a JSON object');
  const meta: CatMeta = isRecord(raw['meta']) ? (raw['meta'] as CatMeta) : {};
  const version = raw['version'];

  if (version === undefined || version === '0.1') {
    const nodes = Array.isArray(raw['nodes']) ? raw['nodes'] : [];
    const edges = Array.isArray(raw['edges']) ? raw['edges'] : [];
    const groups = isRecord(raw['commGroups']) ? (raw['commGroups'] as Record<string, string[]>) : {};
    const { state, warnings } = fromLegacyDiagram(nodes, edges, groups);
    return { state, meta, warnings };
  }

  if (version !== CAT_VERSION) throw new MathError(`unsupported .cat version '${String(version)}'`);

  const doc = deserializeDocument(JSON.stringify(raw['math']));
  const warnings: string[] = [];
  const rawLayout = isRecord(raw['layout']) ? raw['layout'] : {};
  const rawNodes = isRecord(rawLayout['nodes']) ? rawLayout['nodes'] : {};
  const rawEdges = isRecord(rawLayout['edges']) ? rawLayout['edges'] : {};

  const layout: Layout = { nodes: {}, edges: {} };
  for (const o of objectsOf(doc.context)) {
    const entry = rawNodes[o.id];
    const x = isRecord(entry) ? num(entry['x']) : undefined;
    const y = isRecord(entry) ? num(entry['y']) : undefined;
    if (x === undefined || y === undefined) warnings.push(`object '${o.id}': missing layout, placed at origin`);
    const node: NodeLayout = { x: x ?? 0, y: y ?? 0 };
    layout.nodes[o.id] = node;
  }
  for (const m of morphismsOf(doc.context)) {
    const entry = rawEdges[m.id];
    const curve = isRecord(entry) ? num(entry['curve']) : undefined;
    if (curve === undefined) warnings.push(`morphism '${m.id}': missing layout, curve set to 0`);
    const edge: EdgeLayout = { curve: curve ?? 0 };
    const deco = isRecord(entry) ? entry['decoration'] : undefined;
    if (typeof deco === 'string') {
      if (isDecoration(deco)) edge.decoration = deco;
      else warnings.push(`morphism '${m.id}': unknown decoration '${deco}' dropped`);
    }
    layout.edges[m.id] = edge;
  }
  for (const id of Object.keys(rawNodes)) if (!layout.nodes[id]) warnings.push(`layout node '${id}' has no object; dropped`);
  for (const id of Object.keys(rawEdges)) if (!layout.edges[id]) warnings.push(`layout edge '${id}' has no morphism; dropped`);

  const state: DiagramState = { doc, layout };
  const errors = checkInvariants(state);
  if (errors.length > 0) throw new MathError(`invalid diagram: ${errors.join('; ')}`);
  return { state, meta, warnings };
}
