'use strict';
/** Trang Next.js nhận CSP có nonce (middleware.js). Dựng tĩnh lúc build thì script không có nonce, bị chặn và trang trắng. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PAGE_ROUTES } = require('../csp');

test('trang dùng CSP nonce phải dựng theo yêu cầu, nếu không sẽ trắng trang', () => {
  for (const route of PAGE_ROUTES) {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app', route.slice(1), 'page.js'), 'utf8');
    assert.match(src, /export const dynamic = 'force-dynamic'/, route);
  }
});
