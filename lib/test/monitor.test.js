'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMonitor, parseDsn, buildEnvelope, frames } = require('../monitor');

const DSN = 'https://abc123@o42.ingest.us.sentry.io/4507';

test('parseDsn tạo đúng URL envelope', () => {
  const t = parseDsn(DSN);
  assert.equal(t.key, 'abc123');
  assert.equal(t.url, 'https://o42.ingest.us.sentry.io/api/4507/envelope/?sentry_key=abc123&sentry_version=7');
});

test('parseDsn trả null khi DSN trống hoặc sai', () => {
  for (const bad of ['', undefined, 'khong-phai-url', 'https://o42.ingest.sentry.io/4507', 'https://key@o42.ingest.sentry.io/']) {
    assert.equal(parseDsn(bad), null, String(bad));
  }
});

test('envelope có 3 dòng JSON và chứa thông tin lỗi', () => {
  const { id, body } = buildEnvelope(new TypeError('hỏng'), { env: 'test', tags: { where: '[api]' } });
  const [head, item, event] = body.split('\n').map((l) => JSON.parse(l));
  assert.equal(head.event_id, id);
  assert.equal(item.type, 'event');
  assert.equal(event.environment, 'test');
  assert.equal(event.tags.where, '[api]');
  assert.equal(event.exception.values[0].type, 'TypeError');
  assert.equal(event.exception.values[0].value, 'hỏng');
  assert.match(id, /^[0-9a-f]{32}$/);
});

test('frames đọc được stack của Node, khung gần nhất ở cuối', () => {
  const f = frames('Error: x\n    at inner (/app/lib/a.js:10:5)\n    at /app/node_modules/b/index.js:2:3');
  assert.equal(f.length, 2);
  assert.equal(f[1].function, 'inner');
  assert.equal(f[1].lineno, 10);
  assert.equal(f[0].in_app, false);
});

test('logger.error vẫn ghi console và gửi lên Sentry', async () => {
  const calls = [];
  const logged = [];
  const m = createMonitor({ dsn: DSN, env: 'test', fetchImpl: async (url, opt) => calls.push({ url, opt }), consoleImpl: { error: (...a) => logged.push(a), warn() {}, info() {} } });
  assert.equal(m.enabled, true);
  const id = await m.logger.error('[api]', new Error('mất kết nối CSDL'));
  assert.equal(logged.length, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/4507\/envelope\//);
  assert.match(calls[0].opt.body, /mất kết nối CSDL/);
  assert.match(id, /^[0-9a-f]{32}$/);
});

test('không có DSN thì không gửi gì, chỉ ghi console', async () => {
  let sent = 0;
  const m = createMonitor({ dsn: '', fetchImpl: async () => sent++, consoleImpl: { error() {}, warn() {}, info() {} } });
  assert.equal(m.enabled, false);
  assert.equal(await m.logger.error('[api]', new Error('x')), null);
  assert.equal(sent, 0);
});

test('Sentry lỗi mạng thì không làm hỏng yêu cầu', async () => {
  const m = createMonitor({ dsn: DSN, fetchImpl: async () => { throw new Error('offline'); }, consoleImpl: { error() {}, warn() {}, info() {} } });
  assert.equal(await m.capture(new Error('x')), null);
});

test('CSP cho phép GA và Sentry nhưng vẫn chặn script nội tuyến', () => {
  const { staticCsp, pageCsp } = require('../csp');
  for (const csp of [staticCsp(), pageCsp('abc123')]) {
    const script = csp.split('; ').find((d) => d.startsWith('script-src'));
    assert.match(script, /https:\/\/www\.googletagmanager\.com/);
    assert.doesNotMatch(script, /unsafe-inline/);
    assert.match(csp, /connect-src[^;]*ingest\.sentry\.io/);
    assert.match(csp, /connect-src[^;]*google-analytics\.com/);
  }
  assert.match(pageCsp('abc123'), /'nonce-abc123'/);
  assert.doesNotMatch(pageCsp('abc123'), /unsafe-eval/);
});

test('trang nạp monitor-config.js và monitor.js trước app.js', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'index.html'), 'utf8');
  const a = html.indexOf('/js/monitor-config.js');
  const b = html.indexOf('/js/monitor.js');
  const c = html.indexOf('/js/app.js');
  assert.ok(a > 0 && a < b && b < c);
});
