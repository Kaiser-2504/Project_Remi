'use strict';
/**
 * Gửi một lỗi thử từ máy chủ lên Sentry để kiểm tra cấu hình.
 *   SENTRY_DSN=https://...@....ingest.sentry.io/123 node scripts/sentry-test.js
 * hoặc đặt SENTRY_DSN trong .env rồi: npm run sentry:test
 */
const { createMonitor } = require('../lib/monitor');

const m = createMonitor({ dsn: process.env.SENTRY_DSN, env: process.env.NODE_ENV || 'development' });
if (!m.enabled) {
  console.error('Chưa có SENTRY_DSN hợp lệ. Xem docs/THEO-DOI.md.');
  process.exit(1);
}
m.capture(new Error('Remi: lỗi thử để kiểm tra Sentry (máy chủ)'), { tags: { where: 'sentry-test' } }).then((id) => {
  console.log(id ? `Đã gửi, event id ${id}. Mở Sentry > Issues để xem.` : 'Gửi thất bại.');
  process.exit(id ? 0 : 1);
});
