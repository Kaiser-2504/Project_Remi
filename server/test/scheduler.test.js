'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

const sub = { subscription: { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'p256', auth: 'authkey' } } };

async function setup(s, state = {}, schedule = []) {
  const { c, id } = await s.user();
  assert.equal((await c.req('POST', '/api/push/subscribe', sub)).status, 201);
  const r = await c.req('PUT', '/api/state', { baseVersion: 0, state, schedule });
  assert.equal(r.status, 200);
  return { c, id };
}

test('gửi đúng giờ, đúng một lần', async () => {
  const s = await start();
  try {
    const T = s.clock.t;
    await setup(s, {}, [{ key: 'due', at: T + 1000, title: '🛒 Xíu ơi, đến giờ đi chợ rồi nè!', body: 'Lúc 19:00' }]);
    s.clock.t = T + 500;
    assert.equal((await s.app.scheduler.tick()).due, 0); // chưa đến giờ
    assert.equal(s.sent.length, 0);
    s.clock.t = T + 2000;
    const r = await s.app.scheduler.tick();
    assert.equal(r.sent, 1);
    assert.equal(s.sent.length, 1);
    assert.equal(s.sent[0].payload.title, '🛒 Xíu ơi, đến giờ đi chợ rồi nè!');
    assert.equal(s.sent[0].sub.endpoint, 'https://push.example.com/abc');
    await s.app.scheduler.tick();
    assert.equal(s.sent.length, 1); // không gửi trùng
  } finally { await s.close(); }
});

test('lời nhắc quá cũ (máy chủ ngủ lâu) bị bỏ qua, không dội thông báo', async () => {
  const s = await start();
  try {
    const T = s.clock.t;
    await setup(s, {}, [{ key: 'old', at: T + 1000, title: 'Cũ', body: '' }]);
    s.clock.t = T + 1000 + 40 * 60_000;
    const r = await s.app.scheduler.tick();
    assert.equal(r.skipped, 1);
    assert.equal(s.sent.length, 0);
  } finally { await s.close(); }
});

test('cuộc gọi dậy chỉ gửi khi người dùng đang ở trạng thái ngủ', async () => {
  const s = await start();
  try {
    const T = s.clock.t;
    const wake = (key) => ({ key, at: T + 1000, title: '⏰ Xíu ơi, dậy thôi!', body: '', cond: 'asleep' });
    const { c } = await setup(s, { sleep: { awake: true } }, [wake('w1')]);
    s.clock.t = T + 2000;
    await s.app.scheduler.tick();
    assert.equal(s.sent.length, 0); // đã thức dậy rồi, không gọi nữa
    await c.req('PUT', '/api/state', { baseVersion: 1, state: { sleep: { awake: false } }, schedule: [wake('w2')] });
    await s.app.scheduler.tick();
    assert.equal(s.sent.length, 1);
    assert.equal(s.sent[0].payload.tag, 'w2');
  } finally { await s.close(); }
});

test('thiết bị đã gỡ đăng ký (410) bị xoá khỏi danh sách', async () => {
  const s = await start({}, { pushSender: async () => { const e = new Error('gone'); e.statusCode = 410; throw e; } });
  try {
    const T = s.clock.t;
    await setup(s, {}, [{ key: 'k', at: T + 1000, title: 'T', body: '' }]);
    s.clock.t = T + 2000;
    await s.app.scheduler.tick();
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM push_subs').get().n, 0);
  } finally { await s.close(); }
});

test('khóa VAPID được sinh một lần và giữ nguyên', async () => {
  const s = await start();
  try {
    const { c } = await s.user();
    const a = (await c.req('GET', '/api/push/key')).json;
    const b = (await c.req('GET', '/api/push/key')).json;
    assert.equal(a.publicKey, b.publicKey);
    const raw = Buffer.from(a.publicKey, 'base64url');
    assert.equal(raw.length, 65);
    assert.equal(raw[0], 4); // điểm P-256 dạng không nén
  } finally { await s.close(); }
});

test('đăng ký thông báo kiểm tra đầu vào', async () => {
  const s = await start();
  try {
    const { c } = await s.user();
    const bad = await c.req('POST', '/api/push/subscribe', { subscription: { endpoint: 'http://khong-https', keys: { p256dh: 'a', auth: 'b' } } });
    assert.equal(bad.status, 400);
  } finally { await s.close(); }
});
