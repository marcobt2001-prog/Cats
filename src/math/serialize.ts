import type { MathDocument } from './types.js';
import { MathError, validateDocument } from './context.js';

export const FORMAT_NAME = 'cats-math';
export const FORMAT_VERSION = 1;

export function serializeDocument(doc: MathDocument): string {
  return JSON.stringify(doc, null, 2);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Parses and validates. Shape checks are shallow on purpose: anything the
 * shape check lets through is then run through `validateDocument`, which
 * catches dangling references and ill-typed propositions.
 */
export function deserializeDocument(json: string): MathDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new MathError(`invalid JSON: ${(e as Error).message}`);
  }
  if (!isRecord(raw)) throw new MathError('document must be a JSON object');
  if (raw['format'] !== FORMAT_NAME) throw new MathError(`unknown format '${String(raw['format'])}'`);
  if (raw['version'] !== FORMAT_VERSION) throw new MathError(`unsupported version '${String(raw['version'])}'`);
  if (typeof raw['nextId'] !== 'number' || !Number.isInteger(raw['nextId']) || raw['nextId'] < 1) {
    throw new MathError('nextId must be a positive integer');
  }
  const ctx = raw['context'];
  if (!isRecord(ctx) || !Array.isArray(ctx['declarations'])) throw new MathError('missing context.declarations');
  if (!Array.isArray(raw['goals'])) throw new MathError('missing goals');
  if (!Array.isArray(raw['steps'])) throw new MathError('missing steps');

  const doc = raw as unknown as MathDocument;
  const errors = validateDocument(doc);
  if (errors.length > 0) throw new MathError(`invalid document: ${errors.join('; ')}`);
  return doc;
}
