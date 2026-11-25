// Nội dung CSP dùng chung cho next.config.js (trang tĩnh, API) và middleware.js (trang Next.js có nonce).
const BASE = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com",
  // Google Analytics gửi sự kiện, Sentry nhận lỗi (xem web/js/monitor.js, lib/monitor.js).
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

const GA = 'https://www.googletagmanager.com';
const PAGE_ROUTES = ['/lich', '/thong-ke', '/gioi-thieu', '/lien-he'];

function staticCsp() {
  return [`script-src 'self' ${GA}`, ...BASE].join('; ');
}

function pageCsp(nonce, dev = false) {
  // Chế độ dev của Next cần eval để tải lại nóng.
  return [`script-src 'self' 'nonce-${nonce}' ${GA}${dev ? " 'unsafe-eval'" : ''}`, ...BASE].join('; ');
}

module.exports = { staticCsp, pageCsp, PAGE_ROUTES };
