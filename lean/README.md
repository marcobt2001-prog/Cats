# The CATS Lean project

CATS generates Lean 4 / Mathlib files from a diagram and type-checks them with
`lake env lean`. This directory holds the small source files that define the
project; the build itself (Mathlib and its `.olean` files, several GB) lives
wherever `CATS_LEAN_DIR` points.

| File | Role |
|---|---|
| `lakefile.toml` | The project and its one dependency, Mathlib, pinned to a release. |
| `lean-toolchain` | The Lean version that release was built with. |
| `Cats.lean` | A smoke test: if this builds, the toolchain and Mathlib are in place. |
| `lake-manifest.json` | What `lake update` resolved. Committed so the build is reproducible. |

## Setup

```sh
# 1. elan, the Lean toolchain manager (~5 MB)
#    Windows (PowerShell):
Invoke-WebRequest https://elan.lean-lang.org/elan-init.ps1 -OutFile elan-init.ps1
./elan-init.ps1 -NoPrompt 1 -DefaultToolchain none
#    Unix:
curl https://elan.lean-lang.org/elan-init.sh -sSf | sh -s -- -y

# 2. Somewhere outside a synced folder, if the repo is in one (see below)
setx CATS_LEAN_DIR "%LOCALAPPDATA%\cats\lean"

# 3. The toolchain, Mathlib, and its build cache (~2 GB down, ~7 GB on disk)
npm run lean:setup
```

Then `npm run dev` and the Lean panel's chip turns green. Verify with
`npm test`: the integration suite in `src/lean/__tests__/integration.test.ts`
skips itself when Lean is missing and runs for real once it is present.

## Why the build lives outside the repo

This repo sits under OneDrive. A Mathlib build is hundreds of thousands of small
files; letting a sync client walk them is slow, burns CPU and bandwidth, and can
corrupt the cache mid-write. `CATS_LEAN_DIR` moves the project somewhere local
and `npm run lean:setup` copies these files there, bringing the manifest back.
If your checkout is not inside a synced folder you can leave the variable unset
and everything happens here.

## Windows notes

- **PATH.** elan adds `%USERPROFILE%\.elan\bin` for *new* shells, so a dev server
  started before the install will not see it. The runner resolves that directory
  itself, so it works either way; a terminal you want to use `lake` in needs
  reopening.
- **Long paths.** Mathlib's paths are deep. `git config --global core.longpaths true`
  avoids checkout failures.
- **Defender.** Real-time scanning dominates the cache unpack. Excluding the
  `.lake` directory makes a large difference.
- **Timeouts.** `lake` spawns `lean` as a child, so the runner kills the whole
  tree with `taskkill /T` rather than leaving an orphan compiling.

## Updating Mathlib

The dependency is pinned by `rev` in `lakefile.toml` and by the committed
manifest. To move to a newer release, change both `rev` and `lean-toolchain` to
the matching version (see the tag's own `lean-toolchain`), then re-run
`npm run lean:setup` and commit the new manifest. The generated code uses only
`CategoryTheory.Category.Basic`, so upgrades should be uneventful; the
integration tests are what tell you.
