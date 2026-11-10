'use strict';
/* Nhóm D: liên kết lịch để thuê bao.
 * - POST/GET/DELETE /api/cal/link : tạo (hoặc tạo lại), xem, tắt mã bí mật của người đang đăng nhập
 * - GET /api/cal.ics?t=<mã>       : công khai, ai có mã thì tải được lịch (chỉ đọc)
 * Mã dài 32 ký tự ngẫu nhiên (192 bit). Tạo lại mã thì link cũ chết ngay. Xoá tài khoản thì mã tự mất (ON DELETE CASCADE). */
const { randomBytes } = require('node:crypto');
const { buildFeed } = require('./cal-feed');

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

function registerCalLink({ db, on, HttpError }) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS cal_links(' +
    'user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, ' +
    'token TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)'
  );

  on('GET', '/api/cal/link', {}, async ({ user }) => {
    const row = db.prepare('SELECT token FROM cal_links WHERE user_id = ?').get(user.id);
    return { json: { token: row ? row.token : null } };
  });

  on('POST', '/api/cal/link', {}, async ({ user }) => {
    const token = randomBytes(24).toString('base64url');
    db.prepare(
      'INSERT INTO cal_links(user_id, token, created_at) VALUES(?,?,?) ' +
      'ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, created_at = excluded.created_at'
    ).run(user.id, token, Date.now());
    return { status: 201, json: { token } };
  });

  on('DELETE', '/api/cal/link', {}, async ({ user }) => {
    db.prepare('DELETE FROM cal_links WHERE user_id = ?').run(user.id);
    return { json: { ok: true } };
  });

  on('GET', '/api/cal.ics', { public: true }, async ({ url }) => {
    const t = String(url.searchParams.get('t') || '');
    const notFound = () => new HttpError(404, 'not_found', 'Không tìm thấy.');
    if (!TOKEN_RE.test(t)) throw notFound();
    const row = db.prepare(
      'SELECT s.data AS data FROM cal_links l JOIN states s ON s.user_id = l.user_id WHERE l.token = ?'
    ).get(t);
    if (!row) throw notFound();
    let state = null;
    try { state = JSON.parse(row.data); } catch (e) { state = null; }
    return {
      raw: buildFeed(state),
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="remi.ics"',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    };
  });
}

module.exports = { registerCalLink };
