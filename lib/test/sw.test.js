'use strict';
// Chạy web/sw.js trong môi trường giả để kiểm tra phần thông báo (không cần trình duyệt).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(opts = {}) {
  const handlers = {};
  const shown = []; const posted = []; const opened = []; const fetched = []; let focused = 0;
  const client = { visibilityState: opts.visible ? 'visible' : 'hidden', postMessage: (m) => posted.push(m), focus: () => { focused++; return Promise.resolve(); } };
  const self = {
    location: { origin: 'https://remi.test' },
    addEventListener: (t, fn) => { handlers[t] = fn; },
    skipWaiting() {},
    clients: {
      matchAll: async () => (opts.noClient ? [] : [client]),
      openWindow: async (u) => { opened.push(u); },
      claim: async () => {},
    },
    registration: {
      showNotification: async (title, o) => { shown.push({ title, o }); },
      getNotifications: async () => [{ close() {} }],
    },
  };
  const ctx = {
    self, URL, Promise, setTimeout: (fn) => { fn(); return 0; },
    caches: { open: async () => ({ addAll: async () => {}, put() {} }), keys: async () => [], delete: async () => {}, match: async () => null },
    fetch: async (url, init) => { fetched.push({ url, init }); if (opts.fetchFail) throw new Error('offline'); return { ok: opts.status ? opts.status < 400 : true, status: opts.status || 200 }; },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../web/sw.js'), 'utf8'), ctx);
  const waits = [];
  const fire = async (type, ev) => { ev.waitUntil = (p) => waits.push(p); handlers[type](ev); await Promise.all(waits.splice(0)); };
  return { fire, shown, posted, opened, fetched, get focused() { return focused; } };
}
const click = (action, data) => ({ action, notification: { close() {}, data } });
const KEY = 't:ab12:2026-11-23T04:00:00.000Z:due';

test('push khi app đóng: hiện thông báo kèm nút và giữ key', async () => {
  const sw = load();
  await sw.fire('push', { data: { json: () => ({ title: 'T', body: 'B', tag: KEY, url: '/', key: KEY, actions: [{ action: 'done', title: 'Xong' }, { action: 'snooze', title: 'Lại' }] }) } });
  assert.equal(sw.shown.length, 1);
  assert.equal(sw.shown[0].o.actions.length, 2);
  assert.equal(sw.shown[0].o.data.key, KEY);
});

test('push khi app đang mở: không hiện thông báo hệ thống (tránh báo hai lần)', async () => {
  const sw = load({ visible: true });
  await sw.fire('push', { data: { json: () => ({ title: 'T', body: 'B', tag: 'x' }) } });
  assert.equal(sw.shown.length, 0);
  assert.equal(sw.posted[0].type, 'push');
});

test('push cũ không có nút vẫn hiện bình thường', async () => {
  const sw = load();
  await sw.fire('push', { data: { json: () => ({ title: 'T', body: 'B', tag: 'k', url: '/' }) } });
  assert.equal(JSON.stringify(sw.shown[0].o.actions), '[]');
});

test('nút Nhắc lại: gọi máy chủ với X-Remi, không mở app, báo đã hẹn', async () => {
  const sw = load();
  await sw.fire('notificationclick', click('snooze', { url: '/', key: KEY }));
  assert.equal(sw.fetched[0].url, '/api/reminders/snooze');
  assert.equal(sw.fetched[0].init.method, 'POST');
  assert.equal(sw.fetched[0].init.headers['X-Remi'], '1');
  assert.deepEqual(JSON.parse(sw.fetched[0].init.body), { key: KEY, minutes: 10 });
  assert.equal(sw.opened.length, 0);
  assert.equal(sw.shown[0].o.body, 'Sẽ nhắc lại sau 10 phút.');
});

test('nút Nhắc lại thất bại (mất mạng hoặc 401): mở app để người dùng tự xử lý', async () => {
  const off = load({ fetchFail: true, noClient: true });
  await off.fire('notificationclick', click('snooze', { url: '/', key: KEY }));
  assert.equal(off.opened.length, 1);
  const unauth = load({ status: 401, noClient: true });
  await unauth.fire('notificationclick', click('snooze', { url: '/', key: KEY }));
  assert.equal(unauth.opened.length, 1);
});

test('nút Xong: app đang mở thì gửi tin cho app; đang đóng thì mở app với #act=done', async () => {
  const open = load();
  await open.fire('notificationclick', click('done', { url: '/', key: KEY }));
  assert.equal(JSON.stringify(open.posted[0]), JSON.stringify({ type: 'action', action: 'done', key: KEY }));
  assert.equal(open.focused, 1);
  const closed = load({ noClient: true });
  await closed.fire('notificationclick', click('done', { url: '/', key: KEY }));
  assert.equal(closed.opened[0], '/#act=done&key=' + encodeURIComponent(KEY));
});

test('bấm vào thân thông báo (không phải nút): chỉ mở/focus app', async () => {
  const sw = load();
  await sw.fire('notificationclick', click('', { url: '/', key: KEY }));
  assert.equal(sw.focused, 1);
  assert.equal(sw.fetched.length, 0);
  assert.equal(sw.posted.length, 0);
});
