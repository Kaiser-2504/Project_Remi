/** @type {import('next').NextConfig} */

// Giữ nguyên các tiêu đề bảo mật của máy chủ Node cũ (server/http.js).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const security = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];
const noCache = [{ key: 'Cache-Control', value: 'no-cache' }];

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
      { source: '/:path*', headers: security },
      // Trang và service worker phải luôn được kiểm tra lại để người dùng nhận bản mới.
      { source: '/', headers: noCache },
      { source: '/index.html', headers: noCache },
      { source: '/manifest.webmanifest', headers: noCache },
      { source: '/sw.js', headers: [...noCache, { key: 'Service-Worker-Allowed', value: '/' }] },
    ];
  },
};
