'use strict';
/**
 * Gửi lỗi máy chủ lên Sentry qua envelope API (không cần @sentry/nextjs).
 * Bật khi có biến môi trường SENTRY_DSN; không có thì chỉ ghi console như trước.
 */

/** Tách DSN dạng https://<key>@<host>/<projectId> thành URL envelope và khoá. */
function parseDsn(dsn) {
  if (!dsn) return null;
  let u;
  try { u = new URL(dsn); } catch { return null; }
  const projectId = u.pathname.replace(/^\/+|\/+$/g, '');
  if (!u.username || !projectId) return null;
  return {
    key: u.username,
    url: `${u.protocol}//${u.host}/api/${projectId}/envelope/?sentry_key=${u.username}&sentry_version=7`,
  };
}

/** Chuyển stack của Error thành khung (frames) theo định dạng Sentry, khung gần nhất ở cuối. */
function frames(stack) {
  return String(stack || '')
    .split('\n')
    .slice(1)
    .map((l) => l.trim().match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/))
    .filter(Boolean)
    .map((m) => ({ function: m[1] || '?', filename: m[2], lineno: +m[3], colno: +m[4], in_app: !m[2].includes('node_modules') }))
    .reverse();
}

function buildEnvelope(err, { env, release, tags, extra, platform = 'node' } = {}) {
  const id = require('node:crypto').randomUUID().replace(/-/g, '');
  const e = err instanceof Error ? err : new Error(String(err));
  const event = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform,
    level: 'error',
    environment: env || 'production',
    release,
    tags,
    extra,
    exception: { values: [{ type: e.name, value: e.message, stacktrace: { frames: frames(e.stack) } }] },
  };
  return {
    id,
    body: [JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n'),
  };
}

function createMonitor({ dsn, env, release, fetchImpl = globalThis.fetch, consoleImpl = console } = {}) {
  const target = parseDsn(dsn);

  async function capture(err, ctx = {}) {
    if (!target) return null;
    const { id, body } = buildEnvelope(err, { env, release, ...ctx });
    try {
      await fetchImpl(target.url, { method: 'POST', headers: { 'content-type': 'application/x-sentry-envelope' }, body });
      return id;
    } catch (e) {
      consoleImpl.warn('[monitor] không gửi được lên Sentry:', e.message);
      return null;
    }
  }

  // Dùng thay cho `console` ở những chỗ ghi lỗi: vẫn in ra log của Vercel, đồng thời gửi lên Sentry.
  const logger = {
    info: (...a) => consoleImpl.info(...a),
    warn: (...a) => consoleImpl.warn(...a),
    error: (...a) => {
      consoleImpl.error(...a);
      const err = a.find((x) => x instanceof Error) || new Error(a.map(String).join(' '));
      const where = typeof a[0] === 'string' ? a[0] : undefined;
      return capture(err, { tags: where ? { where } : undefined });
    },
  };

  return { enabled: !!target, capture, logger };
}

const monitor = createMonitor({
  dsn: process.env.SENTRY_DSN,
  env: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
});

module.exports = { createMonitor, parseDsn, buildEnvelope, frames, monitor };
