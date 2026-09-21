/**
 * The real loop, against a real Lean.
 *
 * Skipped unless the toolchain is installed and Mathlib is built, so the suite
 * is green on a machine that has never seen Lean. Once `npm run lean:setup` has
 * been done these run for real, and they are the only tests that can tell us
 * the generated syntax is actually accepted.
 */
import { describe, it, expect } from 'vitest';
// Plain Node JS, deliberately outside src/ so it cannot reach the bundle.
import { checkLean, leanStatus } from '../../../server/lean/runner.js';
import { generateLean } from '../generate.js';
import { summarize, reportByGoal } from '../diagnostics.js';
import { applyLeanResult } from '../apply.js';
import { getGoal } from '../../math/proof.js';
import { addGoal } from '../../math/proof.js';
import { emptyDocument, declareObject, declareMorphism } from '../../math/context.js';
import { setMorphismDefinition } from '../../math/definitions.js';
import { morphism, identity, compose } from '../../math/expr.js';
import { square } from '../../diagram/__tests__/fixtures.js';
import { markCommuting } from '../../diagram/commute.js';

const status: { available: boolean; reason?: string } = await leanStatus();
const RUN = status.available;

/** Level I-3: a loop labelled as the identity really is the identity. */
function identityDoc() {
  let doc = emptyDocument();
  [doc] = declareObject(doc, { name: 'A' }, 'A');
  [doc] = declareMorphism(doc, { name: '\\mathrm{id}_A', source: 'A', target: 'A' }, 'loop');
  doc = setMorphismDefinition(doc, 'loop', identity('A'));
  [doc] = addGoal(doc, { kind: 'eq', left: morphism('loop'), right: identity('A') }, 'q1');
  return doc;
}

const f = morphism('f'), g = morphism('g'), h = morphism('h'), k = morphism('k');

/** Level I-4, optionally with the square's equation asserted. */
function squareDoc(marked: boolean) {
  const s = marked ? markCommuting(square(), 'A', 'D') : square();
  return addGoal(s.doc, { kind: 'eq', left: compose(f, h), right: compose(g, k) }, 'q1')[0];
}

async function check(source: string, timeoutMs?: number) {
  const raw = await checkLean(source, timeoutMs === undefined ? {} : { timeoutMs });
  const { durationMs, ...rest } = raw;
  return summarize(rest, durationMs);
}

describe.skipIf(!RUN)('Lean accepts what CATS generates', { timeout: 180000 }, () => {
  it('proves the identity loop', async () => {
    const gen = generateLean(identityDoc());
    const result = await check(gen.source);
    expect(result.raw.stdout + result.raw.stderr).toBe('');
    expect(result.ok).toBe(true);
    expect(reportByGoal(gen, result).goals[0]!.ok).toBe(true);
  });

  it('proves the marked square from its hypothesis', async () => {
    const gen = generateLean(squareDoc(true));
    const result = await check(gen.source);
    expect(result.ok, result.raw.stdout + result.raw.stderr).toBe(true);
  });

  it('refuses the square when nothing asserts it, and says where', async () => {
    const doc = squareDoc(false);
    const gen = generateLean(doc);
    const result = await check(gen.source);
    expect(result.ok).toBe(false);

    const report = reportByGoal(gen, result);
    expect(report.goals[0]!.ok).toBe(false);
    expect(report.goals[0]!.message).toMatch(/^Lean: /);
    // The complaint is about the example, not the context around it.
    const block = gen.goals[0]!;
    expect(result.diagnostics.some(d => d.line >= block.startLine && d.line <= block.endLine)).toBe(true);

    const after = applyLeanResult(doc, gen, result);
    expect(getGoal(after, 'q1')!.status).toMatchObject({ kind: 'failed', authority: 'lean' });
  });

  it('proves the editor triangle by definition and records it', async () => {
    const doc = squareDoc(true);
    const gen = generateLean(doc);
    const result = await check(gen.source);
    const after = applyLeanResult(doc, gen, result);
    expect(getGoal(after, 'q1')!.status).toMatchObject({ kind: 'verified', authority: 'lean' });
  });

  it('reports a timeout rather than hanging', async () => {
    const gen = generateLean(identityDoc());
    const result = await check(gen.source, 1);
    expect(result.raw.timedOut).toBe(true);
    expect(result.ok).toBe(false);
    expect(reportByGoal(gen, result).goals[0]!.message).toMatch(/timed out/);
  });

  it('serializes concurrent checks', async () => {
    const source = generateLean(identityDoc()).source;
    const [a, b] = await Promise.all([check(source), check(source)]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });
});
