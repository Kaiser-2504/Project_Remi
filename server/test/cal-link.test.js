const test = require('node:test');
const assert = require('node:assert');
const { DatabaseSync } = require('node:sqlite');
const { registerCalLink } = require('../cal-link.js');

class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT)');
  db.exec('CREATE TABLE states(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, version INTEGER, data TEXT, updated_at INTEGER)');
  const routes = {};
  const on = (m, p, o, fn) => { routes[m + ' ' + p] = { o, fn }; };
  registerCalLink({ db, on, HttpError });
  const call = (key, ctx) => routes[key].fn(ctx);
  const addUser = (id, tasks) => {
    db.prepare('INSERT INTO users(id, email) VALUES(?,?)').run(id, id + '@x.com');
    db.prepare('INSERT INTO states VALUES(?,?,?,?)').run(id, 1, JSON.stringify({ tasks }), Date.now());
  };
  const feed = (t) => call('GET /api/cal.ics', { url: new URL('http://x/api/cal.ics' + (t === undefined ? '' : '?t=' + encodeURIComponent(t))) });
  return { db, routes, call, addUser, feed };
}

test('chưa tạo link thì token là null; tạo xong xem lại thấy đúng mã', async () => {
  const s = setup(); s.addUser('u1', []);
  assert.strictEqual((await s.call('GET /api/cal/link', { user: { id: 'u1' } })).json.token, null);
  const r = await s.call('POST /api/cal/link', { user: { id: 'u1' } });
  assert.strictEqual(r.status, 201);
  assert.match(r.json.token, /^[A-Za-z0-9_-]{32}$/);
  assert.strictEqual((await s.call('GET /api/cal/link', { user: { id: 'u1' } })).json.token, r.json.token);
});

test('đường dẫn công khai trả đúng lịch của chủ mã, đúng kiểu text/calendar', async () => {
  const s = setup();
  s.addUser('u1', [{ id: 'a', title: 'Họp', emoji: '👥', when: '2026-11-10T21:00', durMin: 60, repeat: 'none' }]);
  const { json: { token } } = await s.call('POST /api/cal/link', { user: { id: 'u1' } });
  const r = await s.feed(token);
  assert.ok(r.raw.includes('SUMMARY:👥 Họp'));
  assert.ok(r.raw.includes('DTSTART:20261110T210000'));
  assert.match(r.headers['Content-Type'], /^text\/calendar/);
  assert.strictEqual(s.routes['GET /api/cal.ics'].o.public, true);
});

test('mỗi người chỉ thấy lịch của mình', async () => {
  const s = setup();
  s.addUser('u1', [{ id: 'a', title: 'Việc của An', when: '2026-11-10T09:00' }]);
  s.addUser('u2', [{ id: 'b', title: 'Việc của Bình', when: '2026-11-10T10:00' }]);
  const t1 = (await s.call('POST /api/cal/link', { user: { id: 'u1' } })).json.token;
  const t2 = (await s.call('POST /api/cal/link', { user: { id: 'u2' } })).json.token;
  const f1 = (await s.feed(t1)).raw, f2 = (await s.feed(t2)).raw;
  assert.ok(f1.includes('Việc của An') && !f1.includes('Việc của Bình'));
  assert.ok(f2.includes('Việc của Bình') && !f2.includes('Việc của An'));
});

test('mã sai, thiếu, hoặc định dạng lạ đều trả 404', async () => {
  const s = setup(); s.addUser('u1', []);
  await s.call('POST /api/cal/link', { user: { id: 'u1' } });
  for (const bad of [undefined, '', 'abc', 'x'.repeat(32), "' OR 1=1 --", 'a'.repeat(200)]) {
    await assert.rejects(() => s.feed(bad), (e) => e.status === 404);
  }
});

test('tạo lại thì link cũ hết dùng, tắt thì không ai tải được nữa', async () => {
  const s = setup(); s.addUser('u1', []);
  const old = (await s.call('POST /api/cal/link', { user: { id: 'u1' } })).json.token;
  const nw = (await s.call('POST /api/cal/link', { user: { id: 'u1' } })).json.token;
  assert.notStrictEqual(old, nw);
  await assert.rejects(() => s.feed(old), (e) => e.status === 404);
  assert.ok((await s.feed(nw)).raw.startsWith('BEGIN:VCALENDAR'));
  await s.call('DELETE /api/cal/link', { user: { id: 'u1' } });
  await assert.rejects(() => s.feed(nw), (e) => e.status === 404);
});

test('xoá tài khoản thì mã cũng mất', async () => {
  const s = setup(); s.addUser('u1', []);
  const t = (await s.call('POST /api/cal/link', { user: { id: 'u1' } })).json.token;
  s.db.prepare('DELETE FROM users WHERE id = ?').run('u1');
  await assert.rejects(() => s.feed(t), (e) => e.status === 404);
});

test('các route quản lý mã cần đăng nhập, riêng đường dẫn tải lịch là công khai', () => {
  const s = setup();
  for (const k of ['GET /api/cal/link', 'POST /api/cal/link', 'DELETE /api/cal/link']) assert.ok(!s.routes[k].o.public);
});
