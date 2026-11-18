import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthHandlers, getClientIp, SESSION_COOKIE, SESSION_MS } from '../lib/auth.ts';
import type { Sql } from '../lib/store-pg.ts';

type UserRow = { id: string; email: string; name: string; pw_hash: string };
type SessionRow = { userId: string; expiresAt: number };

function memorySql() {
  const users = new Map<string, UserRow>();
  const sessions = new Map<string, SessionRow>();
  const limits = new Map<string, { startedAt: number; count: number }>();
  const sql = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query.startsWith('INSERT INTO remi.rate_limits')) {
      const [key, windowMs] = values as [string, number];
      const now = Date.now();
      const current = limits.get(key);
      if (!current || now - current.startedAt >= windowMs) limits.set(key, { startedAt: now, count: 1 });
      else current.count++;
      return [{ count: limits.get(key)!.count }];
    }
    if (query.startsWith('INSERT INTO remi.users')) {
      const [id, email, name, pw_hash] = values as [string, string, string, string];
      if (users.has(email)) throw Object.assign(new Error('duplicate key'), { code: '23505' });
      users.set(email, { id, email, name, pw_hash });
      return [];
    }
    if (query.startsWith('SELECT id, email, name, pw_hash FROM remi.users')) {
      const email = values[0] as string;
      const user = users.get(email);
      return user ? [user] : [];
    }
    if (query.startsWith('INSERT INTO remi.sessions')) {
      const [tokenHash, userId, , expiresAt] = values as [string, string, Date, Date];
      sessions.set(tokenHash, { userId, expiresAt: expiresAt.getTime() });
      return [];
    }
    if (query.startsWith('SELECT u.id, u.email, u.name FROM remi.sessions')) {
      const [tokenHash, now] = values as [string, Date];
      const session = sessions.get(tokenHash);
      if (!session || session.expiresAt <= now.getTime()) return [];
      const user = [...users.values()].find((row) => row.id === session.userId);
      return user ? [{ id: user.id, email: user.email, name: user.name }] : [];
    }
    if (query.startsWith('DELETE FROM remi.rate_limits')) {
      limits.delete(values[0] as string);
      return [];
    }
    if (query.startsWith('DELETE FROM remi.sessions')) {
      sessions.delete(values[0] as string);
      return [];
    }
    if (query.startsWith('SELECT pw_hash FROM remi.users')) {
      const user = [...users.values()].find((row) => row.id === values[0]);
      return user ? [{ pw_hash: user.pw_hash }] : [];
    }
    if (query.startsWith('DELETE FROM remi.users')) {
      const user = [...users.values()].find((row) => row.id === values[0]);
      if (user) {
        users.delete(user.email);
        for (const [key, session] of sessions) if (session.userId === user.id) sessions.delete(key);
      }
      return [];
    }
    throw new Error(`Unexpected SQL in auth test: ${query}`);
  }) as Sql;
  sql.begin = async (fn) => fn(sql);
  sql.json = (value) => value;
  return { sql, users, sessions, limits };
}

function request(method: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://remi.test/api', {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const bodyOf = (response: Response) => response.json() as Promise<Record<string, unknown>>;
const withCsrf = { 'x-remi': '1' };

test('auth writes reject requests without X-Remi', async () => {
  const { sql } = memorySql();
  const auth = createAuthHandlers(sql);
  const response = await auth.login(request('POST', { email: 'a@example.com', password: 'secret' }));
  assert.equal(response.status, 403);
  assert.equal((await bodyOf(response)).error, 'csrf');
});

test('registration limit is persisted and returns 429 rate_limited', async () => {
  const { sql } = memorySql();
  const auth = createAuthHandlers(sql, { env: { REGISTER_LIMIT: '1' }, log: { error() {} } });
  assert.equal((await auth.register(request('POST', {
    email: 'first@example.com', name: 'First', password: 'password-123',
  }, withCsrf))).status, 201);
  const limited = await auth.register(request('POST', {
    email: 'second@example.com', name: 'Second', password: 'password-123',
  }, withCsrf));
  assert.equal(limited.status, 429);
  assert.equal((await bodyOf(limited)).error, 'rate_limited');
});

test('ALLOW_REGISTRATION=0 returns 403 registration_closed', async () => {
  const { sql } = memorySql();
  const auth = createAuthHandlers(sql, { env: { ALLOW_REGISTRATION: '0' } });
  const response = await auth.register(request('POST', {
    email: 'closed@example.com', name: 'Closed', password: 'password-123',
  }, withCsrf));
  assert.equal(response.status, 403);
  assert.equal((await bodyOf(response)).error, 'registration_closed');
});

test('production cookies and logout use the expected attributes', async () => {
  const { sql } = memorySql();
  const auth = createAuthHandlers(sql, { env: { NODE_ENV: 'production' } });
  const registered = await auth.register(request('POST', {
    email: 'cookie@example.com', name: 'Cookie', password: 'password-123',
  }, withCsrf));
  const setCookie = registered.headers.get('set-cookie') || '';
  assert.match(setCookie, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, new RegExp(`Max-Age=${SESSION_MS / 1000}`));

  const tokenCookie = setCookie.split(';', 1)[0];
  const logout = await auth.logout(request('POST', {}, { ...withCsrf, cookie: tokenCookie }));
  assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/);
});

test('SQL-like email and password inputs never cause a 500 or authenticate', async () => {
  const { sql } = memorySql();
  const auth = createAuthHandlers(sql, { log: { error() {} } });
  await auth.register(request('POST', {
    email: 'safe@example.com', name: 'Safe', password: 'password-123',
  }, withCsrf));

  const unknown = await auth.login(request('POST', {
    email: "' OR 1=1 --", password: "' OR 1=1 --",
  }, withCsrf));
  assert.equal(unknown.status, 401);
  assert.equal((await bodyOf(unknown)).error, 'bad_credentials');
  const wrongPassword = await auth.login(request('POST', {
    email: 'safe@example.com', password: "' OR 1=1 --",
  }, withCsrf));
  assert.equal(wrongPassword.status, 401);
  assert.equal((await bodyOf(wrongPassword)).error, 'bad_credentials');
});

test('expired sessions return 401 and auth responses never expose passwords', async () => {
  const { sql, sessions } = memorySql();
  const auth = createAuthHandlers(sql);
  const password = 'password-123';
  const registered = await auth.register(request('POST', {
    email: 'private@example.com', name: 'Private', password,
  }, withCsrf));
  const registrationBody = await bodyOf(registered);
  assert.equal(JSON.stringify(registrationBody).includes(password), false);
  const token = decodeURIComponent((registered.headers.get('set-cookie') || '').split(';')[0].split('=').slice(1).join('='));
  const session = [...sessions.entries()][0];
  sessions.set(session[0], { ...session[1], expiresAt: 1 });

  const expired = await auth.me(request('GET', undefined, { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` }));
  assert.equal(expired.status, 401);
  assert.equal((await bodyOf(expired)).error, 'unauthorized');
});

test('client IP trusts forwarded headers only behind a trusted proxy', () => {
  const req = request('GET', undefined, { 'x-forwarded-for': '203.0.113.8, 10.0.0.1', 'x-real-ip': '203.0.113.9' });
  assert.equal(getClientIp(req, {}), 'unknown');
  assert.equal(getClientIp(req, { TRUST_PROXY: '1' }), '203.0.113.8');
  assert.equal(getClientIp(req, { VERCEL: '1' }), '203.0.113.8');
  assert.equal(getClientIp(request('GET', undefined, { 'x-real-ip': '203.0.113.9' }), { VERCEL: '1' }), '203.0.113.9');
});

test('auth responses do not return password fields on login or /api/me', async () => {
  const { sql } = memorySql();
  const auth = createAuthHandlers(sql);
  const password = 'password-123';
  const registered = await auth.register(request('POST', {
    email: 'response@example.com', name: 'Response', password,
  }, withCsrf));
  const cookie = (registered.headers.get('set-cookie') || '').split(';')[0];
  const loggedIn = await auth.login(request('POST', {
    email: 'response@example.com', password,
  }, withCsrf));
  const me = await auth.me(request('GET', undefined, { cookie }));
  for (const response of [loggedIn, me]) {
    const text = JSON.stringify(await bodyOf(response));
    assert.equal(text.includes(password), false);
    assert.equal(text.includes('pw_hash'), false);
    assert.equal(text.includes('password'), false);
  }
});
