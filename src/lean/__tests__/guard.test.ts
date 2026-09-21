import { describe, it, expect } from 'vitest';
// The runner is plain Node JS, deliberately outside src/ so it cannot reach the bundle.
import { guardSource, projectDir } from '../../../server/lean/runner.js';
import { generateLean } from '../generate.js';
import { square } from '../../diagram/__tests__/fixtures.js';
import { markCommuting } from '../../diagram/commute.js';
import { addGoal } from '../../math/proof.js';
import { morphism, compose } from '../../math/expr.js';

function generatedSource(): string {
  const s = markCommuting(square(), 'A', 'D');
  const [doc] = addGoal(
    s.doc,
    { kind: 'eq', left: compose(morphism('f'), morphism('h')), right: compose(morphism('g'), morphism('k')) },
    'q1',
  );
  return generateLean(doc).source;
}

describe('guardSource', () => {
  it('accepts what the generator produces', () => {
    expect(guardSource(generatedSource())).toBeNull();
  });

  it('refuses an empty or oversized source', () => {
    expect(guardSource('')).toMatch(/empty/);
    expect(guardSource('   ')).toMatch(/empty/);
    expect(guardSource(`-- ${'x'.repeat(1_000_001)}`)).toMatch(/too large/);
  });

  it('refuses imports outside Mathlib', () => {
    expect(guardSource('import Std.Data.List.Basic\nexample : True := trivial')).toMatch(/only Mathlib imports/);
  });

  it('refuses commands and metaprogramming', () => {
    expect(guardSource('import Mathlib.Tactic\n#eval 1 + 1')).toMatch(/commands are not allowed/);
    expect(guardSource('import Mathlib.Tactic\nrun_cmd pure ()')).toMatch(/not allowed/);
    expect(guardSource('import Mathlib.Tactic\nunsafe def x := 1')).toMatch(/not allowed/);
  });

  it('names a project directory', () => {
    expect(typeof projectDir()).toBe('string');
    expect(projectDir().length).toBeGreaterThan(0);
  });
});
