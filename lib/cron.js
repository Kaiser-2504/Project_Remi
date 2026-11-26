'use strict';
const crypto = require('node:crypto');
const { runDispatch } = require('./dispatch');

/** So sánh bí mật trong thời gian cố định. Thiếu bí mật cấu hình thì luôn từ chối. */
function authorized(headerValue, secret) {
  if (!secret) return false;
  const got = Buffer.from(String(headerValue || ''));
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

/**
 * Xử lý yêu cầu của pg_cron (POST) hoặc Vercel Cron (GET): xác thực rồi gửi các lời nhắc đến hạn.
 * `deps` = { cfg, repo, push } (tiêm vào để test).
 */
async function handleDispatch(req, deps) {
  const { cfg, repo, push, log = console } = deps;
  if (req.method !== 'POST' && req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
  if (!authorized(req.headers.get('authorization'), cfg.cronSecret)) return json(401, { error: 'unauthorized' });
  if (!push.enabled) return json(503, { error: 'push_disabled', message: 'Chưa cấu hình khóa VAPID.' });
  try {
    const out = await runDispatch({ repo, send: push.send, batch: cfg.dispatchBatch, budgetMs: cfg.dispatchBudgetMs });
    return json(200, out);
  } catch (e) {
    await log.error('[cron] dispatch lỗi:', e);
    return json(500, { error: 'dispatch_failed' });
  }
}

module.exports = { handleDispatch, authorized };
