import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateHandlers } from '../lib/handlers/state.ts';
import { createPushHandlers } from '../lib/handlers/push.ts';
import { createAiHandlers } from '../lib/handlers/ai.ts';
import { aiConfigFromEnv } from '../lib/ai.ts';
import { memoryStore, requireUser, req, silent } from './fakes.ts';

const body = async (r: Response) => r.json() as Promise<any>;

/* ---------- /api/state ---------- */
test('state: cần đăng nhập (401) và header X-Remi khi ghi (403)', async () => {
  const { store } = memoryStore();
  const h = createStateHandlers({ requireUser, store, log: silent });
  assert.equal((await h.GET(req('GET', undefined, ''))).status, 401);
  assert.equal((await h.PUT(req('PUT', { baseVersion: 0, state: {} }, 'u1', { 'x-remi': '0' }))).status, 403);
});

test('state: phiên bản tăng dần, bản cũ nhận 409 kèm dữ liệu mới nhất', async () => {
  const { store } = memoryStore();
  const h = createStateHandlers({ requireUser, store, log: silent });
  assert.deepEqual(await body(await h.GET(req('GET'))), { version: 0, state: null });
  assert.equal((await body(await h.PUT(req('PUT', { baseVersion: 0, state: { tasks: [1] } })))).version, 1);
  const stale = await h.PUT(req('PUT', { baseVersion: 0, state: { tasks: [] } }));
  assert.equal(stale.status, 409);
  const j = await body(stale);
  assert.equal(j.error, 'conflict'); assert.equal(j.version, 1); assert.deepEqual(j.state, { tasks: [1] });
  assert.equal((await body(await h.PUT(req('PUT', { baseVersion: 1, state: { tasks: [1, 2] } })))).version, 2);
});

test('state: dữ liệu sai nhận 400 với mã lỗi riêng cho từng trường', async () => {
  const { store } = memoryStore();
  const h = createStateHandlers({ requireUser, store, log: silent });
  const code = async (b: unknown) => { const r = await h.PUT(req('PUT', b)); return [r.status, (await body(r)).error]; };
  assert.deepEqual(await code({ state: {} }), [400, 'bad_version']);
  assert.deepEqual(await code({ baseVersion: -1, state: {} }), [400, 'bad_version']);
  assert.deepEqual(await code({ baseVersion: 0, state: [] }), [400, 'bad_state']);
  assert.deepEqual(await code({ baseVersion: 0, state: {}, schedule: [{ key: '', at: 1, title: 'x' }] }), [400, 'bad_schedule']);
  assert.deepEqual(await code('{không phải json'), [400, 'bad_json']);
  const big = await h.PUT(req('PUT', { baseVersion: 0, state: { x: 'a'.repeat(1_000_001) } }));
  assert.equal(big.status, 413);
});

test('state: lịch nhắc được chuẩn hoá và lưu cùng lúc; mỗi người một dữ liệu riêng', async () => {
  const m = memoryStore();
  const h = createStateHandlers({ requireUser, store: m.store, log: silent });
  await h.PUT(req('PUT', { baseVersion: 0, state: { a: 1 }, schedule: [{ key: 'k1', at: 1700000000000.4, title: 'Uống nước' }] }, 'u1'));
  assert.deepEqual(m.reminders.get('u1'), [{ key: 'k1', at: 1700000000000, title: 'Uống nước', body: '', cond: '' }]);
  await h.PUT(req('PUT', { baseVersion: 0, state: { b: 2 } }, 'u2'));
  assert.deepEqual((await body(await h.GET(req('GET', undefined, 'u1')))).state, { a: 1 });
  assert.deepEqual((await body(await h.GET(req('GET', undefined, 'u2')))).state, { b: 2 });
});

test('lỗi bất ngờ: 500 chung chung, có requestId, chi tiết chỉ nằm trong log', async () => {
  const m = memoryStore();
  m.store.getState = async () => { throw new Error('connection to db.supabase.co refused, password=hunter2'); };
  const logged: unknown[][] = [];
  const h = createStateHandlers({ requireUser, store: m.store, log: { error: (...a) => logged.push(a) } });
  const r = await h.GET(req('GET'));
  const j = await body(r);
  assert.equal(r.status, 500); assert.equal(j.error, 'server_error'); assert.ok(j.requestId);
  assert.ok(!JSON.stringify(j).includes('hunter2'));
  assert.ok(String(logged[0].join(' ')).includes('hunter2')); // nhưng log có đủ để tra
  assert.ok(String(logged[0][1]) === j.requestId);
});

/* ---------- /api/push ---------- */
test('push: đăng ký, đăng ký lại không nhân đôi, huỷ, kiểm tra đầu vào', async () => {
  const m = memoryStore();
  const h = createPushHandlers({ requireUser, store: m.store, vapidPublicKey: 'PUB', log: silent });
  const sub = { subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } } };
  assert.equal((await h.SUBSCRIBE(req('POST', sub))).status, 201);
  assert.equal((await h.SUBSCRIBE(req('POST', sub))).status, 201);
  assert.equal(m.subs.size, 1);
  const bad = await h.SUBSCRIBE(req('POST', { subscription: { ...sub.subscription, endpoint: 'http://x' } }));
  assert.equal(bad.status, 400); assert.equal((await body(bad)).error, 'bad_subscription');
  assert.equal((await h.SUBSCRIBE(req('POST', sub, ''))).status, 401);
  // người khác không huỷ được thiết bị của mình
  await h.UNSUBSCRIBE(req('DELETE', { endpoint: sub.subscription.endpoint }, 'u2'));
  assert.equal(m.subs.size, 1);
  assert.equal((await h.UNSUBSCRIBE(req('DELETE', { endpoint: sub.subscription.endpoint }))).status, 200);
  assert.equal(m.subs.size, 0);
  assert.deepEqual(await body(await h.KEY(req('GET'))), { enabled: true, publicKey: 'PUB' });
});

/* ---------- /api/ai/parse ---------- */
const aiBody = { text: 'đi chợ nấu cà ri lúc 7h', now: '2026-11-04T10:00', weekday: 'Thứ tư' };
const goodFetch = async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ content: [{ type: 'text', text: '{"intent":"task","title":"Đi chợ"}' }] }) }) as unknown as Response;
const cfgOf = (o = {}) => ({ ...aiConfigFromEnv({ ANTHROPIC_API_KEY: 'k' }), ...o });

test('ai: 401 khi chưa đăng nhập, 503 khi chưa có khóa, 400 khi đầu vào sai (không tốn lượt)', async () => {
  const m = memoryStore();
  const h = createAiHandlers({ requireUser, store: m.store, cfg: cfgOf(), fetchImpl: goodFetch, log: silent });
  assert.equal((await h.PARSE(req('POST', aiBody, ''))).status, 401);
  const bad = await h.PARSE(req('POST', { ...aiBody, text: '' }));
  assert.equal(bad.status, 400); assert.equal((await body(bad)).error, 'bad_text');
  assert.equal(m.usage.size, 0);
  const off = createAiHandlers({ requireUser, store: m.store, cfg: cfgOf({ apiKey: '' }), fetchImpl: goodFetch, log: silent });
  assert.equal((await off.PARSE(req('POST', aiBody))).status, 503);
  assert.equal(m.usage.size, 0);
});

test('ai: giới hạn lượt mỗi ngày -> 429 ai_limit, qua ngày mới thì dùng lại được', async () => {
  const m = memoryStore();
  let day = new Date('2026-11-04T10:00:00Z');
  const h = createAiHandlers({ requireUser, store: m.store, cfg: cfgOf({ dailyLimit: 2 }), fetchImpl: goodFetch, now: () => day, log: silent });
  assert.equal((await h.PARSE(req('POST', aiBody))).status, 200);
  assert.equal((await h.PARSE(req('POST', aiBody))).status, 200);
  const third = await h.PARSE(req('POST', aiBody));
  assert.equal(third.status, 429); assert.equal((await body(third)).error, 'ai_limit');
  assert.equal((await h.PARSE(req('POST', aiBody, 'u2'))).status, 200); // người khác không bị ảnh hưởng
  day = new Date('2026-11-05T01:00:00Z');
  assert.equal((await h.PARSE(req('POST', aiBody))).status, 200);
});

test('ai: AI lỗi thì hoàn lại lượt và trả 503; AI trả rác thì 502 và cũng hoàn lượt', async () => {
  const m = memoryStore();
  const mk = (f: any) => createAiHandlers({ requireUser, store: m.store, cfg: cfgOf({ dailyLimit: 1 }), fetchImpl: f, log: silent });
  const down = mk((async () => { throw new TypeError('fetch failed'); }) as any);
  for (let i = 0; i < 3; i++) assert.equal((await down.PARSE(req('POST', aiBody))).status, 503); // lỗi nhiều lần vẫn không mất lượt
  assert.equal(m.calls.refund, 3);
  const junk = mk((async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ content: [{ type: 'text', text: 'xin chào' }] }) })) as any);
  assert.equal((await junk.PARSE(req('POST', aiBody))).status, 502);
  assert.equal((await mk(goodFetch).PARSE(req('POST', aiBody))).status, 200); // vẫn còn đủ 1 lượt
});

test('ai: khóa API không lộ trong phản hồi', async () => {
  const m = memoryStore();
  const h = createAiHandlers({ requireUser, store: m.store, cfg: cfgOf({ apiKey: 'sk-bi-mat-123' }), fetchImpl: goodFetch, log: silent });
  const r = await h.PARSE(req('POST', aiBody));
  assert.ok(!(await r.text()).includes('sk-bi-mat-123'));
  assert.ok(![...r.headers.values()].join('\n').includes('sk-bi-mat-123'));
});
