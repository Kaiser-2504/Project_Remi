'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runDispatch } = require('../dispatch');
const { handleDispatch, authorized } = require('../cron');
const { loadConfig } = require('../config');
const { createFakeRepo } = require('./fake-repo');

const quiet = { warn() {}, error() {}, log() {} };
const T0 = Date.parse('2026-11-23T03:00:00Z');
const MIN = 60_000;

async function seed(repo, userId, list) {
  await repo.saveState(userId, (await repo.getState(userId))?.version ?? 0, (await repo.getState(userId))?.data ?? {}, list);
}
async function userWithDevice(repo, n = 1, email = 'a@b.co') {
  const u = await repo.createUser({ email, name: 'A', passHash: 'x' });
  for (let i = 0; i < n; i++) await repo.upsertPushSub({ userId: u.id, endpoint: `https://p/${u.id.slice(-2)}-${i}`, p256dh: 'p', auth: 'a' });
  return u;
}
const rem = (key, at, extra = {}) => ({ key, at, title: 'T ' + key, body: 'B ' + key, cond: '', ...extra });

test('chỉ gửi lời nhắc đến hạn: không gửi cái chưa đến, cái đã gửi, cái trễ hơn 30 phút', async () => {
  const clock = { t: T0 }; const repo = createFakeRepo(clock);
  const u = await userWithDevice(repo);
  await seed(repo, u.id, [rem('due', T0 - MIN), rem('future', T0 + 10 * MIN), rem('old', T0 - 31 * MIN), rem('edge', T0 - 29 * MIN)]);
  const sent = [];
  const out = await runDispatch({ repo, send: async (s, p) => { sent.push(p); }, log: quiet });
  assert.deepEqual(sent.map((p) => p.tag).sort(), ['due', 'edge']);
  assert.equal(out.claimed, 2);
  assert.equal(out.sent, 2);
  const again = await runDispatch({ repo, send: async (s, p) => { sent.push(p); }, log: quiet });
  assert.equal(again.claimed, 0, 'đã nhận thì không nhận lại');
  assert.equal(sent.length, 2);
});

test('nội dung thông báo khớp web/sw.js: title, body, tag, url', async () => {
  const repo = createFakeRepo({ t: T0 });
  const u = await userWithDevice(repo);
  await seed(repo, u.id, [rem('k1', T0 - 1)]);
  let got;
  await runDispatch({ repo, send: async (sub, p) => { got = { sub, p }; }, log: quiet });
  assert.deepEqual(got.p, { title: 'T k1', body: 'B k1', tag: 'k1', url: '/' });
  assert.deepEqual(Object.keys(got.sub).sort(), ['endpoint', 'keys']);
  assert.deepEqual(got.sub.keys, { p256dh: 'p', auth: 'a' });
});

test('hai lần chạy chồng nhau không gửi trùng một lời nhắc', async () => {
  const repo = createFakeRepo({ t: T0 });
  const u = await userWithDevice(repo);
  await seed(repo, u.id, Array.from({ length: 30 }, (_, i) => rem('r' + i, T0 - (i + 1) * 1000)));
  const sent = [];
  const send = async (s, p) => { await new Promise((r) => setTimeout(r, 1)); sent.push(p.tag); };
  await Promise.all([runDispatch({ repo, send, batch: 7, log: quiet }), runDispatch({ repo, send, batch: 7, log: quiet })]);
  assert.equal(sent.length, 30);
  assert.equal(new Set(sent).size, 30, 'không có lời nhắc nào gửi hai lần');
});

test('lời nhắc điều kiện "asleep" chỉ gửi khi người dùng đang ngủ', async () => {
  const repo = createFakeRepo({ t: T0 });
  const sleeper = await userWithDevice(repo, 1, 's@b.co');
  const waker = await userWithDevice(repo, 1, 'w@b.co');
  await repo.saveState(sleeper.id, 0, { sleep: { awake: false } }, [rem('wake', T0 - 1, { cond: 'asleep' }), rem('plain', T0 - 1)]);
  await repo.saveState(waker.id, 0, { sleep: { awake: true } }, [rem('wake', T0 - 1, { cond: 'asleep' }), rem('plain', T0 - 1)]);
  const sent = [];
  const out = await runDispatch({ repo, send: async (sub, p) => { sent.push(`${sub.endpoint}|${p.tag}`); }, log: quiet });
  assert.equal(out.skipped, 1);
  assert.equal(sent.filter((s) => s.endsWith('|wake')).length, 1, 'chỉ người đang ngủ nhận lời gọi dậy');
  assert.equal(sent.filter((s) => s.endsWith('|plain')).length, 2);
});

test('thiết bị trả 404/410 bị xoá; lỗi khác chỉ đếm và giữ thiết bị; một thiết bị hỏng không chặn thiết bị khác', async () => {
  const repo = createFakeRepo({ t: T0 });
  const u = await userWithDevice(repo, 3);
  const eps = repo._subs.map((s) => s.endpoint);
  await seed(repo, u.id, [rem('k', T0 - 1)]);
  const send = async (sub) => {
    if (sub.endpoint === eps[0]) throw Object.assign(new Error('gone'), { statusCode: 410 });
    if (sub.endpoint === eps[1]) throw Object.assign(new Error('boom'), { statusCode: 500 });
  };
  const out = await runDispatch({ repo, send, log: quiet });
  assert.equal(out.removedSubs, 1);
  assert.equal(out.failed, 1);
  assert.equal(out.pushes, 1);
  assert.equal(out.sent, 1, 'lời nhắc tính là đã gửi khi ít nhất một thiết bị nhận');
  assert.deepEqual(repo._subs.map((s) => s.endpoint).sort(), [eps[1], eps[2]].sort());
});

test('người dùng không có thiết bị: lời nhắc vẫn được đánh dấu đã nhận, không lỗi', async () => {
  const repo = createFakeRepo({ t: T0 });
  const u = await userWithDevice(repo, 0);
  await seed(repo, u.id, [rem('k', T0 - 1)]);
  const out = await runDispatch({ repo, send: async () => { throw new Error('không được gọi'); }, log: quiet });
  assert.equal(out.claimed, 1);
  assert.equal(out.sent, 0);
});

test('hết ngân sách thời gian thì dừng và báo more:true, lần sau làm tiếp', async () => {
  const clock = { t: T0 }; const repo = createFakeRepo(clock);
  const u = await userWithDevice(repo);
  await seed(repo, u.id, Array.from({ length: 10 }, (_, i) => rem('r' + i, T0 - (i + 1) * 1000)));
  const send = async () => { clock.t += 3000; }; // mỗi lần gửi "mất" 3 giây
  const now = () => clock.t;
  const first = await runDispatch({ repo, send, batch: 2, budgetMs: 5000, now, log: quiet });
  assert.equal(first.more, true);
  assert.ok(first.claimed < 10);
  clock.t = T0 + 1000;
  const second = await runDispatch({ repo, send: async () => {}, batch: 50, budgetMs: 5000, now: () => clock.t, log: quiet });
  assert.equal(first.claimed + second.claimed, 10, 'tổng số đã nhận đủ, không sót');
});

test('xác thực cron: thiếu/sai bí mật 401, thiếu cấu hình 401, phương thức lạ 405, chưa có VAPID 503, đúng thì 200', async () => {
  const repo = createFakeRepo({ t: T0 });
  const u = await userWithDevice(repo);
  await seed(repo, u.id, [rem('k', T0 - 1)]);
  const sent = [];
  const push = { enabled: true, send: async (s, p) => { sent.push(p); } };
  const cfg = loadConfig({}, { cronSecret: 'abc123' });
  const call = (method, auth, over = {}) => handleDispatch(
    new Request('https://remi.test/api/cron/dispatch', { method, headers: auth ? { authorization: auth } : {} }),
    { cfg: over.cfg || cfg, repo, push: over.push || push });
  assert.equal((await call('POST', null)).status, 401);
  assert.equal((await call('POST', 'Bearer sai')).status, 401);
  assert.equal((await call('POST', 'abc123')).status, 401, 'thiếu chữ Bearer');
  assert.equal((await call('POST', 'Bearer ', { cfg: loadConfig({}, { cronSecret: '' }) })).status, 401, 'biến CRON_SECRET trống thì từ chối tất cả');
  assert.equal((await call('POST', 'Bearer undefined', { cfg: loadConfig({}, { cronSecret: '' }) })).status, 401);
  assert.equal((await call('PUT', 'Bearer abc123')).status, 405);
  assert.equal((await call('POST', 'Bearer abc123', { push: { enabled: false } })).status, 503);
  assert.equal(sent.length, 0, 'các lần bị từ chối không gửi gì');
  const ok = await call('POST', 'Bearer abc123');
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.claimed, 1);
  assert.equal(sent.length, 1);
  assert.equal((await call('GET', 'Bearer abc123')).status, 200, 'GET cũng được nhận (Vercel Cron dự phòng)');
});

test('authorized so sánh thời gian cố định và từ chối độ dài khác', () => {
  assert.equal(authorized('Bearer abc', 'abc'), true);
  assert.equal(authorized('Bearer abd', 'abc'), false);
  assert.equal(authorized('Bearer abcd', 'abc'), false);
  assert.equal(authorized('', 'abc'), false);
  assert.equal(authorized('Bearer abc', ''), false);
});

const { actionsFor, baseKey } = require('../actions');

test('nút hành động: chỉ lời nhắc đến giờ của việc, thói quen và bản nhắc lại', () => {
  const names = (k) => actionsFor(k).map((a) => a.action);
  assert.deepEqual(names('t:ab12:2026-11-23T04:00:00.000Z:due'), ['done', 'snooze']);
  assert.deepEqual(names('h:ab12:2026-11-23:07:00'), ['done', 'snooze']);
  assert.deepEqual(names('z:t:ab12:2026-11-23T04:00:00.000Z:due'), ['done', 'snooze']);
  assert.deepEqual(names('t:ab12:2026-11-23T04:00:00.000Z:lead'), [], 'nhắc trước thì không có nút');
  assert.deepEqual(names('w:ab12:x:wake'), []);
  assert.deepEqual(names('e:stock1'), []);
  assert.equal(baseKey('z:z:t:1:2:due'), 't:1:2:due');
});

test('payload có actions và key khi có nút; không có thì giữ nguyên 4 trường cũ', async () => {
  const repo = createFakeRepo({ t: T0 });
  const u = await userWithDevice(repo);
  await seed(repo, u.id, [rem('t:ab12:2026-11-23T03:00:00.000Z:due', T0 - 1), rem('e:kho', T0 - 1)]);
  const got = {};
  await runDispatch({ repo, send: async (s, p) => { got[p.tag] = p; }, log: quiet });
  const withBtn = got['t:ab12:2026-11-23T03:00:00.000Z:due'];
  assert.deepEqual(withBtn.actions.map((a) => a.action), ['done', 'snooze']);
  assert.equal(withBtn.key, withBtn.tag);
  assert.deepEqual(Object.keys(got.e_kho || got['e:kho']).sort(), ['body', 'tag', 'title', 'url']);
});

test('bản nhắc lại được gửi khi tới giờ, đúng nội dung gốc, và có nút', async () => {
  const clock = { t: T0 }; const repo = createFakeRepo(clock);
  const u = await userWithDevice(repo);
  const key = 't:ab12:2026-11-23T03:00:00.000Z:due';
  await seed(repo, u.id, [rem(key, T0 - 1)]);
  const sent = [];
  await runDispatch({ repo, send: async (s, p) => { sent.push(p); }, log: quiet });
  await repo.snoozeReminder(u.id, key, 10);
  await runDispatch({ repo, send: async (s, p) => { sent.push(p); }, log: quiet });
  assert.equal(sent.length, 1, 'chưa tới 10 phút thì chưa gửi lại');
  clock.t = T0 + 10 * 60_000 + 1;
  await runDispatch({ repo, send: async (s, p) => { sent.push(p); }, log: quiet });
  assert.equal(sent.length, 2);
  assert.equal(sent[1].tag, 'z:' + key);
  assert.equal(sent[1].title, sent[0].title);
  assert.equal(sent[1].key, 'z:' + key);
});
