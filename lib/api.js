'use strict';
/**
 * API của Remi cho Next.js (Route Handler dạng bắt-mọi-đường-dẫn app/api/[...path]/route.ts).
 * Cùng hợp đồng với máy chủ Node cũ (server/routes.js): cùng đường dẫn, cùng mã lỗi, cùng thông điệp,
 * nên giao diện web/js/*.js dùng nguyên không cần sửa.
 *
 * Tách khỏi Next và khỏi Postgres: nhận `repo` (lớp truy cập dữ liệu) và trả về một hàm
 * (Request) => Promise<Response>, nên test được bằng repo giả trong bộ nhớ.
 */
const crypto = require('node:crypto');
const { HttpError } = require('./errors');
const auth = require('./auth');
const ai = require('./ai');

const MAX_BODY_CHARS = 2 * 1024 * 1024;
const MAX_STATE_BYTES = 1_000_000;
const MAX_REMINDERS = 500;
// So sánh giả khi email không tồn tại, tránh lộ email nào có tài khoản (lười tạo để không tốn lúc nạp module).
let dummyHash = null;
const getDummyHash = () => (dummyHash = dummyHash || auth.hashPassword('khong-ai-biet-duoc'));

const normEmail = (v) => String(v || '').trim().toLowerCase();

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

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) {
      try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch { /* bỏ qua cookie hỏng */ }
    }
  });
  return out;
}

function cookie(name, value, { maxAge, secure } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  if (secure) c += '; Secure';
  return c;
}

function jsonResponse(status, obj, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

async function readBody(req) {
  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) throw new HttpError(413, 'too_large', 'Dữ liệu gửi lên quá lớn.');
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new HttpError(400, 'bad_json', 'Dữ liệu không hợp lệ.');
  }
}

function createApi({ repo, cfg, push, fetchImpl, log = console }) {
  const secure = cfg.secureCookies;

  const clientIp = (req) => {
    if (cfg.trustProxy) {
      const fwd = String(req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
      if (fwd) return fwd;
      const real = req.headers.get('x-real-ip');
      if (real) return real.trim();
    }
    return '?';
  };
  const sessionCookie = (token) => cookie(auth.COOKIE, token, { maxAge: Math.floor(auth.SESSION_MS / 1000), secure });
  const clearCookie = () => cookie(auth.COOKIE, '', { maxAge: 0, secure });

  function tokenOf(req) {
    const h = String(req.headers.get('authorization') || '');
    if (h.startsWith('Bearer ')) return h.slice(7).trim();
    return parseCookies(req.headers.get('cookie'))[auth.COOKIE] || '';
  }

  async function userFromToken(token) {
    if (!token) return null;
    return repo.getSessionUser(auth.sha(token)); // null nếu không có hoặc hết hạn
  }

  async function startSession(userId, req) {
    const token = auth.newToken();
    await repo.createSession(userId, auth.sha(token), Date.now() + auth.SESSION_MS, String(req.headers.get('user-agent') || '').slice(0, 200));
    return token;
  }

  const routes = {};
  const on = (method, path, opts, fn) => { routes[`${method} ${path}`] = { public: !!opts.public, fn }; };

  on('GET', '/api/health', { public: true }, async ({ url }) => {
    const out = { ok: true, ai: !!cfg.anthropicKey, push: !!push.enabled };
    if (url.searchParams.get('db') === '1') {
      try { out.db = await repo.ping(); } catch { out.db = false; out.ok = false; }
    }
    return { status: out.ok ? 200 : 503, json: out };
  });

  /* ---------- tài khoản ---------- */
  on('POST', '/api/auth/register', { public: true }, async ({ req, body }) => {
    if (!cfg.allowRegistration) throw new HttpError(403, 'registration_closed', 'Hiện chưa mở đăng ký tài khoản mới.');
    const ip = clientIp(req);
    if (!(await repo.hitRateLimit(`register:${ip}`, 3600, 10)).ok) throw new HttpError(429, 'rate_limited', 'Bạn thử quá nhiều lần, hãy quay lại sau.');
    const email = normEmail(body.email);
    const name = String(body.name || '').trim();
    const pw = String(body.password || '');
    if (!auth.EMAIL_RE.test(email) || email.length > 200) throw new HttpError(400, 'bad_email', 'Email chưa đúng.');
    if (!name || name.length > 20) throw new HttpError(400, 'bad_name', 'Tên gọi cần từ 1 đến 20 ký tự.');
    if (pw.length < 8 || pw.length > 200) throw new HttpError(400, 'bad_password', 'Mật khẩu cần từ 8 ký tự.');
    let user;
    try {
      user = await repo.createUser({ email, name, passHash: auth.hashPassword(pw) });
    } catch (e) {
      if (e && e.code === 'email_taken') throw new HttpError(409, 'email_taken', 'Email này đã có tài khoản.');
      throw e;
    }
    const token = await startSession(user.id, req);
    return { status: 201, json: { user: { id: user.id, email: user.email, name: user.name } }, headers: { 'Set-Cookie': sessionCookie(token) } };
  });

  on('POST', '/api/auth/login', { public: true }, async ({ req, body }) => {
    const email = normEmail(body.email);
    const pw = String(body.password || '');
    const key = `login:${clientIp(req)}|${email}`;
    if (!(await repo.hitRateLimit(key, 15 * 60, 10)).ok) throw new HttpError(429, 'rate_limited', 'Bạn thử quá nhiều lần, hãy quay lại sau 15 phút.');
    const row = await repo.getUserByEmail(email);
    const ok = auth.verifyPassword(pw, row ? row.pass : getDummyHash()) && !!row;
    if (!ok) throw new HttpError(401, 'bad_credentials', 'Email hoặc mật khẩu chưa đúng.');
    await repo.clearRateLimit(key);
    const token = await startSession(row.id, req);
    return { json: { user: { id: row.id, email: row.email, name: row.name } }, headers: { 'Set-Cookie': sessionCookie(token) } };
  });

  on('POST', '/api/auth/logout', { public: true }, async ({ req }) => {
    const t = tokenOf(req);
    if (t) await repo.deleteSession(auth.sha(t));
    return { json: { ok: true }, headers: { 'Set-Cookie': clearCookie() } };
  });

  on('GET', '/api/me', {}, async ({ user }) => ({ json: { user } }));

  on('DELETE', '/api/me', {}, async ({ user, body }) => {
    const pass = await repo.getUserPass(user.id);
    if (!pass || !auth.verifyPassword(String(body.password || ''), pass)) {
      throw new HttpError(401, 'bad_credentials', 'Mật khẩu chưa đúng.');
    }
    await repo.deleteUser(user.id); // xoá luôn dữ liệu, phiên, thiết bị (ON DELETE CASCADE)
    return { json: { ok: true }, headers: { 'Set-Cookie': clearCookie() } };
  });

  /* ---------- dữ liệu và lịch nhắc ---------- */
  on('GET', '/api/state', {}, async ({ user }) => {
    const row = await repo.getState(user.id);
    if (!row) return { json: { version: 0, state: null } };
    return { json: { version: row.version, state: row.data, updatedAt: row.updatedAt } };
  });

  on('PUT', '/api/state', {}, async ({ user, body }) => {
    const { baseVersion, state } = body;
    if (!Number.isInteger(baseVersion) || baseVersion < 0) throw new HttpError(400, 'bad_version', 'Thiếu số phiên bản.');
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new HttpError(400, 'bad_state', 'Dữ liệu không hợp lệ.');
    if (JSON.stringify(state).length > MAX_STATE_BYTES) throw new HttpError(413, 'too_large', 'Dữ liệu quá lớn.');
    const schedule = validateReminders(body.schedule);
    const r = await repo.saveState(user.id, baseVersion, state, schedule);
    if (!r.ok) throw new HttpError(409, 'conflict', 'Dữ liệu trên máy chủ mới hơn.', { version: r.version, state: r.state });
    return { json: { version: r.version } };
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
    await repo.upsertPushSub({ userId: user.id, endpoint: s.endpoint, p256dh: k.p256dh, auth: k.auth, ua: String(req.headers.get('user-agent') || '').slice(0, 200) });
    return { status: 201, json: { ok: true } };
  });

  on('DELETE', '/api/push/subscribe', {}, async ({ user, body }) => {
    await repo.deletePushSubForUser(user.id, String(body.endpoint || ''));
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
    const u = await repo.bumpAiUsage(user.id, day, cfg.aiDailyLimit);
    if (!u.ok) throw new HttpError(429, 'ai_limit', 'Hôm nay bạn đã dùng hết lượt AI, app sẽ dùng chế độ cơ bản.');
    const data = await ai.parseIntent(cfg, input, fetchImpl);
    return { json: { data } };
  });

  /** Xử lý một yêu cầu. Luôn trả về Response (lỗi đã đổi thành JSON). */
  return async function handle(req) {
    try {
      const url = new URL(req.url);
      const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;
      const route = routes[`${req.method} ${path}`];
      if (!route) throw new HttpError(404, 'not_found', 'Không tìm thấy.');
      // Chống CSRF: yêu cầu thay đổi dữ liệu phải có header tuỳ biến (trang khác không gắn được nếu không qua CORS).
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.get('x-remi') !== '1') {
        throw new HttpError(403, 'csrf', 'Yêu cầu bị từ chối.');
      }
      const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readBody(req);
      let user = null;
      if (!route.public) {
        user = await userFromToken(tokenOf(req));
        if (!user) throw new HttpError(401, 'unauthorized', 'Bạn cần đăng nhập.');
      }
      const r = await route.fn({ req, url, body, user });
      return jsonResponse(r.status || 200, r.json, r.headers || {});
    } catch (e) {
      if (e instanceof HttpError) return jsonResponse(e.status, { error: e.code, message: e.message, ...e.extra });
      log.error('[api]', e);
      return jsonResponse(500, { error: 'server_error', message: 'Máy chủ gặp lỗi, thử lại sau.' });
    }
  };
}

module.exports = { createApi, validateReminders, parseCookies };
