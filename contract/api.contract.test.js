'use strict';
/**
 * Bộ test HỢP ĐỒNG API (Người 4, D5). Kiểm tra máy chủ đúng như docs/API.md, bất kể viết bằng gì.
 *
 *   BACKEND_URL=https://remi-git-xxx.vercel.app npm run test:contract   chạy với bản đang triển khai (DB thật)
 *   npm run test:contract                                               không đặt BACKEND_URL: tự bật server Node cũ
 *                                                                       trong bộ nhớ trên cổng ngẫu nhiên
 *
 * Bộ test tự tạo người dùng riêng (email ngẫu nhiên) và xoá đi khi xong, nên chạy lặp lại với DB thật được.
 * Thiếu cấu hình AI trên máy chủ (ai_disabled) thì phần AI cần khóa được BỎ QUA và ghi rõ lý do, không giả vờ đạt.
 * Biến tuỳ chọn: CONTRACT_SKIP_REGISTER_LIMIT=1 để bỏ qua việc thử giới hạn đăng ký (nên đặt khi chạy với bản thật).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

let base = process.env.BACKEND_URL ? process.env.BACKEND_URL.replace(/\/$/, '') : '';
let localApp = null;

test.before(async () => {
  if (base) return;
  const path = require('node:path');
  const { createApp } = require('../server/index');
  const { loadConfig } = require('../server/config');
  localApp = createApp(loadConfig({}, { dataDir: ':memory:', host: '127.0.0.1', schedulerMs: 3600000, webDir: path.join(__dirname, '..', 'web') }), {
    log: { warn() {}, error() {}, log() {} },
  });
  const addr = await localApp.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${addr.port}`;
});
test.after(async () => { if (localApp) await localApp.close(); });

/** Máy khách giả có kho cookie (một trình duyệt). */
function client() {
  let cookie = '';
  return {
    async req(method, p, body, headers = {}) {
      const raw = typeof body === 'string';
      const r = await fetch(base + p, {
        method,
        headers: { 'content-type': 'application/json', 'x-remi': '1', ...(cookie ? { cookie } : {}), ...headers },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      });
      const sc = r.headers.get('set-cookie');
      if (sc) { const c = sc.split(';')[0]; cookie = c.endsWith('=') ? '' : c; }
      let json = null;
      try { json = await r.json(); } catch { /* không có thân JSON */ }
      return { status: r.status, json, headers: r.headers };
    },
  };
}

const PASSWORD = 'mat-khau-hop-dong-123';
/**
 * Chỉ tạo 3 người dùng cho cả bộ test (đăng ký bị giới hạn theo IP, vài lần chạy liên tiếp không được làm hết lượt;
 * các lần đăng ký thử sai ở dưới cũng tính vào giới hạn đó, tổng cộng dưới 10 lần mỗi lần chạy):
 *   fresh  để kiểm tra trạng thái ban đầu và xoá tài khoản; main và other dùng chung, các test không giả định phiên bản bắt đầu từ 0.
 */
const users = {};
async function user(name) {
  if (users[name]) return users[name];
  const email = `contract-${name}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}@example.com`;
  const c = client();
  const r = await c.req('POST', '/api/auth/register', { email, name: 'Hợp đồng', password: PASSWORD });
  assert.equal(r.status, 201, 'không tạo được người dùng thử: ' + JSON.stringify(r.json));
  c.email = email;
  return (users[name] = c);
}
test.after(async () => { for (const c of Object.values(users)) await c.req('DELETE', '/api/me', { password: PASSWORD }).catch(() => {}); }); // người đã xoá rồi thì lệnh này vô hại (401)
const version = async (c) => (await c.req('GET', '/api/state')).json.version;

const assertError = (r, status, code) => {
  assert.equal(r.status, status, JSON.stringify(r.json));
  assert.equal(typeof r.json?.error, 'string', 'lỗi phải có trường error dạng chữ');
  assert.equal(typeof r.json?.message, 'string', 'lỗi phải có trường message dạng chữ');
  if (code) assert.equal(r.json.error, code);
};
const rem = (key, at = Date.now() + 3600000, extra = {}) => ({ key, at, title: 'Lời nhắc ' + key, ...extra });
const SUB = (id) => ({ subscription: { endpoint: `https://push.example.com/contract/${id}`, keys: { p256dh: 'p256dh-test', auth: 'auth-test' } } });
const AI = { text: 'đi chợ nấu cà ri lúc 7h', now: '2026-11-04T10:00', weekday: 'Thứ tư' };

/* ------------------------------------------------------------------ chung */
test('GET /api/health trả { ok: true }', async () => {
  const r = await client().req('GET', '/api/health');
  assert.equal(r.status, 200); assert.equal(r.json.ok, true);
});

test('mọi endpoint cần đăng nhập trả 401 đúng dạng lỗi', async () => {
  const c = client();
  const calls = [
    ['GET', '/api/state'], ['PUT', '/api/state', { baseVersion: 0, state: {} }],
    ['GET', '/api/push/key'], ['POST', '/api/push/subscribe', SUB('x')], ['DELETE', '/api/push/subscribe', { endpoint: 'https://p/x' }],
    ['POST', '/api/ai/parse', AI], ['GET', '/api/me'],
  ];
  for (const [m, p, b] of calls) assertError(await c.req(m, p, b), 401, 'unauthorized');
});

test('yêu cầu ghi thiếu header X-Remi bị từ chối 403 (chống CSRF)', async () => {
  const c = await user('main');
  assertError(await c.req('PUT', '/api/state', { baseVersion: 0, state: {} }, { 'x-remi': '' }), 403, 'csrf');
  assertError(await c.req('POST', '/api/push/subscribe', SUB('csrf'), { 'x-remi': '0' }), 403, 'csrf');
});

test('JSON hỏng trả 400 bad_json, không phải 500', async () => {
  const c = await user('main');
  assertError(await c.req('PUT', '/api/state', '{không phải json'), 400, 'bad_json');
});

test('endpoint không tồn tại trả 404 dạng lỗi chuẩn', async () => {
  const r = await (await user('main')).req('GET', '/api/khong-co-endpoint-nay');
  assertError(r, 404, 'not_found');
});

test('lỗi 4xx không lộ stack, câu SQL hay đường dẫn máy chủ (lỗi 500 bất ngờ được kiểm trong remi-next/test/handlers.test.ts vì từ ngoài không gây ra được)', async () => {
  const c = await user('main');
  const bodies = [];
  bodies.push((await c.req('PUT', '/api/state', { baseVersion: 'x', state: {} })).json);
  bodies.push((await c.req('POST', '/api/push/subscribe', { subscription: 'x' })).json);
  bodies.push((await c.req('POST', '/api/ai/parse', { text: "'; DROP TABLE users;--" })).json);
  for (const b of bodies) assert.doesNotMatch(JSON.stringify(b), /at .*\(.*:\d+:\d+\)|SELECT |INSERT |node_modules|\/Users\/|postgres|sqlite/i);
});

/* ------------------------------------------------------------------ /api/state */
test('state: người mới có phiên bản 0, ghi từng bước tăng phiên bản, đọc lại đúng', async () => {
  const c = await user('fresh');
  assert.deepEqual((await c.req('GET', '/api/state')).json, { version: 0, state: null });
  const a = await c.req('PUT', '/api/state', { baseVersion: 0, state: { tasks: [{ id: 'a', title: 'Họp \'nhóm\' ☕' }] } });
  assert.equal(a.status, 200); assert.equal(a.json.version, 1);
  const g = await c.req('GET', '/api/state');
  assert.equal(g.json.version, 1);
  assert.deepEqual(g.json.state, { tasks: [{ id: 'a', title: 'Họp \'nhóm\' ☕' }] });
  assert.equal((await c.req('PUT', '/api/state', { baseVersion: 1, state: { tasks: [] } })).json.version, 2);
});

test('state: khóa lạc quan, bản cũ nhận 409 kèm phiên bản và dữ liệu mới nhất', async () => {
  const c = await user('main');
  const v = await version(c);
  assert.equal((await c.req('PUT', '/api/state', { baseVersion: v, state: { n: 1 } })).json.version, v + 1);
  const stale = await c.req('PUT', '/api/state', { baseVersion: v, state: { n: 'cũ' } });
  assertError(stale, 409, 'conflict');
  assert.equal(stale.json.version, v + 1); assert.deepEqual(stale.json.state, { n: 1 });
  const ahead = await c.req('PUT', '/api/state', { baseVersion: v + 9, state: { n: 'xa' } });
  assertError(ahead, 409, 'conflict');
  assert.deepEqual((await c.req('GET', '/api/state')).json.state, { n: 1 }); // bản bị từ chối không được ghi
});

test('state: hai thiết bị cùng ghi một lúc, đúng một bên thắng', async () => {
  const c = await user('main');
  const v = await version(c);
  const rs = await Promise.all([
    c.req('PUT', '/api/state', { baseVersion: v, state: { w: 'điện thoại' } }),
    c.req('PUT', '/api/state', { baseVersion: v, state: { w: 'máy tính' } }),
  ]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
  assert.equal(await version(c), v + 1);
});

test('state: dữ liệu mỗi người tách biệt', async () => {
  const a = await user('main'), b = await user('other');
  const va = await version(a), vb = await version(b);
  await a.req('PUT', '/api/state', { baseVersion: va, state: { bi_mat: 'của A' } });
  assert.equal(await version(b), vb); // ghi của A không làm đổi phiên bản của B
  assert.equal((await b.req('PUT', '/api/state', { baseVersion: vb, state: { bi_mat: 'của B' } })).status, 200);
  assert.deepEqual((await a.req('GET', '/api/state')).json.state, { bi_mat: 'của A' });
  assert.deepEqual((await b.req('GET', '/api/state')).json.state, { bi_mat: 'của B' });
});

test('state: kiểm tra đầu vào, mỗi trường một mã lỗi, và không yêu cầu sai nào được ghi', async () => {
  const c = await user('main');
  const before = (await c.req('GET', '/api/state')).json;
  const put = (b) => c.req('PUT', '/api/state', b);
  assertError(await put({ state: {} }), 400, 'bad_version');
  assertError(await put({ baseVersion: -1, state: {} }), 400, 'bad_version');
  assertError(await put({ baseVersion: 1.5, state: {} }), 400, 'bad_version');
  assertError(await put({ baseVersion: '0', state: {} }), 400, 'bad_version');
  assertError(await put({ baseVersion: 0 }), 400, 'bad_state');
  assertError(await put({ baseVersion: 0, state: [] }), 400, 'bad_state');
  assertError(await put({ baseVersion: 0, state: 'chữ' }), 400, 'bad_state');
  assertError(await put({ baseVersion: 0, state: {}, schedule: 'x' }), 400, 'bad_schedule');
  assertError(await put({ baseVersion: 0, state: {}, schedule: [{ key: '', at: 1, title: 'x' }] }), 400, 'bad_schedule');
  assertError(await put({ baseVersion: 0, state: {}, schedule: [rem('k', Date.now(), { cond: 'awake' })] }), 400, 'bad_schedule');
  assertError(await put({ baseVersion: 0, state: {}, schedule: [rem('k', 1, { title: 'x'.repeat(161) })] }), 400, 'bad_schedule');
  assertError(await put({ baseVersion: 0, state: {}, schedule: Array.from({ length: 501 }, (_, i) => rem('k' + i)) }), 400, 'bad_schedule');
  assert.deepEqual((await c.req('GET', '/api/state')).json, before);
});

test('state: dữ liệu quá lớn trả 413', async () => {
  const c = await user('main');
  assertError(await c.req('PUT', '/api/state', { baseVersion: await version(c), state: { x: 'a'.repeat(1_100_000) } }), 413, 'too_large');
});

test('state: gửi kèm lịch nhắc hợp lệ được chấp nhận, danh sách rỗng và bỏ trống đều hợp lệ', async () => {
  const c = await user('main');
  const put = async (b) => (await c.req('PUT', '/api/state', { baseVersion: await version(c), state: {}, ...b })).status;
  assert.equal(await put({ schedule: [rem('a'), rem('b', Date.now() + 7200000, { body: 'Nội dung', cond: 'asleep' })] }), 200);
  assert.equal(await put({ schedule: [] }), 200);
  assert.equal(await put({}), 200);
});

test('state: lịch nhắc sai trong yêu cầu bị từ chối thì dữ liệu cũng không được ghi', async () => {
  const c = await user('main');
  const v = await version(c);
  await c.req('PUT', '/api/state', { baseVersion: v, state: { v: 1 } });
  assertError(await c.req('PUT', '/api/state', { baseVersion: v + 1, state: { v: 2 }, schedule: [{ key: '' }] }), 400, 'bad_schedule');
  const g = await c.req('GET', '/api/state');
  assert.equal(g.json.version, v + 1); assert.deepEqual(g.json.state, { v: 1 });
});

/* ------------------------------------------------------------------ /api/push */
test('push: khóa công khai có dạng { enabled, publicKey }', async () => {
  const r = await (await user('main')).req('GET', '/api/push/key');
  assert.equal(r.status, 200);
  assert.equal(typeof r.json.enabled, 'boolean'); assert.equal(typeof r.json.publicKey, 'string');
  if (r.json.enabled) assert.ok(r.json.publicKey.length > 20);
});

test('push: đăng ký 201, đăng ký lại cùng thiết bị vẫn 201, huỷ 200 và huỷ lại vẫn 200', async () => {
  const c = await user('main');
  const sub = SUB(crypto.randomBytes(6).toString('hex'));
  assert.equal((await c.req('POST', '/api/push/subscribe', sub)).status, 201);
  assert.equal((await c.req('POST', '/api/push/subscribe', sub)).status, 201);
  assert.equal((await c.req('DELETE', '/api/push/subscribe', { endpoint: sub.subscription.endpoint })).status, 200);
  assert.equal((await c.req('DELETE', '/api/push/subscribe', { endpoint: sub.subscription.endpoint })).status, 200);
});

test('push: đầu vào sai bị từ chối với bad_subscription', async () => {
  const c = await user('main');
  const ok = SUB('bad');
  const bads = [
    {}, { subscription: 'x' }, { subscription: { ...ok.subscription, endpoint: 'http://push.example.com/x' } },
    { subscription: { ...ok.subscription, endpoint: 'https://p/' + 'x'.repeat(1000) } },
    { subscription: { endpoint: ok.subscription.endpoint, keys: {} } },
    { subscription: { endpoint: ok.subscription.endpoint, keys: { p256dh: 'x'.repeat(201), auth: 'a' } } },
  ];
  for (const b of bads) assertError(await c.req('POST', '/api/push/subscribe', b), 400, 'bad_subscription');
});

test('push: huỷ thiết bị của người khác không báo lỗi (quyền sở hữu được kiểm bằng test Postgres, vì API không cho đọc danh sách thiết bị)', async () => {
  const a = await user('main'), b = await user('other');
  const sub = SUB(crypto.randomBytes(6).toString('hex'));
  assert.equal((await a.req('POST', '/api/push/subscribe', sub)).status, 201);
  assert.equal((await b.req('DELETE', '/api/push/subscribe', { endpoint: sub.subscription.endpoint })).status, 200);
  assert.equal((await a.req('DELETE', '/api/push/subscribe', { endpoint: sub.subscription.endpoint })).status, 200);
});

/* ------------------------------------------------------------------ /api/ai/parse */
test('ai: đầu vào sai trả 400 với mã lỗi riêng (bỏ qua nếu máy chủ chưa bật AI)', async (t) => {
  const c = await user('main');
  const probe = await c.req('POST', '/api/ai/parse', { ...AI, text: '' });
  if (probe.status === 503 && probe.json?.error === 'ai_disabled') return t.skip('máy chủ chưa có ANTHROPIC_API_KEY, chưa kiểm tra được thứ tự kiểm tra đầu vào');
  assertError(probe, 400, 'bad_text');
  assertError(await c.req('POST', '/api/ai/parse', { ...AI, text: 'x'.repeat(301) }), 400, 'bad_text');
  assertError(await c.req('POST', '/api/ai/parse', { ...AI, now: 'hôm nay' }), 400, 'bad_now');
  assertError(await c.req('POST', '/api/ai/parse', { ...AI, weekday: 'Monday' }), 400, 'bad_weekday');
});

test('ai: chưa bật AI thì 503 ai_disabled; đã bật thì trả { data } đúng cấu trúc hoặc lỗi phía AI 502/503 có mã riêng', async () => {
  const c = await user('main');
  const r = await c.req('POST', '/api/ai/parse', AI);
  if (r.status === 200) {
    assert.equal(typeof r.json.data.title, 'string');
    assert.ok(['task', 'habit'].includes(r.json.data.intent));
    assert.ok(Array.isArray(r.json.data.checklist));
    return;
  }
  assert.ok([502, 503].includes(r.status), 'trạng thái bất ngờ: ' + r.status);
  assert.match(r.json.error, /^ai_/);
  assert.ok(!JSON.stringify(r.json).match(/sk-ant|x-api-key/i)); // khóa không bao giờ lộ
});

/* ------------------------------------------------------------------ tài khoản (phần Người 3, chỉ kiểm điều test cần dựa vào) */
test('tài khoản: email trùng 409, sai mật khẩu 401, đăng nhập đúng 200, đăng xuất thì phiên mất hiệu lực', async () => {
  const c = await user('other');
  assertError(await client().req('POST', '/api/auth/register', { email: c.email.toUpperCase(), name: 'Trùng', password: PASSWORD }), 409, 'email_taken');
  assertError(await client().req('POST', '/api/auth/login', { email: c.email, password: 'sai-mat-khau-123' }), 401, 'bad_credentials');
  assertError(await client().req('POST', '/api/auth/login', { email: 'khong-ton-tai@example.com', password: PASSWORD }), 401, 'bad_credentials');
  const second = client();
  const ok = await second.req('POST', '/api/auth/login', { email: c.email, password: PASSWORD });
  assert.equal(ok.status, 200); assert.equal(ok.json.user.email, c.email);
  assert.equal((await second.req('GET', '/api/me')).status, 200);
  assert.equal((await second.req('POST', '/api/auth/logout', {})).status, 200);
  assertError(await second.req('GET', '/api/me'), 401, 'unauthorized');
  assert.equal((await c.req('GET', '/api/me')).status, 200); // phiên khác vẫn còn
});

test('tài khoản: đầu vào đăng ký sai trả mã riêng', async () => {
  const c = client();
  const base = { email: `x-${Date.now()}@example.com`, name: 'Xíu', password: PASSWORD };
  assertError(await c.req('POST', '/api/auth/register', { ...base, email: "a'; DROP TABLE users;--" }), 400, 'bad_email');
  assertError(await c.req('POST', '/api/auth/register', { ...base, name: '' }), 400, 'bad_name');
  assertError(await c.req('POST', '/api/auth/register', { ...base, password: '1234567' }), 400, 'bad_password');
});

/* ------------------------------------------------------------------ xoá tài khoản */
test('xoá tài khoản xoá luôn dữ liệu; đăng nhập lại không còn dữ liệu cũ', async () => {
  const c = await user('fresh');
  const email = c.email;
  await c.req('PUT', '/api/state', { baseVersion: await version(c), state: { x: 1 } });
  assertError(await c.req('DELETE', '/api/me', { password: 'sai-mat-khau' }), 401, 'bad_credentials');
  assert.equal((await c.req('DELETE', '/api/me', { password: PASSWORD })).status, 200);
  assertError(await c.req('GET', '/api/state'), 401, 'unauthorized');
  assertError(await client().req('POST', '/api/auth/login', { email, password: PASSWORD }), 401, 'bad_credentials');
});
