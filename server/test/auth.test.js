'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

test('đăng ký, cookie httpOnly, /api/me, đăng xuất', async () => {
  const s = await start();
  try {
    const c = s.client();
    const r = await c.req('POST', '/api/auth/register', { email: 'Xiu@Example.com', name: 'Xíu', password: 'matkhau-dai-123' });
    assert.equal(r.status, 201);
    assert.equal(r.json.user.email, 'xiu@example.com'); // email được chuẩn hoá về chữ thường
    const sc = r.headers.get('set-cookie');
    assert.match(sc, /HttpOnly/);
    assert.match(sc, /SameSite=Lax/);
    assert.equal((await c.req('GET', '/api/me')).json.user.name, 'Xíu');
    assert.equal((await c.req('POST', '/api/auth/logout', {})).status, 200);
    assert.equal((await c.req('GET', '/api/me')).status, 401);
  } finally { await s.close(); }
});

test('mật khẩu không bao giờ lưu dạng chữ thường', async () => {
  const s = await start();
  try {
    await s.user();
    const row = s.app.db.prepare('SELECT pass FROM users').get();
    assert.match(row.pass, /^scrypt\$/);
    assert.ok(!row.pass.includes('matkhau-dai-123'));
  } finally { await s.close(); }
});

test('kiểm tra đầu vào khi đăng ký', async () => {
  const s = await start();
  try {
    const c = s.client();
    assert.equal((await c.req('POST', '/api/auth/register', { email: 'sai', name: 'A', password: 'matkhau-dai-123' })).status, 400);
    assert.equal((await c.req('POST', '/api/auth/register', { email: 'a@b.co', name: '', password: 'matkhau-dai-123' })).status, 400);
    assert.equal((await c.req('POST', '/api/auth/register', { email: 'a@b.co', name: 'A', password: 'ngan' })).status, 400);
    assert.equal((await c.req('POST', '/api/auth/register', { email: 'a@b.co', name: 'A'.repeat(21), password: 'matkhau-dai-123' })).status, 400);
  } finally { await s.close(); }
});

test('email trùng bị từ chối, đăng nhập sai bị 401 với thông báo chung', async () => {
  const s = await start();
  try {
    await s.user();
    const c = s.client();
    assert.equal((await c.req('POST', '/api/auth/register', { email: 'xiu@example.com', name: 'B', password: 'matkhau-dai-123' })).status, 409);
    const bad1 = await c.req('POST', '/api/auth/login', { email: 'xiu@example.com', password: 'sai-mat-khau-1' });
    const bad2 = await c.req('POST', '/api/auth/login', { email: 'khong-co@example.com', password: 'sai-mat-khau-1' });
    assert.equal(bad1.status, 401);
    assert.equal(bad2.status, 401);
    assert.equal(bad1.json.message, bad2.json.message); // không lộ email nào có tài khoản
    assert.equal((await c.req('POST', '/api/auth/login', { email: 'xiu@example.com', password: 'matkhau-dai-123' })).status, 200);
  } finally { await s.close(); }
});

test('thiếu header X-Remi thì bị chặn (chống CSRF)', async () => {
  const s = await start();
  try {
    const r = await fetch(s.base + '/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.co', password: 'x' }),
    });
    assert.equal(r.status, 403);
  } finally { await s.close(); }
});

test('đăng nhập sai quá nhiều lần bị giới hạn', async () => {
  const s = await start();
  try {
    await s.user();
    const c = s.client();
    let last;
    for (let i = 0; i < 11; i++) last = await c.req('POST', '/api/auth/login', { email: 'xiu@example.com', password: 'sai-mat-khau-' + i });
    assert.equal(last.status, 429);
  } finally { await s.close(); }
});

test('đóng đăng ký khi ALLOW_REGISTRATION=0', async () => {
  const s = await start({ allowRegistration: false });
  try {
    const r = await s.client().req('POST', '/api/auth/register', { email: 'a@b.co', name: 'A', password: 'matkhau-dai-123' });
    assert.equal(r.status, 403);
  } finally { await s.close(); }
});

test('xoá tài khoản cần mật khẩu và xoá sạch dữ liệu', async () => {
  const s = await start();
  try {
    const { c } = await s.user();
    await c.req('PUT', '/api/state', { baseVersion: 0, state: { tasks: [] } });
    assert.equal((await c.req('DELETE', '/api/me', { password: 'sai-mat-khau-1' })).status, 401);
    assert.equal((await c.req('DELETE', '/api/me', { password: 'matkhau-dai-123' })).status, 200);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM states').get().n, 0);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
  } finally { await s.close(); }
});
