/** Điều contract test không thấy được từ ngoài: phiên hết hạn và mật khẩu không lưu dạng rõ. Cần PG_TEST_URL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthLite } from '../standalone/auth-lite.ts';
import { createPool } from './psql-sql.ts';

const cfg = process.env.PG_TEST_URL;
const kv = Object.fromEntries((cfg || '').split(/\s+/).filter(Boolean).map((p) => p.split('=')));
const t = cfg ? test : test.skip;

const post = (body: unknown, extra: Record<string, string> = {}) =>
  new Request('http://x/api', { method: 'POST', headers: { 'content-type': 'application/json', 'x-remi': '1', ...extra }, body: JSON.stringify(body) });

t('phiên hết hạn thì 401; mật khẩu lưu băm; token phiên lưu băm; đăng nhập quá nhiều lần thì 429', async () => {
  const pool = createPool({ host: kv.host, port: Number(kv.port), db: kv.dbname }, 2);
  const sql = pool.sql;
  const auth = createAuthLite({ sql, log: { error() {}, warn() {} } });
  const email = `ttl-${Date.now()}@example.com`;
  try {
    const reg = await auth.handlers.register(post({ email, name: 'Ttl', password: 'mat-khau-dai-123' }));
    assert.equal(reg.status, 201);
    const cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
    const me = () => auth.handlers.me(new Request('http://x/api/me', { headers: { cookie } }));
    assert.equal((await me()).status, 200);

    const row = (await sql`SELECT pass FROM users WHERE email = ${email}`)[0];
    assert.ok(!row.pass.includes('mat-khau-dai-123') && row.pass.startsWith('scrypt$'));
    const token = decodeURIComponent(cookie.split('=')[1]);
    assert.equal((await sql`SELECT hash FROM sessions WHERE hash = ${token}`).length, 0); // DB không giữ token gốc

    await sql`UPDATE sessions SET expires_at = 1 WHERE user_id = (SELECT id FROM users WHERE email = ${email})`;
    assert.equal((await me()).status, 401);

    let last = 0;
    for (let i = 0; i < 11; i++) last = (await auth.handlers.login(post({ email, password: 'sai-mat-khau-123' }))).status;
    assert.equal(last, 429);

    const closed = createAuthLite({ sql, allowRegistration: false, log: { error() {}, warn() {} } });
    assert.equal((await closed.handlers.register(post({ email: 'dong@example.com', name: 'D', password: 'mat-khau-dai-123' }))).status, 403);
    const limited = createAuthLite({ sql, registerLimit: 1, log: { error() {}, warn() {} } });
    assert.equal((await limited.handlers.register(post({ email: `l1-${Date.now()}@example.com`, name: 'L', password: 'mat-khau-dai-123' }))).status, 201);
    assert.equal((await limited.handlers.register(post({ email: `l2-${Date.now()}@example.com`, name: 'L', password: 'mat-khau-dai-123' }))).status, 429);
  } finally {
    await sql`DELETE FROM users WHERE email LIKE 'ttl-%@example.com' OR email LIKE 'l_-%@example.com'`;
    pool.close();
  }
});
