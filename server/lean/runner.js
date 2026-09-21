/**
 * Running Lean, as a child process, on this machine only.
 *
 * Lives outside `src/` on purpose: nothing here may end up in the browser
 * bundle. The dev server exposes it (see vite-plugin.js); a built, deployed
 * app has no endpoint at all and the UI says so.
 *
 * Windows notes: elan's bin directory is resolved explicitly, because a dev
 * server started before elan was installed will not have it on PATH; and a
 * timeout kills the whole tree, because `lake` spawns `lean` as a child.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WINDOWS = process.platform === 'win32';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/**
 * Where the lake project lives. The repo may sit inside OneDrive, and the
 * Mathlib build is hundreds of thousands of files, so it is kept elsewhere by
 * default; `lean/` in the repo holds only the small source files.
 */
export function projectDir() {
  if (process.env.CATS_LEAN_DIR) return path.resolve(process.env.CATS_LEAN_DIR);
  return path.join(REPO, 'lean');
}

function elanBin() {
  return path.join(os.homedir(), '.elan', 'bin');
}

function exe(name) {
  const local = path.join(elanBin(), WINDOWS ? `${name}.exe` : name);
  return existsSync(local) ? local : name;
}

function spawnEnv() {
  const bin = elanBin();
  const current = process.env.PATH ?? '';
  return { ...process.env, PATH: current.includes(bin) ? current : `${bin}${path.delimiter}${current}` };
}

/** Runs a command to completion, capturing both streams. Never rejects. */
function run(command, args, { cwd, timeoutMs = 20000 } = {}) {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(command, args, { cwd, env: spawnEnv(), windowsHide: true });
    } catch (e) {
      resolve({ stdout: '', stderr: String(e && e.message ? e.message : e), exitCode: null, timedOut: false });
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', d => { stdout += d; });
    child.stderr?.on('data', d => { stderr += d; });

    const timer = setTimeout(() => {
      timedOut = true;
      // `lake env lean` spawns lean; killing only lake would leave it running.
      if (WINDOWS && child.pid) spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { windowsHide: true });
      else child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', e => {
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + String(e && e.message ? e.message : e), exitCode: null, timedOut });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, timedOut });
    });
  });
}

// ── Availability ───────────────────────────────────────────────────────────
let statusCache = { at: 0, value: undefined };
const STATUS_TTL_MS = 60000;

async function readToolchain(dir) {
  try {
    return (await readFile(path.join(dir, 'lean-toolchain'), 'utf8')).trim();
  } catch {
    return undefined;
  }
}

async function mathlibBuilt(dir) {
  const build = path.join(dir, '.lake', 'packages', 'mathlib', '.lake', 'build', 'lib');
  const tail = path.join('Mathlib', 'CategoryTheory', 'Category', 'Basic.olean');
  // Lake nests built oleans under `lib/lean/`; older layouts put them in `lib/`.
  for (const candidate of [path.join(build, 'lean', tail), path.join(build, tail)]) {
    try {
      await access(candidate);
      return true;
    } catch { /* try the next layout */ }
  }
  return false;
}

/**
 * Whether a check can run, and with what. Cached briefly because the UI probes
 * it on mount. Deliberately checks the pieces in order and stops early: elan's
 * `lean`/`lake` shims would *install* a missing toolchain if invoked, which is
 * not something a status probe should ever trigger.
 */
export async function leanStatus({ force = false } = {}) {
  const now = Date.now();
  if (!force && statusCache.value && now - statusCache.at < STATUS_TTL_MS) return statusCache.value;

  const dir = projectDir();
  const value = { available: false, projectDir: dir, mathlib: false };

  const elan = await run(exe('elan'), ['--version'], { timeoutMs: 10000 });
  if (elan.exitCode !== 0) {
    value.reason = 'elan is not installed; see lean/README.md';
    statusCache = { at: now, value };
    return value;
  }
  value.elan = elan.stdout.trim();

  if (!existsSync(path.join(dir, 'lakefile.toml')) && !existsSync(path.join(dir, 'lakefile.lean'))) {
    value.reason = `no lake project at ${dir}; run npm run lean:setup`;
    statusCache = { at: now, value };
    return value;
  }
  value.toolchain = await readToolchain(dir);

  value.mathlib = await mathlibBuilt(dir);
  if (!value.mathlib) {
    value.reason = 'Mathlib is not built yet; run lake exe cache get';
    statusCache = { at: now, value };
    return value;
  }

  const lake = await run(exe('lake'), ['--version'], { cwd: dir, timeoutMs: 60000 });
  if (lake.exitCode !== 0) {
    value.reason = lake.stderr.trim() || 'lake is not runnable';
    statusCache = { at: now, value };
    return value;
  }
  value.lake = lake.stdout.trim();
  value.lean = value.toolchain;
  value.available = true;

  statusCache = { at: now, value };
  return value;
}

// ── Guarding what we are asked to check ────────────────────────────────────
const BANNED = /\b(?:run_cmd|elab|macro|syntax|initialize|extern|unsafe|IO)\b/;

/**
 * The endpoint compiles whatever it is given, so it accepts only files that
 * look like ours: Mathlib imports, no `#eval`-style commands, no metaprogramming.
 * Returns a reason to refuse, or null.
 */
export function guardSource(source) {
  if (typeof source !== 'string' || source.trim() === '') return 'source is empty';
  if (source.length > 1_000_000) return 'source is too large';
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') && !/^import\s+Mathlib\./.test(trimmed)) {
      return `only Mathlib imports are allowed: ${trimmed}`;
    }
    if (trimmed.startsWith('#')) return `commands are not allowed: ${trimmed}`;
    if (BANNED.test(trimmed)) return `not allowed in a generated file: ${trimmed}`;
  }
  return null;
}

// ── Checking ───────────────────────────────────────────────────────────────
let queue = Promise.resolve();
let counter = 0;

/**
 * Type-checks one generated file. Calls are serialized: two `lake env`
 * invocations in the same project fight over the build directory.
 * Resolves with the raw outcome even when Lean fails; it only rejects if we
 * could not get as far as running it.
 */
export function checkLean(source, { timeoutMs = 120000 } = {}) {
  const task = queue.then(() => checkNow(source, timeoutMs));
  // Keep the chain alive regardless of this call's outcome.
  queue = task.then(() => undefined, () => undefined);
  return task;
}

async function checkNow(source, timeoutMs) {
  const reason = guardSource(source);
  if (reason) throw new Error(reason);

  const status = await leanStatus();
  if (!status.available) throw new Error(status.reason ?? 'Lean is not available');

  counter += 1;
  const dir = path.join(os.tmpdir(), 'cats-lean');
  const file = path.join(dir, `check-${process.pid}-${counter}.lean`);
  await mkdir(dir, { recursive: true });
  await writeFile(file, source, 'utf8');

  const started = Date.now();
  try {
    const raw = await run(exe('lake'), ['env', 'lean', file], { cwd: projectDir(), timeoutMs });
    return {
      stdout: raw.stdout,
      stderr: raw.stderr,
      exitCode: raw.exitCode,
      timedOut: raw.timedOut,
      command: `lake env lean ${path.basename(file)}`,
      durationMs: Date.now() - started,
    };
  } finally {
    await rm(file, { force: true });
  }
}
