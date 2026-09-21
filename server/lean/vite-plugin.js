/**
 * The dev-server endpoint for Lean checks.
 *
 * `apply: 'serve'` means this never participates in a build, so a deployed
 * bundle has no endpoint and the UI degrades to "local dev only". Because the
 * endpoint compiles code, it is fenced: localhost only, same-origin only, a
 * custom header no cross-site form can set, a body cap, and `guardSource`.
 */
import { checkLean, leanStatus, guardSource } from './runner.js';

const MAX_BODY = 1_000_000;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function hostname(value) {
  if (!value) return '';
  // Strip a port, keeping an IPv6 literal intact.
  const match = /^(\[[^\]]+\]|[^:]+)/.exec(value);
  return match ? match[1].toLowerCase() : '';
}

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(text);
}

function forbidden(req) {
  if (!LOCAL_HOSTS.has(hostname(req.headers.host))) return 'requests must come from localhost';
  const origin = req.headers.origin;
  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).hostname.toLowerCase();
    } catch {
      return 'bad Origin';
    }
    if (!LOCAL_HOSTS.has(originHost) && !LOCAL_HOSTS.has(`[${originHost}]`)) return 'cross-origin requests are refused';
  }
  if (req.headers['x-cats-lean'] !== '1') return 'missing X-CATS-Lean header';
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body is too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default function catsLeanPlugin() {
  return {
    name: 'cats-lean',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/lean/status', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const refusal = forbidden(req);
        if (refusal) return send(res, 403, { error: refusal });
        try {
          send(res, 200, await leanStatus());
        } catch (e) {
          send(res, 200, { available: false, reason: String(e && e.message ? e.message : e) });
        }
      });

      server.middlewares.use('/api/lean/check', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        const refusal = forbidden(req);
        if (refusal) return send(res, 403, { error: refusal });

        let payload;
        try {
          payload = JSON.parse(await readBody(req));
        } catch (e) {
          return send(res, 400, { error: String(e && e.message ? e.message : e) });
        }

        const source = payload?.source;
        const reason = guardSource(source);
        if (reason) return send(res, 400, { error: reason });

        const status = await leanStatus();
        if (!status.available) return send(res, 503, { error: 'lean unavailable', status });

        try {
          const raw = await checkLean(source, { timeoutMs: payload.timeoutMs });
          const { durationMs, ...rest } = raw;
          send(res, 200, { raw: rest, durationMs });
        } catch (e) {
          send(res, 400, { error: String(e && e.message ? e.message : e) });
        }
      });
    },
  };
}
