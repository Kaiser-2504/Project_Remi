'use strict';
const crypto = require('node:crypto');
const { HttpError, readBody, parseCookies, cookie } = require('./http');
const { tx } = require('./db');
const auth = require('./auth');
const ai = require('./ai');

const MAX_STATE_BYTES = 1_000_000;
const MAX_REMINDERS = 500;
const DUMMY_HASH = auth.hashPassword('khong-ai-biet-duoc'); // so sánh giả khi email không tồn tại, tránh lộ email nào có tài khoản

function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function validateReminders(list) {
  if (list === undefined) return null;
  if (!Array.isArray(list) || list.length > MAX_REMINDERS) throw new HttpError(400, 'bad_schedule', 'Lịch nhắc không hợp lệ.');
  return list.map((r) => {
    const ok =
      r && typeof r.key === 'string' && r.key.length > 0 && r.key.length <= 160 &&
      Number.isFinite(r.at) && r.at > 0 &&
      typeof r.title === 'string' && r.title.length > 0 && r.title.length <= 160 &&
      (r.body === undefined || (typeof r.body === 'string' && r.body.length <= 240)) &&
      (r.cond === undefined || r.cond === '' || r.cond === 'asleep');
    if (!ok) throw new HttpError(400, 'bad_schedule', 'Lịch nhắc không hợp lệ.');
    return { key: r.key, at: Math.round(r.at), title: r.title, body: r.body || '', cond: r.cond || '' };
  });
}

function createApi({ db, cfg, push, log = console, fetchImpl }) {
  const loginLimiter = new auth.RateLimiter(10, 15 * 60 * 1000);
  const registerLimiter = new auth.RateLimiter(10, 60 * 60 * 1000);
  const secure = cfg.secureCookies;

  const clientIp = (req) =>
    (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

  const sessionCookie = (token) => cookie(auth.COOKIE, token, { maxAge: Math.floor(auth.SESSION_MS / 1000), secure });
  const clearCookie = () => cookie(auth.COOKIE, '', { maxAge: 0, secure });

  function tokenOf(req) {
    const h = String(req.headers.authorization || '');
    if (h.startsWith('Bearer ')) return h.slice(7).trim();
    return parseCookies(req.headers.cookie)[auth.COOKIE] || '';
  }

  const routes = {};
  const on = (method, path, opts, fn) => {
    routes[`${method} ${path}`] = { public: !!opts.public, fn };
  };

  on('GET', '/api/health', { public: true }, async () => ({ json: { ok: true } }));

  /* ---------- tài khoản ---------- */
  on('POST', '/api/auth/register', { public: true }, async ({ req, body }) => {
    if (!cfg.allowRegistration) throw new HttpError(403, 'registration_closed', 'Hiện chưa mở đăng ký tài khoản mới.');
    const ip = clientIp(req);
    if (!registerLimiter.hit(ip)) throw new HttpError(429, 'rate_limited', 'Bạn thử quá nhiều lần, hãy quay lại sau.');
    const email = normEmail(body.email);
    const name = String(body.name || '').trim();
    const pw = String(body.password || '');
    if (!auth.EMAIL_RE.test(email) || email.length > 200) throw new HttpError(400, 'bad_email', 'Email chưa đúng.');
    if (!name || name.length > 20) throw new HttpError(400, 'bad_name', 'Tên gọi cần từ 1 đến 20 ký tự.');
    if (pw.length < 8 || pw.length > 200) throw new HttpError(400, 'bad_password', 'Mật khẩu cần từ 8 ký tự.');
    const id = crypto.randomUUID();
    try {
      db.prepare('INSERT INTO users(id, email, name, pass, created_at) VALUES(?,?,?,?,?)')
        .run(id, email, name, auth.hashPassword(pw), Date.now());
    } catch (e) {
      if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, 'email_taken', 'Email này đã có tài khoản.');
      throw e;
    }
    const token = auth.createSession(db, id, req.headers['user-agent']);
    return { status: 201, json: { user: { id, email, name } }, headers: { 'Set-Cookie': sessionCookie(token) } };
  });

  on('POST', '/api/auth/login', { public: true }, async ({ req, body }) => {
    const email = normEmail(body.email);
    const pw = String(body.password || '');
    const key = `${clientIp(req)}|${email}`;
    if (!loginLimiter.hit(key)) throw new HttpError(429, 'rate_limited', 'Bạn thử quá nhiều lần, hãy quay lại sau 15 phút.');
    const row = db.prepare('SELECT id, email, name, pass FROM users WHERE email = ?').get(email);
    const ok = auth.verifyPassword(pw, row ? row.pass : DUMMY_HASH) && !!row;
    if (!ok) throw new HttpError(401, 'bad_credentials', 'Email hoặc mật khẩu chưa đúng.');
    loginLimiter.clear(key);
    const token = auth.createSession(db, row.id, req.headers['user-agent']);
    return { json: { user: { id: row.id, email: row.email, name: row.name } }, headers: { 'Set-Cookie': sessionCookie(token) } };
  });

  on('POST', '/api/auth/logout', { public: true }, async ({ req }) => {
    auth.destroySession(db, tokenOf(req));
    return { json: { ok: true }, headers: { 'Set-Cookie': clearCookie() } };
  });

  on('GET', '/api/me', {}, async ({ user }) => ({ json: { user } }));

  on('DELETE', '/api/me', {}, async ({ user, body }) => {
    const row = db.prepare('SELECT pass FROM users WHERE id = ?').get(user.id);
    if (!row || !auth.verifyPassword(String(body.password || ''), row.pass)) {
      throw new HttpError(401, 'bad_credentials', 'Mật khẩu chưa đúng.');
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id); // xoá luôn dữ liệu, phiên, thiết bị (ON DELETE CASCADE)
    return { json: { ok: true }, headers: { 'Set-Cookie': clearCookie() } };
  });

  /* ---------- dữ liệu và lịch nhắc ---------- */
  on('GET', '/api/state', {}, async ({ user }) => {
    const row = db.prepare('SELECT version, data, updated_at FROM states WHERE user_id = ?').get(user.id);
    if (!row) return { json: { version: 0, state: null } };
    return { json: { version: row.version, state: JSON.parse(row.data), updatedAt: row.updated_at } };
  });

  on('PUT', '/api/state', {}, async ({ user, body }) => {
    const { baseVersion, state } = body;
    if (!Number.isInteger(baseVersion) || baseVersion < 0) throw new HttpError(400, 'bad_version', 'Thiếu số phiên bản.');
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new HttpError(400, 'bad_state', 'Dữ liệu không hợp lệ.');
    const json = JSON.stringify(state);
    if (json.length > MAX_STATE_BYTES) throw new HttpError(413, 'too_large', 'Dữ liệu quá lớn.');
    const schedule = validateReminders(body.schedule);

    const result = tx(db, () => {
      const row = db.prepare('SELECT version, data FROM states WHERE user_id = ?').get(user.id);
      const cur = row ? row.version : 0;
      if (baseVersion !== cur) return { conflict: true, version: cur, state: row ? JSON.parse(row.data) : null };
      const next = cur + 1;
      db.prepare(
        'INSERT INTO states(user_id, version, data, updated_at) VALUES(?,?,?,?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET version = excluded.version, data = excluded.data, updated_at = excluded.updated_at'
      ).run(user.id, next, json, Date.now());
      if (schedule) {
        const keep = new Set(schedule.map((r) => r.key));
        for (const r of db.prepare('SELECT key FROM reminders WHERE user_id = ? AND sent = 0').all(user.id)) {
          if (!keep.has(r.key)) db.prepare('DELETE FROM reminders WHERE user_id = ? AND key = ?').run(user.id, r.key);
        }
        const up = db.prepare(
          'INSERT INTO reminders(user_id, key, fire_at, title, body, cond, sent) VALUES(?,?,?,?,?,?,0) ' +
          'ON CONFLICT(user_id, key) DO UPDATE SET fire_at = excluded.fire_at, title = excluded.title, body = excluded.body, cond = excluded.cond WHERE sent = 0'
        );
        for (const r of schedule) up.run(user.id, r.key, r.at, r.title, r.body, r.cond);
      }
      return { conflict: false, version: next };
    });
    if (result.conflict) {
      throw new HttpError(409, 'conflict', 'Dữ liệu trên máy chủ mới hơn.', { version: result.version, state: result.state });
    }
    return { json: { version: result.version } };
  });

  /* ---------- thông báo đẩy ---------- */
  on('GET', '/api/push/key', {}, async () => ({ json: { enabled: push.enabled, publicKey: push.publicKey } }));

  on('POST', '/api/push/subscribe', {}, async ({ req, user, body }) => {
    const s = body.subscription || {};
    const k = s.keys || {};
    const ok =
      typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && s.endpoint.length <= 1000 &&
      typeof k.p256dh === 'string' && k.p256dh.length <= 200 && typeof k.auth === 'string' && k.auth.length <= 200;
    if (!ok) throw new HttpError(400, 'bad_subscription', 'Thông tin đăng ký thông báo không hợp lệ.');
    db.prepare(
      'INSERT INTO push_subs(id, user_id, endpoint, p256dh, auth, ua, created_at) VALUES(?,?,?,?,?,?,?) ' +
      'ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua'
    ).run(crypto.randomUUID(), user.id, s.endpoint, k.p256dh, k.auth, String(req.headers['user-agent'] || '').slice(0, 200), Date.now());
    return { status: 201, json: { ok: true } };
  });

  on('DELETE', '/api/push/subscribe', {}, async ({ user, body }) => {
    db.prepare('DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?').run(user.id, String(body.endpoint || ''));
    return { json: { ok: true } };
  });

  on('POST', '/api/push/test', {}, async ({ user }) => {
    if (!push.enabled) throw new HttpError(503, 'push_disabled', 'Máy chủ chưa bật thông báo đẩy.');
    const r = await push.sendToUser(user.id, { title: 'Remi 🔔', body: 'Thông báo thử đã đến nơi.', tag: 'test', url: '/' });
    return { json: r };
  });

  /* ---------- AI ---------- */
  on('POST', '/api/ai/parse', {}, async ({ user, body }) => {
    if (!cfg.anthropicKey) throw new HttpError(503, 'ai_disabled', 'Máy chủ chưa bật AI.');
    const input = ai.validateInput(body);
    const day = new Date().toISOString().slice(0, 10);
    const allowed = tx(db, () => {
      const row = db.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?').get(user.id, day);
      if (row && row.count >= cfg.aiDailyLimit) return false;
      db.prepare(
        'INSERT INTO ai_usage(user_id, day, count) VALUES(?,?,1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1'
      ).run(user.id, day);
      return true;
    });
    if (!allowed) throw new HttpError(429, 'ai_limit', 'Hôm nay bạn đã dùng hết lượt AI, app sẽ dùng chế độ cơ bản.');
    const data = await ai.parseIntent(cfg, input, fetchImpl);
    return { json: { data } };
  });

  // Nhóm D: liên kết lịch để thuê bao (.ics)
  require('./cal-link').registerCalLink({ db, on, HttpError });

  /** Xử lý một yêu cầu /api/*. Trả về { status, json, headers }. */
  return async function handle(req, url) {
    const route = routes[`${req.method} ${url.pathname}`];
    if (!route) throw new HttpError(404, 'not_found', 'Không tìm thấy.');
    // Chống CSRF: yêu cầu thay đổi dữ liệu phải có header tuỳ biến (trang khác không gắn được nếu không qua CORS).
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-remi'] !== '1') {
      throw new HttpError(403, 'csrf', 'Yêu cầu bị từ chối.');
    }
    const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readBody(req);
    let user = null;
    if (!route.public) {
      user = auth.userFromToken(db, tokenOf(req));
      if (!user) throw new HttpError(401, 'unauthorized', 'Bạn cần đăng nhập.');
    }
    return route.fn({ req, url, body, user });
  };
}

module.exports = { createApi };
