/**
 * Đăng nhập TỐI GIẢN chỉ để bản chạy độc lập và test hợp đồng dùng được. KHÔNG phải phần của Người 3:
 * khi nhóm ghép xong thì bỏ file này, `requireUser` thật (lib/auth.ts) thay vào, hợp đồng trong docs/API.md giữ nguyên.
 */
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { ApiError, errorResponse, jsonResponse, type Logger } from '../lib/errors.ts';
import { readJson } from '../lib/api-kit.ts';
import type { RequireUser } from '../lib/ports.ts';
import type { Sql } from '../lib/store-pg.ts';
import { deleteMeBody, loginBody, registerBody } from '../lib/schemas.ts';

const COOKIE = 'remi_session';
const SESSION_MS = 30 * 24 * 3600 * 1000;
const REGISTER_CODES = { email: 'bad_email', name: 'bad_name', password: 'bad_password' };

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((res, rej) => scrypt(pw, salt, 32, (e, key) => (e ? rej(e) : res(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`))));
}
function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [, saltHex, keyHex] = stored.split('$');
  if (!saltHex || !keyHex) return Promise.resolve(false);
  return new Promise((res) =>
    scrypt(pw, Buffer.from(saltHex, 'hex'), 32, (e, key) => res(!e && timingSafeEqual(key, Buffer.from(keyHex, 'hex')))),
  );
}
const DUMMY = hashPassword('khong-ai-biet-duoc'); // so sánh giả khi email không tồn tại, tránh lộ email nào có tài khoản

/** Giới hạn số lần trong một khoảng thời gian, giữ trong bộ nhớ (đủ cho một tiến trình). */
class Limiter {
  hits = new Map<string, number[]>();
  max: number;
  windowMs: number;
  constructor(max: number, windowMs: number) { this.max = max; this.windowMs = windowMs; }
  hit(key: string): boolean {
    const now = Date.now();
    const list = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) { this.hits.set(key, list); return false; }
    list.push(now); this.hits.set(key, list); return true;
  }
  clear(key: string) { this.hits.delete(key); }
}

function cookiesOf(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of (req.headers.get('cookie') || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch { /* bỏ cookie hỏng */ } }
  }
  return out;
}

export function createAuthLite({
  sql, secureCookies = false, allowRegistration = true, trustProxy = false, registerLimit = 10, log = console,
}: { sql: Sql; secureCookies?: boolean; allowRegistration?: boolean; trustProxy?: boolean; registerLimit?: number; log?: Logger }) {
  const registerLimiter = new Limiter(registerLimit, 3600_000);
  const loginLimiter = new Limiter(10, 15 * 60_000);
  const cookie = (v: string, maxAge: number) => `${COOKIE}=${encodeURIComponent(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;
  const ipOf = (req: Request) => (trustProxy && (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()) || req.headers.get('x-real-ip') || 'local';

  async function newSession(userId: string, ua: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await sql`INSERT INTO sessions(hash, user_id, created_at, expires_at, ua)
      VALUES(${hashToken(token)}, ${userId}, ${Date.now()}, ${Date.now() + SESSION_MS}, ${ua.slice(0, 200)})`;
    return token;
  }

  const requireUser: RequireUser = async (req) => {
    // Chống CSRF: yêu cầu ghi phải có header tuỳ biến (kiểm trước, giống server cũ).
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.get('x-remi') !== '1') {
      throw new ApiError(403, 'csrf', 'Yêu cầu bị từ chối.');
    }
    const token = cookiesOf(req)[COOKIE];
    const rows = token
      ? await sql`SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.hash = ${hashToken(token)} AND s.expires_at > ${Date.now()}`
      : [];
    if (!rows.length) throw new ApiError(401, 'unauthorized', 'Bạn cần đăng nhập.');
    return { id: rows[0].id, email: rows[0].email, name: rows[0].name };
  };

  const wrap = (fn: (req: Request) => Promise<Response>) => async (req: Request) => {
    try { return await fn(req); } catch (e) { return errorResponse(e, log); }
  };

  const handlers = {
    register: wrap(async (req) => {
      if (req.method !== 'GET' && req.headers.get('x-remi') !== '1') throw new ApiError(403, 'csrf', 'Yêu cầu bị từ chối.');
      if (!allowRegistration) throw new ApiError(403, 'registration_closed', 'Hiện chưa mở đăng ký tài khoản mới.');
      if (!registerLimiter.hit(ipOf(req))) throw new ApiError(429, 'rate_limited', 'Bạn thử quá nhiều lần, hãy quay lại sau.');
      const b = await readJson(req, registerBody, REGISTER_CODES);
      const id = randomUUID();
      try {
        await sql`INSERT INTO users(id, email, name, pass, created_at) VALUES(${id}, ${b.email}, ${b.name}, ${await hashPassword(b.password)}, ${Date.now()})`;
      } catch (e: any) {
        if (e?.code === '23505' || /duplicate key|unique/i.test(String(e?.message))) throw new ApiError(409, 'email_taken', 'Email này đã có tài khoản.');
        throw e;
      }
      const token = await newSession(id, req.headers.get('user-agent') || '');
      return jsonResponse(201, { user: { id, email: b.email, name: b.name } }, { 'set-cookie': cookie(token, SESSION_MS / 1000) });
    }),

    login: wrap(async (req) => {
      if (req.headers.get('x-remi') !== '1') throw new ApiError(403, 'csrf', 'Yêu cầu bị từ chối.');
      const b = await readJson(req, loginBody, {});
      const key = `${ipOf(req)}|${b.email}`;
      if (!loginLimiter.hit(key)) throw new ApiError(429, 'rate_limited', 'Bạn thử quá nhiều lần, hãy quay lại sau 15 phút.');
      const rows = await sql`SELECT id, email, name, pass FROM users WHERE email = ${b.email}`;
      const ok = await verifyPassword(b.password, rows.length ? rows[0].pass : await DUMMY);
      if (!rows.length || !ok) throw new ApiError(401, 'bad_credentials', 'Email hoặc mật khẩu chưa đúng.');
      loginLimiter.clear(key);
      await sql`DELETE FROM sessions WHERE expires_at < ${Date.now()}`; // dọn phiên hết hạn
      const token = await newSession(rows[0].id, req.headers.get('user-agent') || '');
      return jsonResponse(200, { user: { id: rows[0].id, email: rows[0].email, name: rows[0].name } }, { 'set-cookie': cookie(token, SESSION_MS / 1000) });
    }),

    logout: wrap(async (req) => {
      if (req.headers.get('x-remi') !== '1') throw new ApiError(403, 'csrf', 'Yêu cầu bị từ chối.');
      const token = cookiesOf(req)[COOKIE];
      if (token) await sql`DELETE FROM sessions WHERE hash = ${hashToken(token)}`;
      return jsonResponse(200, { ok: true }, { 'set-cookie': cookie('', 0) });
    }),

    me: wrap(async (req) => jsonResponse(200, { user: await requireUser(req) })),

    deleteMe: wrap(async (req) => {
      const user = await requireUser(req);
      const { password } = await readJson(req, deleteMeBody, {});
      const rows = await sql`SELECT pass FROM users WHERE id = ${user.id}`;
      if (!rows.length || !(await verifyPassword(password, rows[0].pass))) throw new ApiError(401, 'bad_credentials', 'Mật khẩu chưa đúng.');
      await sql`DELETE FROM users WHERE id = ${user.id}`; // xoá luôn dữ liệu, phiên, thiết bị (ON DELETE CASCADE)
      return jsonResponse(200, { ok: true }, { 'set-cookie': cookie('', 0) });
    }),
  };

  return { requireUser, handlers };
}
