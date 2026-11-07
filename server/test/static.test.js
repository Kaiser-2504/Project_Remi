'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

test('API lạ trả 404 dạng JSON, phương thức lạ bị chặn', async () => {
  const s = await start();
  try {
    const r = await s.client().req('GET', '/api/khong-co');
    assert.equal(r.status, 404);
    assert.equal(r.json.error, 'not_found');
    const post = await fetch(s.base + '/index.html', { method: 'POST' });
    assert.equal(post.status, 405);
  } finally { await s.close(); }
});

test('không đọc được file ngoài thư mục web (path traversal)', async () => {
  const s = await start();
  try {
    for (const p of ['/../server/config.js', '/%2e%2e/server/config.js', '/..%2fserver/config.js', '/%00', '/js/../../package.json']) {
      const r = await fetch(s.base + p);
      assert.notEqual(r.status, 200, p);
      assert.ok(!(await r.text()).includes('loadConfig'), p);
    }
  } finally { await s.close(); }
});

test('trang chủ có tiêu đề bảo mật', async () => {
  const s = await start();
  try {
    const r = await fetch(s.base + '/');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-type'), /text\/html/);
  } finally { await s.close(); }
});
