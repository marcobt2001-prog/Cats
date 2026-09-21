import { describe, it, expect } from 'vitest';
import { parseLeanOutput, isSorryWarning, summarize, reportByGoal } from '../diagnostics.js';
import type { LeanRaw } from '../diagnostics.js';
import type { GeneratedLean } from '../generate.js';

const FILE = 'C:\\Users\\marco\\AppData\\Local\\Temp\\cats-lean\\check-1.lean';

function raw(over: Partial<LeanRaw> = {}): LeanRaw {
  return { stdout: '', stderr: '', exitCode: 0, timedOut: false, command: 'lake env lean', ...over };
}

/** Two goal blocks, as `generateLean` would report them. */
const gen = {
  source: '',
  names: { byId: new Map(), category: '𝒞' },
  goals: [
    { id: 'g1', startLine: 17, line: 18, endLine: 19 },
    { id: 'g2', startLine: 21, line: 22, endLine: 23 },
  ],
} as unknown as GeneratedLean;

describe('parseLeanOutput', () => {
  it('reads a positioned error, Windows path and all', () => {
    const [d] = parseLeanOutput(`${FILE}:18:2: error: unsolved goals`, '');
    expect(d).toEqual({ line: 18, col: 2, severity: 'error', message: 'unsolved goals' });
  });

  it('keeps the continuation lines of a message', () => {
    const [d] = parseLeanOutput(
      `${FILE}:18:2: error: type mismatch\n  f ≫ g\nhas type\n  A ⟶ C`,
      '',
    );
    expect(d!.message).toBe('type mismatch\n  f ≫ g\nhas type\n  A ⟶ C');
  });

  it('separates two diagnostics', () => {
    const ds = parseLeanOutput(`${FILE}:18:2: error: one\n${FILE}:22:0: warning: two`, '');
    expect(ds.map(d => [d.line, d.severity, d.message])).toEqual([
      [18, 'error', 'one'],
      [22, 'warning', 'two'],
    ]);
  });

  it('gives a positionless failure line 0', () => {
    const ds = parseLeanOutput('', 'error: no such file or directory');
    expect(ds).toEqual([{ line: 0, col: 0, severity: 'error', message: 'no such file or directory' }]);
  });

  it('reads both streams', () => {
    const ds = parseLeanOutput(`${FILE}:18:2: error: from stdout`, 'error: from stderr');
    expect(ds.map(d => d.message)).toEqual(['from stdout', 'from stderr']);
  });

  it('is empty for a clean run', () => {
    expect(parseLeanOutput('', '')).toEqual([]);
  });
});

describe('isSorryWarning', () => {
  it('spots the sorry warning', () => {
    expect(isSorryWarning({ line: 18, col: 0, severity: 'warning', message: "declaration uses 'sorry'" })).toBe(true);
    expect(isSorryWarning({ line: 18, col: 0, severity: 'warning', message: 'unused variable' })).toBe(false);
  });
});

describe('summarize', () => {
  it('is ok on a silent successful run', () => {
    expect(summarize(raw(), 1200).ok).toBe(true);
  });

  it('is not ok when Lean reports an error', () => {
    expect(summarize(raw({ stdout: `${FILE}:18:2: error: unsolved goals`, exitCode: 1 }), 900).ok).toBe(false);
  });

  it('is not ok when a declaration uses sorry, even at exit 0', () => {
    const r = summarize(raw({ stdout: `${FILE}:18:0: warning: declaration uses 'sorry'` }), 900);
    expect(r.ok).toBe(false);
  });

  it('tolerates an ordinary warning', () => {
    const r = summarize(raw({ stdout: `${FILE}:15:9: warning: unused variable \`k\`` }), 900);
    expect(r.ok).toBe(true);
  });

  it('is not ok on a timeout', () => {
    expect(summarize(raw({ timedOut: true, exitCode: null }), 120000).ok).toBe(false);
  });

  it('keeps the raw output', () => {
    const r = summarize(raw({ stdout: 'x', stderr: 'y', exitCode: 3 }), 5);
    expect(r.raw).toEqual({ stdout: 'x', stderr: 'y', exitCode: 3, timedOut: false, command: 'lake env lean' });
    expect(r.durationMs).toBe(5);
  });
});

describe('reportByGoal', () => {
  it('passes every goal when Lean is silent', () => {
    const report = reportByGoal(gen, summarize(raw(), 1000));
    expect(report.goals).toEqual([
      { id: 'g1', ok: true, diagnostics: [] },
      { id: 'g2', ok: true, diagnostics: [] },
    ]);
    expect(report.file).toEqual([]);
  });

  it('fails only the goal whose block holds the error', () => {
    const result = summarize(raw({ stdout: `${FILE}:19:2: error: unsolved goals`, exitCode: 1 }), 1000);
    const report = reportByGoal(gen, result);
    expect(report.goals[0]).toMatchObject({ id: 'g1', ok: false, message: 'Lean: unsolved goals' });
    expect(report.goals[1]).toMatchObject({ id: 'g2', ok: true });
    expect(report.file).toEqual([]);
  });

  it('fails every goal when the error is outside the blocks', () => {
    const result = summarize(raw({ stdout: `${FILE}:15:9: error: unknown identifier 'q'`, exitCode: 1 }), 1000);
    const report = reportByGoal(gen, result);
    expect(report.file).toHaveLength(1);
    expect(report.goals.every(g => !g.ok)).toBe(true);
    expect(report.goals[0]!.message).toBe("Lean: unknown identifier 'q'");
  });

  it('fails every goal when the toolchain itself failed', () => {
    const result = summarize(raw({ stderr: 'error: manifest out of date', exitCode: 1 }), 100);
    const report = reportByGoal(gen, result);
    expect(report.goals.every(g => !g.ok)).toBe(true);
    expect(report.goals[0]!.message).toBe('Lean: manifest out of date');
  });

  it('fails every goal on a timeout, with the elapsed time', () => {
    const result = summarize(raw({ timedOut: true, exitCode: null }), 120000);
    const report = reportByGoal(gen, result);
    expect(report.goals.every(g => !g.ok)).toBe(true);
    expect(report.goals[0]!.message).toBe('Lean timed out after 120000 ms');
  });

  it('reports only the first line of a long message', () => {
    const result = summarize(
      raw({ stdout: `${FILE}:18:2: error: type mismatch\n  f ≫ g\nhas type\n  A ⟶ C`, exitCode: 1 }),
      1000,
    );
    const report = reportByGoal(gen, result);
    expect(report.goals[0]!.message).toBe('Lean: type mismatch');
    expect(report.goals[0]!.diagnostics[0]!.message).toContain('has type');
  });

  it('fails a goal whose block only warns about sorry', () => {
    const result = summarize(raw({ stdout: `${FILE}:18:0: warning: declaration uses 'sorry'` }), 1000);
    expect(reportByGoal(gen, result).goals[0]).toMatchObject({ id: 'g1', ok: false });
  });
});
