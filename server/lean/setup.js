/**
 * Prepares the lake project CATS checks against.
 *
 * The repo holds the four small source files (`lakefile.toml`, `lean-toolchain`,
 * `Cats.lean`, and the manifest once it exists). The build itself is hundreds of
 * thousands of files, so when the repo lives inside a synced folder such as
 * OneDrive the project is materialized elsewhere: set `CATS_LEAN_DIR`.
 *
 * Usage: npm run lean:setup
 */
import { spawn } from 'node:child_process';
import { copyFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SOURCE = path.join(REPO, 'lean');
const TARGET = process.env.CATS_LEAN_DIR ? path.resolve(process.env.CATS_LEAN_DIR) : SOURCE;
const WINDOWS = process.platform === 'win32';
const FILES = ['lakefile.toml', 'lean-toolchain', 'Cats.lean'];

function elanBin() {
  return path.join(os.homedir(), '.elan', 'bin');
}

function exe(name) {
  const local = path.join(elanBin(), WINDOWS ? `${name}.exe` : name);
  return existsSync(local) ? local : name;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PATH: `${elanBin()}${path.delimiter}${process.env.PATH ?? ''}` };
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

async function main() {
  if (!existsSync(path.join(elanBin(), WINDOWS ? 'elan.exe' : 'elan'))) {
    process.stdout.write(
      'elan is not installed.\n' +
      '  Windows: Invoke-WebRequest https://elan.lean-lang.org/elan-init.ps1 -OutFile elan-init.ps1; ./elan-init.ps1 -y\n' +
      '  Unix:    curl https://elan.lean-lang.org/elan-init.sh -sSf | sh -s -- -y\n',
    );
    process.exitCode = 1;
    return;
  }

  if (TARGET !== SOURCE) {
    await mkdir(TARGET, { recursive: true });
    for (const file of FILES) await copyFile(path.join(SOURCE, file), path.join(TARGET, file));
    process.stdout.write(`project files copied to ${TARGET}\n`);
  }

  process.stdout.write('resolving dependencies (lake update)…\n');
  await run(exe('lake'), ['update'], TARGET);

  process.stdout.write('fetching the Mathlib build cache…\n');
  await run(exe('lake'), ['exe', 'cache', 'get'], TARGET);

  process.stdout.write('building…\n');
  await run(exe('lake'), ['build'], TARGET);

  // The manifest pins what was resolved; keep it in the repo so the build is
  // reproducible even when the project itself lives elsewhere.
  if (TARGET !== SOURCE) {
    try {
      await access(path.join(TARGET, 'lake-manifest.json'));
      await copyFile(path.join(TARGET, 'lake-manifest.json'), path.join(SOURCE, 'lake-manifest.json'));
    } catch { /* no manifest to bring back */ }
  }

  process.stdout.write(`\nready. CATS will check against ${TARGET}\n`);
  if (TARGET !== SOURCE) process.stdout.write(`keep CATS_LEAN_DIR=${TARGET} set for npm run dev\n`);
}

main().catch(e => {
  process.stderr.write(`${e.message}\n`);
  process.exitCode = 1;
});
