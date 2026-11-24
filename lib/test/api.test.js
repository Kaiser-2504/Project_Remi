'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../api');
const { createPush } = require('../push');
const { loadConfig } = require('../config');
const { createFakeRepo } = require('./fake-repo');

const quiet = { warn() {}, error() {}, log() {} };
const T0 = Date.parse('2026-11-23T03:00:00Z');

function makeApp(over = {}) {
  const clock = { t: T0 };
  const repo = createFakeRepo(clock);
  const cfg = loadConfig({}, { secureCookies: true, anthropicKey: 'khoa-gia', aiDailyLimit: 2, ...(over.cfg || {}) });
  const pushed = [];
  const push = over.push || createPush({ repo, cfg, sender: async (s, p) => { pushed.push({ s, p }); }, log: quiet });
  const api = createApi({ repo, cfg, push, fetchImpl: over.fetchImpl, log: quiet });
  let cookie = '';
  async function call(method, path, { body, csrf = true, headers = {}, jar = true, raw } = {}) {
    const h = { ...headers };
    if (csrf) h['x-remi'] = '1';
    if (jar && cookie) h.cookie = cookie;
    if (body !== undefined || raw !== undefined) h['content-type'] = 'application/json';
    const res = await api(new Request('https://remi.test' + path, { method, headers: h, body: raw !== undefined ? raw : (body === undefined ? undefined : JSON.stringify(body)) }));
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let json = null; try { json = await res.json(); } catch { /* không có thân */ }
    return { status: res.status, json, headers: res.headers, setCookie: set };
  }
  return { call, repo, cfg, clock, pushed, push, getCookie: () => cookie, setCookie: (c) => { cookie = c; } };
}

const REG = { email: 'xiu@example.com', name: 'Xíu', password: 'matkhau-dai-123' };
async function registered(app) {
  const r = await app.call('POST', '/api/auth/register', { body: REG });
  assert.equal(r.status, 201);
  return r.json.user;
}

test('health: báo AI/push và kiểm tra DB khi hỏi ?db=1', async () => {
  const app = makeApp();
  const r = await app.call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, ai: true, push: true });
  assert.equal((await app.call('GET', '/api/health?db=1')).json.db, true);
  app.repo.ping = async () => { throw new Error('mất kết nối'); };
  const bad = await app.call('GET', '/api/health?db=1');
  assert.equal(bad.status, 503);
  assert.equal(bad.json.db, false);
});

test('đăng ký: tạo tài khoản, đặt cookie phiên HttpOnly+Secure, /api/me dùng được', async () => {
  const app = makeApp();
  const user = await registered(app);
  assert.equal(user.email, 'xiu@example.com');
  assert.equal(user.pass, undefined, 'không lộ băm mật khẩu');
  const me = await app.call('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.json.user.name, 'Xíu');
});

test('cookie phiên có HttpOnly, SameSite=Lax, Secure (production) và hạn 30 ngày', async () => {
  const app = makeApp();
  const r = await app.call('POST', '/api/auth/register', { body: REG });
  assert.match(r.setCookie, /^remi_session=[\w-]+;/);
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /SameSite=Lax/);
  assert.match(r.setCookie, /Secure/);
  assert.match(r.setCookie, /Max-Age=2592000/);
});

test('có thể dùng Bearer thay cho cookie', async () => {
  const app = makeApp();
  await registered(app);
  const token = app.getCookie().split('=')[1];
  const r = await app.call('GET', '/api/me', { jar: false, headers: { authorization: 'Bearer ' + token } });
  assert.equal(r.status, 200);
});

test('đăng ký: kiểm tra email, tên, mật khẩu; email trùng không phân biệt hoa thường', async () => {
  const app = makeApp();
  const bad = (b) => app.call('POST', '/api/auth/register', { body: b, jar: false });
  assert.equal((await bad({ ...REG, email: 'khong-phai-email' })).json.error, 'bad_email');
  assert.equal((await bad({ ...REG, name: '' })).json.error, 'bad_name');
  assert.equal((await bad({ ...REG, name: 'x'.repeat(21) })).json.error, 'bad_name');
  assert.equal((await bad({ ...REG, password: 'ngan' })).json.error, 'bad_password');
  await registered(app);
  const dup = await bad({ ...REG, email: 'XIU@Example.COM' });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error, 'email_taken');
});

test('khoá đăng ký bằng ALLOW_REGISTRATION=0', async () => {
  const app = makeApp({ cfg: { allowRegistration: false } });
  const r = await app.call('POST', '/api/auth/register', { body: REG });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'registration_closed');
});

test('đăng nhập: đúng/sai mật khẩu, email lạ cùng một thông báo, giới hạn 10 lần', async () => {
  const app = makeApp();
  await registered(app);
  app.setCookie('');
  const ok = await app.call('POST', '/api/auth/login', { body: { email: 'XIU@example.com', password: REG.password } });
  assert.equal(ok.status, 200);
  const wrong = await app.call('POST', '/api/auth/login', { body: { email: REG.email, password: 'sai-mat-khau' }, jar: false });
  const ghost = await app.call('POST', '/api/auth/login', { body: { email: 'ma@example.com', password: 'sai-mat-khau' }, jar: false });
  assert.equal(wrong.status, 401);
  assert.equal(ghost.status, 401);
  assert.equal(wrong.json.message, ghost.json.message, 'không lộ email nào có tài khoản');
  let last;
  for (let i = 0; i < 12; i++) last = await app.call('POST', '/api/auth/login', { body: { email: REG.email, password: 'sai-' + i }, jar: false, headers: { 'x-forwarded-for': '9.9.9.9' } });
  assert.equal(last.status, 429);
  assert.equal(last.json.error, 'rate_limited');
});

test('đăng nhập đúng thì xoá bộ đếm thử sai', async () => {
  const app = makeApp();
  await registered(app);
  const h = { 'x-forwarded-for': '1.2.3.4' };
  for (let i = 0; i < 5; i++) await app.call('POST', '/api/auth/login', { body: { email: REG.email, password: 'sai-' + i }, jar: false, headers: h });
  assert.equal((await app.call('POST', '/api/auth/login', { body: { email: REG.email, password: REG.password }, jar: false, headers: h })).status, 200);
  assert.equal(app.repo._limits.has(`login:1.2.3.4|${REG.email}`), false);
});

test('đăng xuất huỷ phiên và xoá cookie', async () => {
  const app = makeApp();
  await registered(app);
  const out = await app.call('POST', '/api/auth/logout', { body: {} });
  assert.equal(out.status, 200);
  assert.match(out.setCookie, /Max-Age=0/);
  const token = Object.keys(Object.fromEntries(app.repo._sessions))[0];
  assert.equal(token, undefined, 'phiên đã bị xoá khỏi CSDL');
});

test('chưa đăng nhập hoặc phiên hết hạn thì 401', async () => {
  const app = makeApp();
  assert.equal((await app.call('GET', '/api/me')).status, 401);
  await registered(app);
  assert.equal((await app.call('GET', '/api/me')).status, 200);
  app.clock.t = Date.now() + 31 * 24 * 3600 * 1000; // phiên hết hạn tính theo giờ thật nên đẩy đồng hồ giả từ giờ thật
  assert.equal((await app.call('GET', '/api/me')).status, 401);
});

test('chống CSRF: yêu cầu ghi thiếu header X-Remi bị từ chối, yêu cầu đọc thì không cần', async () => {
  const app = makeApp();
  const r = await app.call('POST', '/api/auth/register', { body: REG, csrf: false });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'csrf');
  assert.equal((await app.call('GET', '/api/health', { csrf: false })).status, 200);
});

test('đường dẫn lạ trả 404; thân JSON hỏng trả 400; lỗi nội bộ không lộ chi tiết', async () => {
  const app = makeApp();
  assert.equal((await app.call('GET', '/api/khong-co')).status, 404);
  assert.equal((await app.call('POST', '/api/auth/login', { raw: '{hong' })).json.error, 'bad_json');
  app.repo.getUserByEmail = async () => { throw new Error('mật khẩu DB là hunter2'); };
  const r = await app.call('POST', '/api/auth/login', { body: { email: REG.email, password: 'x'.repeat(8) } });
  assert.equal(r.status, 500);
  assert.doesNotMatch(JSON.stringify(r.json), /hunter2/);
});

test('trạng thái: đọc rỗng, ghi lần đầu, khoá lạc quan trả 409 kèm bản mới nhất', async () => {
  const app = makeApp();
  await registered(app);
  assert.deepEqual((await app.call('GET', '/api/state')).json, { version: 0, state: null });
  const w1 = await app.call('PUT', '/api/state', { body: { baseVersion: 0, state: { tasks: [1] } } });
  assert.equal(w1.json.version, 1);
  const stale = await app.call('PUT', '/api/state', { body: { baseVersion: 0, state: { tasks: [2] } } });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.error, 'conflict');
  assert.equal(stale.json.version, 1);
  assert.deepEqual(stale.json.state, { tasks: [1] });
  assert.equal((await app.call('PUT', '/api/state', { body: { baseVersion: 1, state: { tasks: [3] } } })).json.version, 2);
  const got = (await app.call('GET', '/api/state')).json;
  assert.equal(got.version, 2);
  assert.deepEqual(got.state, { tasks: [3] });
});

test('trạng thái: kiểm tra đầu vào', async () => {
  const app = makeApp();
  await registered(app);
  const put = (b) => app.call('PUT', '/api/state', { body: b });
  assert.equal((await put({ state: {} })).json.error, 'bad_version');
  assert.equal((await put({ baseVersion: -1, state: {} })).json.error, 'bad_version');
  assert.equal((await put({ baseVersion: 0, state: [] })).json.error, 'bad_state');
  assert.equal((await put({ baseVersion: 0, state: { a: 'x'.repeat(1_000_001) } })).json.error, 'too_large');
  assert.equal((await put({ baseVersion: 0, state: {}, schedule: [{ key: '', at: 1, title: 't' }] })).json.error, 'bad_schedule');
  assert.equal((await put({ baseVersion: 0, state: {}, schedule: [{ key: 'k', at: 1, title: 't', cond: 'lạ' }] })).json.error, 'bad_schedule');
  assert.equal((await put({ baseVersion: 0, state: {}, schedule: 'x' })).json.error, 'bad_schedule');
});

test('lịch nhắc: thêm, giữ nguyên giờ thì không nhắc lại, đổi giờ thì nhắc lại, bỏ khỏi danh sách thì xoá', async () => {
  const app = makeApp();
  const user = await registered(app);
  const at = T0 + 60_000;
  const put = (v, schedule) => app.call('PUT', '/api/state', { body: { baseVersion: v, state: { v }, schedule } });
  assert.equal((await put(0, [{ key: 'a', at, title: 'Uống nước' }, { key: 'b', at: at + 1, title: 'Đi chợ' }])).status, 200);
  assert.equal(app.repo._reminders.length, 2);
  app.repo._reminders.find((r) => r.key === 'a').sent_at = T0; // đã gửi
  assert.equal((await put(1, [{ key: 'a', at, title: 'Uống nước (sửa tên)' }])).status, 200);
  const a = app.repo._reminders.find((r) => r.key === 'a');
  assert.equal(a.sent_at, T0, 'giữ giờ thì giữ trạng thái đã gửi');
  assert.equal(app.repo._reminders.some((r) => r.key === 'b'), false, 'chưa gửi và không còn trong danh sách thì xoá');
  assert.equal((await put(2, [{ key: 'a', at: at + 3600_000, title: 'Uống nước' }])).status, 200);
  assert.equal(app.repo._reminders.find((r) => r.key === 'a').sent_at, null, 'đổi giờ thì nhắc lại');
  assert.equal(app.repo._reminders[0].user_id, user.id);
});

test('xung đột phiên bản thì KHÔNG đổi lịch nhắc', async () => {
  const app = makeApp();
  await registered(app);
  await app.call('PUT', '/api/state', { body: { baseVersion: 0, state: {}, schedule: [{ key: 'a', at: T0 + 1, title: 't' }] } });
  const r = await app.call('PUT', '/api/state', { body: { baseVersion: 0, state: {}, schedule: [] } });
  assert.equal(r.status, 409);
  assert.equal(app.repo._reminders.length, 1);
});

test('thông báo đẩy: khoá công khai, đăng ký, gỡ đăng ký, gửi thử', async () => {
  const app = makeApp({ cfg: { vapidPublic: 'PUB' } });
  await registered(app);
  assert.deepEqual((await app.call('GET', '/api/push/key')).json, { enabled: true, publicKey: 'PUB' });
  const bad = await app.call('POST', '/api/push/subscribe', { body: { subscription: { endpoint: 'http://khong-https', keys: { p256dh: 'a', auth: 'b' } } } });
  assert.equal(bad.json.error, 'bad_subscription');
  const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } };
  assert.equal((await app.call('POST', '/api/push/subscribe', { body: { subscription: sub } })).status, 201);
  assert.equal(app.repo._subs.length, 1);
  const t = await app.call('POST', '/api/push/test', { body: {} });
  assert.equal(t.json.sent, 1);
  assert.equal(app.pushed[0].p.tag, 'test');
  await app.call('DELETE', '/api/push/subscribe', { body: { endpoint: sub.endpoint } });
  assert.equal(app.repo._subs.length, 0);
});

test('gửi thử: thiết bị đã gỡ (410) bị xoá; chưa cấu hình VAPID thì 503', async () => {
  const gone = makeApp();
  await registered(gone);
  gone.push.send = null; // dùng bộ gửi riêng ném 410
  const repo = gone.repo;
  const push = createPush({ repo, cfg: gone.cfg, sender: async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); }, log: quiet });
  const user = (await gone.call('GET', '/api/me')).json.user;
  await repo.upsertPushSub({ userId: user.id, endpoint: 'https://p/1', p256dh: 'a', auth: 'b' });
  const r = await push.sendToUser(user.id, { title: 't' });
  assert.deepEqual(r, { sent: 0, failed: 0, removed: 1 });
  assert.equal(repo._subs.length, 0);

  const off = makeApp({ push: { enabled: false, publicKey: '', sendToUser: async () => ({}) } });
  await registered(off);
  assert.equal((await off.call('POST', '/api/push/test', { body: {} })).status, 503);
  assert.deepEqual((await off.call('GET', '/api/push/key')).json, { enabled: false, publicKey: '' });
});

function fakeAnthropic(text, calls = []) {
  return async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ content: [{ type: 'text', text }] }) };
  };
}
const AI_IN = { text: 'nhắc tôi đi chợ chiều mai', now: '2026-11-23T10:00', weekday: 'Thứ hai' };

test('AI: chưa có khoá thì 503; có khoá thì trả JSON đã kiểm tra; khoá không lộ ra thân trả lời', async () => {
  const none = makeApp({ cfg: { anthropicKey: '' } });
  await registered(none);
  assert.equal((await none.call('POST', '/api/ai/parse', { body: AI_IN })).json.error, 'ai_disabled');

  const calls = [];
  const app = makeApp({ fetchImpl: fakeAnthropic('{"intent":"task","title":"Đi chợ"}', calls) });
  await registered(app);
  const r = await app.call('POST', '/api/ai/parse', { body: AI_IN });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.title, 'Đi chợ');
  assert.equal(calls[0].init.headers['x-api-key'], 'khoa-gia');
  assert.doesNotMatch(JSON.stringify(r.json), /khoa-gia/);
});

test('AI: kiểm tra đầu vào và chặn vượt số lượt mỗi ngày', async () => {
  const app = makeApp({ fetchImpl: fakeAnthropic('{"intent":"task"}') });
  await registered(app);
  assert.equal((await app.call('POST', '/api/ai/parse', { body: { ...AI_IN, text: '' } })).json.error, 'bad_text');
  assert.equal((await app.call('POST', '/api/ai/parse', { body: { ...AI_IN, now: 'hôm nay' } })).json.error, 'bad_now');
  assert.equal((await app.call('POST', '/api/ai/parse', { body: { ...AI_IN, weekday: 'Funday' } })).json.error, 'bad_weekday');
  assert.equal((await app.call('POST', '/api/ai/parse', { body: AI_IN })).status, 200);
  assert.equal((await app.call('POST', '/api/ai/parse', { body: AI_IN })).status, 200);
  const over = await app.call('POST', '/api/ai/parse', { body: AI_IN });
  assert.equal(over.status, 429);
  assert.equal(over.json.error, 'ai_limit');
});

test('xoá tài khoản cần đúng mật khẩu và xoá luôn dữ liệu', async () => {
  const app = makeApp();
  const user = await registered(app);
  await app.call('PUT', '/api/state', { body: { baseVersion: 0, state: { a: 1 }, schedule: [{ key: 'k', at: T0 + 5, title: 't' }] } });
  assert.equal((await app.call('DELETE', '/api/me', { body: { password: 'sai-mat-khau' } })).status, 401);
  assert.equal((await app.call('DELETE', '/api/me', { body: { password: REG.password } })).status, 200);
  assert.equal(app.repo._users.has(user.id), false);
  assert.equal(app.repo._reminders.length, 0);
  assert.equal(app.repo._states.size, 0);
  assert.equal((await app.call('GET', '/api/me', { jar: false })).status, 401);
});

test('địa chỉ IP: lấy từ x-forwarded-for; TRUST_PROXY=0 thì bỏ qua header giả', async () => {
  const trust = makeApp();
  await trust.call('POST', '/api/auth/login', { body: { email: 'a@b.co', password: '12345678' }, headers: { 'x-forwarded-for': '7.7.7.7, 10.0.0.1' }, jar: false });
  assert.ok(trust.repo._limits.has('login:7.7.7.7|a@b.co'));
  const no = makeApp({ cfg: { trustProxy: false } });
  await no.call('POST', '/api/auth/login', { body: { email: 'a@b.co', password: '12345678' }, headers: { 'x-forwarded-for': '7.7.7.7' }, jar: false });
  assert.ok(no.repo._limits.has('login:?|a@b.co'));
});

function fakeGemini(parts, calls = [], status = 200, extra = {}) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok: status < 400, status, json: async () => ({ candidates: [{ content: { parts } }], ...extra }) };
  };
}
const GEM = { anthropicKey: '', geminiKey: 'khoa-gemini', aiModel: '' };

test('Gemini: gọi đúng địa chỉ, khoá trong header (không lên URL), đọc kết quả JSON', async () => {
  const calls = [];
  const app = makeApp({ cfg: GEM, fetchImpl: fakeGemini([{ text: '{"intent":"task","title":"Đi chợ"}' }], calls) });
  await registered(app);
  assert.equal((await app.call('GET', '/api/health')).json.ai, true, 'chỉ có khoá Gemini vẫn báo ai:true');
  const r = await app.call('POST', '/api/ai/parse', { body: AI_IN });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.title, 'Đi chợ');
  assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'khoa-gemini');
  assert.doesNotMatch(calls[0].url, /khoa-gemini/);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.match(body.contents[0].parts[0].text, /Remi/);
  assert.doesNotMatch(JSON.stringify(r.json), /khoa-gemini/);
});

test('Gemini: AI_MODEL tuỳ chỉnh được dùng; bỏ qua phần "suy nghĩ"; khi có cả hai khoá thì Gemini thắng', async () => {
  const calls = [];
  const app = makeApp({
    cfg: { ...GEM, aiModel: 'gemini-3.5-flash-lite', anthropicKey: 'khoa-anthropic' },
    fetchImpl: fakeGemini([{ text: 'nghĩ gì đó', thought: true }, { text: '{"intent":"habit","title":"Uống nước"}' }], calls),
  });
  await registered(app);
  const r = await app.call('POST', '/api/ai/parse', { body: AI_IN });
  assert.equal(r.json.data.intent, 'habit');
  assert.match(calls[0].url, /models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(calls[0].init.headers['x-api-key'], undefined, 'không gửi khoá Anthropic sang Google');
});

test('Gemini: bị chặn nội dung, rỗng, hoặc JSON hỏng thì 502 ai_bad_output; 429 của Google thì 502 ai_upstream', async () => {
  const blocked = makeApp({ cfg: GEM, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }) });
  await registered(blocked);
  assert.equal((await blocked.call('POST', '/api/ai/parse', { body: AI_IN })).json.error, 'ai_bad_output');
  const junk = makeApp({ cfg: GEM, fetchImpl: fakeGemini([{ text: 'không phải JSON' }]) });
  await registered(junk);
  assert.equal((await junk.call('POST', '/api/ai/parse', { body: AI_IN })).json.error, 'ai_bad_output');
  const busy = makeApp({ cfg: GEM, fetchImpl: fakeGemini([], [], 429) });
  await registered(busy);
  const r = await busy.call('POST', '/api/ai/parse', { body: AI_IN });
  assert.equal(r.status, 502);
  assert.equal(r.json.error, 'ai_upstream');
  assert.equal(r.json.upstream, 429);
});

test('Gemini: vẫn áp giới hạn lượt mỗi ngày; không có khoá nào thì ai_disabled', async () => {
  const app = makeApp({ cfg: { ...GEM, aiDailyLimit: 1 }, fetchImpl: fakeGemini([{ text: '{"intent":"task"}' }]) });
  await registered(app);
  assert.equal((await app.call('POST', '/api/ai/parse', { body: AI_IN })).status, 200);
  assert.equal((await app.call('POST', '/api/ai/parse', { body: AI_IN })).status, 429);
  const none = makeApp({ cfg: { anthropicKey: '', geminiKey: '' } });
  await registered(none);
  assert.equal((await none.call('GET', '/api/health')).json.ai, false);
  assert.equal((await none.call('POST', '/api/ai/parse', { body: AI_IN })).json.error, 'ai_disabled');
});

test('AI: mốc "when" sai năm (quá khứ) được đẩy về năm hiện tại; mốc đúng thì giữ nguyên', async () => {
  const run = async (when) => {
    const app = makeApp({ cfg: GEM, fetchImpl: fakeGemini([{ text: JSON.stringify({ intent: 'task', title: 'x', when }) }]) });
    await registered(app);
    return (await app.call('POST', '/api/ai/parse', { body: { ...AI_IN, now: '2026-11-24T10:00' } })).json.data.when;
  };
  assert.equal(await run('2025-11-25T17:00'), '2026-11-25T17:00');
  assert.equal(await run('2025-03-01T08:00'), '2027-03-01T08:00');
  assert.equal(await run('2026-11-25T17:00'), '2026-11-25T17:00');
});
