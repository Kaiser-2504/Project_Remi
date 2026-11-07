'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

const rem = (key, at, extra = {}) => ({ key, at, title: 'Tiêu đề ' + key, body: 'Nội dung', ...extra });
const count = (s, sql, ...a) => s.app.db.prepare(sql).get(...a).n;

test('cần đăng nhập để đọc và ghi dữ liệu', async () => {
  const s = await start();
  try {
    const c = s.client();
    assert.equal((await c.req('GET', '/api/state')).status, 401);
    assert.equal((await c.req('PUT', '/api/state', { baseVersion: 0, state: {} })).status, 401);
  } finally { await s.close(); }
});

test('phiên bản tăng dần và xung đột trả về bản mới nhất', async () => {
  const s = await start();
  try {
    const { c } = await s.user();
    assert.deepEqual((await c.req('GET', '/api/state')).json, { version: 0, state: null });
    const a = await c.req('PUT', '/api/state', { baseVersion: 0, state: { tasks: [{ id: 'a' }] } });
    assert.equal(a.json.version, 1);
    const stale = await c.req('PUT', '/api/state', { baseVersion: 0, state: { tasks: [] } });
    assert.equal(stale.status, 409);
    assert.equal(stale.json.version, 1);
    assert.deepEqual(stale.json.state.tasks, [{ id: 'a' }]); // máy khách nhận được bản mới nhất để gộp
    const b = await c.req('PUT', '/api/state', { baseVersion: 1, state: { tasks: [{ id: 'a' }, { id: 'b' }] } });
    assert.equal(b.json.version, 2);
    assert.equal((await c.req('GET', '/api/state')).json.state.tasks.length, 2);
  } finally { await s.close(); }
});

test('dữ liệu mỗi người tách biệt', async () => {
  const s = await start();
  try {
    const a = await s.user('a@example.com', 'A');
    const b = await s.user('b@example.com', 'B');
    await a.c.req('PUT', '/api/state', { baseVersion: 0, state: { secret: 'của A' } });
    const r = await b.c.req('GET', '/api/state');
    assert.equal(r.json.state, null);
  } finally { await s.close(); }
});

test('lịch nhắc được thay thế, lời nhắc đã gửi được giữ lại', async () => {
  const s = await start();
  try {
    const { c, id } = await s.user();
    const T = Date.now() + 3600_000;
    await c.req('PUT', '/api/state', { baseVersion: 0, state: {}, schedule: [rem('a', T), rem('b', T + 1000)] });
    assert.equal(count(s, 'SELECT COUNT(*) AS n FROM reminders WHERE user_id = ?', id), 2);
    s.app.db.prepare("UPDATE reminders SET sent = 1 WHERE key = 'a'").run();
    await c.req('PUT', '/api/state', { baseVersion: 1, state: {}, schedule: [rem('c', T + 2000)] });
    const keys = s.app.db.prepare('SELECT key FROM reminders WHERE user_id = ? ORDER BY key').all(id).map((r) => r.key);
    assert.deepEqual(keys, ['a', 'c']); // b (chưa gửi, không còn trong lịch) bị xoá, a (đã gửi) được giữ để không gửi lại
    // gửi lại đúng key 'a' không làm nó sống lại
    await c.req('PUT', '/api/state', { baseVersion: 2, state: {}, schedule: [rem('a', T + 5000)] });
    assert.equal(count(s, "SELECT COUNT(*) AS n FROM reminders WHERE key = 'a' AND sent = 1"), 1);
  } finally { await s.close(); }
});

test('từ chối lịch nhắc và dữ liệu không hợp lệ', async () => {
  const s = await start();
  try {
    const { c } = await s.user();
    const bad = async (body, status) => assert.equal((await c.req('PUT', '/api/state', body)).status, status);
    await bad({ baseVersion: 0, state: {}, schedule: [{ key: 'x' }] }, 400);
    await bad({ baseVersion: 0, state: {}, schedule: [rem('x', Date.now(), { cond: 'bat-ky' })] }, 400);
    await bad({ baseVersion: 0, state: {}, schedule: 'khong-phai-mang' }, 400);
    await bad({ baseVersion: -1, state: {} }, 400);
    await bad({ baseVersion: 0, state: [] }, 400);
    await bad({ baseVersion: 0, state: { big: 'x'.repeat(1_100_000) } }, 413);
  } finally { await s.close(); }
});
