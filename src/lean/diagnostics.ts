/**
 * Reading Lean's output back.
 *
 * Lean reports `<file>:<line>:<col>: <severity>: <message>`, with the message
 * running on until the next such header. Toolchain failures (a missing file, a
 * stale manifest) have no position at all; those get line 0 and are treated as
 * failing the whole file rather than any one goal.
 *
 * §33 of the development plan asks for the raw output alongside a basic
 * interpretation, so nothing here discards text: `LeanResult.raw` keeps it.
 */
import type { GoalId } from '../math/types.js';
import type { GeneratedLean } from './generate.js';

export interface LeanDiagnostic {
  /** 1-based; 0 when Lean gave no position. */
  line: number;
  col: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface LeanRaw {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  command: string;
}

export interface LeanResult {
  ok: boolean;
  diagnostics: LeanDiagnostic[];
  durationMs: number;
  raw: LeanRaw;
}

export interface GoalReport {
  id: GoalId;
  ok: boolean;
  diagnostics: LeanDiagnostic[];
  message?: string;
}

// A Windows path starts `C:\`, so the lazy prefix must not eat the drive colon;
// anchoring on `:line:col:` after it does the job.
const HEADER = /^(.*?):(\d+):(\d+): (error|warning|info): ?(.*)$/;
const POSITIONLESS = /^(?:error|warning|info): ?(.*)$/;

function parseStream(text: string, out: LeanDiagnostic[]): void {
  let current: LeanDiagnostic | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const header = HEADER.exec(raw);
    if (header) {
      current = {
        line: Number(header[2]),
        col: Number(header[3]),
        severity: header[4] as LeanDiagnostic['severity'],
        message: header[5] ?? '',
      };
      out.push(current);
      continue;
    }
    const bare = POSITIONLESS.exec(raw);
    if (bare) {
      const severity = raw.startsWith('error') ? 'error' : raw.startsWith('warning') ? 'warning' : 'info';
      current = { line: 0, col: 0, severity, message: bare[1] ?? '' };
      out.push(current);
      continue;
    }
    // A continuation of the message above it.
    if (current && raw.trim() !== '') current.message += `\n${raw}`;
  }
}

export function parseLeanOutput(stdout: string, stderr: string): LeanDiagnostic[] {
  const out: LeanDiagnostic[] = [];
  parseStream(stdout, out);
  parseStream(stderr, out);
  return out.map(d => ({ ...d, message: d.message.trimEnd() }));
}

/** `sorry` compiles, so Lean only warns. For us it means the goal was not proved. */
export function isSorryWarning(d: LeanDiagnostic): boolean {
  return d.severity === 'warning' && /uses '?sorry'?/.test(d.message);
}

export function summarize(raw: LeanRaw, durationMs: number): LeanResult {
  const diagnostics = parseLeanOutput(raw.stdout, raw.stderr);
  const ok =
    !raw.timedOut &&
    raw.exitCode === 0 &&
    !diagnostics.some(d => d.severity === 'error') &&
    !diagnostics.some(isSorryWarning);
  return { ok, diagnostics, durationMs, raw };
}

function firstLine(s: string): string {
  return s.split('\n')[0] ?? '';
}

/**
 * Splits the diagnostics between the file as a whole and each goal's block.
 * Anything outside every block (a bad `variable` line, say) breaks the file, so
 * every goal fails with it: the run proved nothing.
 */
export function reportByGoal(
  gen: GeneratedLean,
  result: LeanResult,
): { file: LeanDiagnostic[]; goals: GoalReport[] } {
  const inBlock = (d: LeanDiagnostic): GoalId | undefined =>
    gen.goals.find(b => d.line >= b.startLine && d.line <= b.endLine)?.id;

  const file = result.diagnostics.filter(d => d.line === 0 || inBlock(d) === undefined);
  const fileErrors = file.filter(d => d.severity === 'error' || isSorryWarning(d));

  if (result.raw.timedOut) {
    const message = `Lean timed out after ${result.durationMs} ms`;
    return { file, goals: gen.goals.map(b => ({ id: b.id, ok: false, diagnostics: [], message })) };
  }

  const goals: GoalReport[] = gen.goals.map(b => {
    const mine = result.diagnostics.filter(d => inBlock(d) === b.id);
    const bad = [...fileErrors, ...mine.filter(d => d.severity === 'error' || isSorryWarning(d))];
    const report: GoalReport = { id: b.id, ok: bad.length === 0, diagnostics: mine };
    if (bad.length > 0) report.message = `Lean: ${firstLine(bad[0]!.message)}`;
    return report;
  });

  return { file, goals };
}
