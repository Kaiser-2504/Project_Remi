import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ApiError, errorResponse, jsonResponse, type Logger } from './errors.ts';
import { readJson } from './api-kit.ts';
import type { RequireUser } from './ports.ts';
import type { Sql } from './store-pg.ts';
import { deleteMeBody, loginBody, registerBody } from './schemas.ts';

export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'remi_session';
const PASSWORD_COST = 12;
const REGISTER_CODES = { email: 'bad_email', name: 'bad_name', password: 'bad_password' };
const BAD_CREDENTIALS = 'Email hoặc mật khẩu chưa đúng.';
const UNAUTHORIZED = 'Bạn cần đăng nhập.';
const DUMMY_PASSWORD_HASH = bcrypt.hash('remi-dummy-password-never-used', PASSWORD_COST);

type Environment = Record<string, string | undefined>;

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function cookieValue(req: Request): string {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0 || part.slice(0, index).trim() !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

export function requireCsrf(req: Request): void {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.get('x-remi') !== '1') {
    throw new ApiError(403, 'csrf', 'Yêu cầu bị từ chối.');
  }
}

export function getClientIp(req: Request, env: Environment = process.env): string {
  const trustedProxy = env.TRUST_PROXY === '1' || env.VERCEL === '1';
  if (!trustedProxy) return 'unknown';

  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function createSession(sql: Sql, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  await sql`INSERT INTO remi.sessions(token_hash, user_id, created_at, expires_at)
    VALUES(${hash(token)}, ${userId}, ${new Date(now)}, ${new Date(now + SESSION_MS)})`;
  return token;
}

export async function destroySession(sql: Sql, token: string): Promise<void> {
  if (token) await sql`DELETE FROM remi.sessions WHERE token_hash = ${hash(token)}`;
}

function limitFrom(env: Environment): number {
  if (env.REGISTER_LIMIT === undefined || env.REGISTER_LIMIT === '') return 10;
  const limit = Number(env.REGISTER_LIMIT);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('REGISTER_LIMIT must be a positive integer');
  return limit;
}

async function hitRateLimit(sql: Sql, key: string, limit: number, windowMs: number): Promise<boolean> {
  const rows = await sql`INSERT INTO remi.rate_limits(key, window_start, count)
    VALUES(${key}, statement_timestamp(), 1)
    ON CONFLICT (key) DO UPDATE SET
      window_start = CASE
        WHEN remi.rate_limits.window_start <= statement_timestamp() - (${windowMs}::double precision * INTERVAL '1 millisecond')
        THEN statement_timestamp() ELSE remi.rate_limits.window_start END,
      count = CASE
        WHEN remi.rate_limits.window_start <= statement_timestamp() - (${windowMs}::double precision * INTERVAL '1 millisecond')
        THEN 1 ELSE remi.rate_limits.count + 1 END
    RETURNING count`;
  return Number(rows[0]?.count) <= limit;
}

function limiterKey(scope: string, value: string): string {
  return `${scope}:${hash(value)}`;
}

function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function createAuthHandlers(
  sql: Sql,
  { env = process.env, log = console }: { env?: Environment; log?: Logger } = {},
) {
  const registerLimit = limitFrom(env);
  const secureCookies = env.COOKIE_SECURE === undefined
    ? env.NODE_ENV === 'production'
    : env.COOKIE_SECURE === '1';

  const requireUserForRequest: RequireUser = async (req) => {
    requireCsrf(req);
    const token = cookieValue(req);
    const rows = token
      ? await sql`SELECT u.id, u.email, u.name FROM remi.sessions s
          JOIN remi.users u ON u.id = s.user_id
          WHERE s.token_hash = ${hash(token)} AND s.expires_at > ${new Date()}`
      : [];
    if (!rows.length) throw new ApiError(401, 'unauthorized', UNAUTHORIZED);
    return { id: String(rows[0].id), email: rows[0].email, name: rows[0].name };
  };

  const wrap = (handler: (req: Request) => Promise<Response>) => async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error) {
      return errorResponse(error, log);
    }
  };

  const register = wrap(async (req) => {
    requireCsrf(req);
    if (env.ALLOW_REGISTRATION === '0') {
      throw new ApiError(403, 'registration_closed', 'Hiện chưa mở đăng ký tài khoản mới.');
    }
    const ip = getClientIp(req, env);
    if (!(await hitRateLimit(sql, limiterKey('auth:register', ip), registerLimit, 60 * 60 * 1000))) {
      throw new ApiError(429, 'rate_limited', 'Bạn thử quá nhiều lần, hãy quay lại sau.');
    }
    const body = await readJson(req, registerBody, REGISTER_CODES);
    const id = randomUUID();
    const passHash = await bcrypt.hash(body.password, PASSWORD_COST);
    try {
      await sql`INSERT INTO remi.users(id, email, name, pw_hash)
        VALUES(${id}, ${body.email}, ${body.name}, ${passHash})`;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new ApiError(409, 'email_taken', 'Email này đã có tài khoản.');
      }
      throw error;
    }
    const token = await createSession(sql, id);
    return jsonResponse(201, { user: { id, email: body.email, name: body.name } }, {
      'set-cookie': sessionCookie(token, SESSION_MS / 1000, secureCookies),
    });
  });

  const login = wrap(async (req) => {
    requireCsrf(req);
    const body = await readJson(req, loginBody);
    const ip = getClientIp(req, env);
    const rateKey = limiterKey('auth:login', `${ip}\0${body.email}`);
    if (!(await hitRateLimit(sql, rateKey, 10, 15 * 60 * 1000))) {
      throw new ApiError(429, 'rate_limited', 'Bạn thử quá nhiều lần, hãy quay lại sau 15 phút.');
    }
    const rows = await sql`SELECT id, email, name, pw_hash FROM remi.users WHERE lower(email) = ${body.email}`;
    const user = rows[0];
    const storedHash = user?.pw_hash || await DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(body.password, storedHash);
    if (!user || !passwordMatches) {
      throw new ApiError(401, 'bad_credentials', BAD_CREDENTIALS);
    }
    await sql`DELETE FROM remi.rate_limits WHERE key = ${rateKey}`;
    const token = await createSession(sql, String(user.id));
    return jsonResponse(200, {
      user: { id: String(user.id), email: user.email, name: user.name },
    }, { 'set-cookie': sessionCookie(token, SESSION_MS / 1000, secureCookies) });
  });

  const logout = wrap(async (req) => {
    requireCsrf(req);
    await destroySession(sql, cookieValue(req));
    return jsonResponse(200, { ok: true }, { 'set-cookie': sessionCookie('', 0, secureCookies) });
  });

  const me = wrap(async (req) => jsonResponse(200, { user: await requireUserForRequest(req) }));

  const deleteMe = wrap(async (req) => {
    const user = await requireUserForRequest(req);
    const { password } = await readJson(req, deleteMeBody);
    const rows = await sql`SELECT pw_hash FROM remi.users WHERE id = ${user.id}`;
    const storedHash = rows[0]?.pw_hash;
    const passwordMatches = storedHash ? await bcrypt.compare(password, storedHash) : false;
    if (!passwordMatches) throw new ApiError(401, 'bad_credentials', 'Mật khẩu chưa đúng.');
    await sql`DELETE FROM remi.users WHERE id = ${user.id}`;
    return jsonResponse(200, { ok: true }, { 'set-cookie': sessionCookie('', 0, secureCookies) });
  });

  return { requireUser: requireUserForRequest, register, login, logout, me, deleteMe };
}

let defaultHandlers: ReturnType<typeof createAuthHandlers> | undefined;

async function runtimeHandlers(): Promise<ReturnType<typeof createAuthHandlers>> {
  if (!defaultHandlers) {
    const { sql } = await import('./db.ts');
    defaultHandlers = createAuthHandlers(sql as Sql);
  }
  return defaultHandlers;
}

export const requireUser: RequireUser = async (req) => {
  requireCsrf(req);
  return (await runtimeHandlers()).requireUser(req);
};

async function routeHandler(name: 'register' | 'login' | 'logout' | 'me' | 'deleteMe', req: Request): Promise<Response> {
  try {
    requireCsrf(req);
    return await (await runtimeHandlers())[name](req);
  } catch (error) {
    return errorResponse(error);
  }
}

export const register = (req: Request) => routeHandler('register', req);
export const login = (req: Request) => routeHandler('login', req);
export const logout = (req: Request) => routeHandler('logout', req);
export const me = (req: Request) => routeHandler('me', req);
export const deleteMe = (req: Request) => routeHandler('deleteMe', req);
