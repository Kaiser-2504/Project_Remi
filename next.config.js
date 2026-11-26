/** @type {import('next').NextConfig} */

// Giữ nguyên các tiêu đề bảo mật của máy chủ Node cũ (server/http.js). Nội dung CSP ở lib/csp.js.
const { staticCsp, PAGE_ROUTES } = require('./lib/csp.js');
const CSP = staticCsp();

const security = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];
const noCache = [{ key: 'Cache-Control', value: 'no-cache' }];
// Trang Next.js (/lich, /thong-ke, ...) nhận CSP có nonce từ middleware.js, nên ở đây bỏ CSP cố định cho chúng.
const pageSecurity = security.filter((h) => h.key !== 'Content-Security-Policy');
const pageRe = PAGE_ROUTES.map((r) => r.slice(1)).join('|');

module.exports = {
  poweredByHeader: false,
  // Hai gói này chạy ở Node, để Next không đóng gói chúng vào bundle.
  serverExternalPackages: ['postgres', 'web-push'],
  async rewrites() {
    // Giao diện hiện tại là một trang HTML tĩnh (public/index.html, sinh từ web/ bởi scripts/sync-public.js).
    return { beforeFiles: [{ source: '/', destination: '/index.html' }] };
  },
  async headers() {
    return [
      { source: `/((?!${pageRe}).*)`, headers: security },
      ...PAGE_ROUTES.map((r) => ({ source: r, headers: pageSecurity })),
      // Trang và service worker phải luôn được kiểm tra lại để người dùng nhận bản mới.
      { source: '/', headers: noCache },
      { source: '/index.html', headers: noCache },
      { source: '/manifest.webmanifest', headers: noCache },
      { source: '/sw.js', headers: [...noCache, { key: 'Service-Worker-Allowed', value: '/' }] },
    ];
  },
};
