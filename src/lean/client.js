/**
 * Talking to the dev-server Lean endpoint.
 *
 * A deployed build has no endpoint: the SPA rewrite answers with index.html,
 * so anything that is not JSON is read as "not available here". The verdict
 * itself is computed locally by `summarize`, so the one definition of "ok"
 * lives in the pure layer rather than on the wire.
 */
// Explicit extension: Vite will not resolve a .js specifier to a .ts file from JS.
import { summarize } from './diagnostics.ts';

const HEADERS = { 'Content-Type': 'application/json', 'X-CATS-Lean': '1' };
export const UNAVAILABLE_REASON = 'Lean runs only in local development';

async function readJson(response) {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** What the server can do, or why it cannot. Never throws. */
export async function probeLean() {
  try {
    const response = await fetch('/api/lean/status', { headers: HEADERS });
    const body = await readJson(response);
    if (!response.ok || !body) return { available: false, reason: UNAVAILABLE_REASON };
    return body;
  } catch {
    return { available: false, reason: UNAVAILABLE_REASON };
  }
}

/**
 * Type-checks one generated file. Resolves with a `LeanResult` for anything
 * Lean itself said (including failures and timeouts); throws only when the
 * request could not be made or was refused.
 */
export async function checkLean(source, { timeoutMs, signal } = {}) {
  const response = await fetch('/api/lean/check', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(timeoutMs === undefined ? { source } : { source, timeoutMs }),
    ...(signal ? { signal } : {}),
  });

  const body = await readJson(response);
  if (!body) throw new Error(UNAVAILABLE_REASON);
  if (!response.ok) throw new Error(body.error ?? `request failed (${response.status})`);
  return summarize(body.raw, body.durationMs);
}
