'use strict';
/**
 * Sao chép web/ sang public/ để Next.js phục vụ giao diện như file tĩnh.
 * web/ vẫn là nguồn duy nhất (máy chủ Node cũ và các bài test dùng nó); public/ là bản sinh ra, không commit.
 * Chạy tự động trước `npm run dev` và `npm run build`.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'web');
const dst = path.join(root, 'public');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('Không thấy web/index.html, không thể đồng bộ giao diện.');
  process.exit(1);
}
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });

const must = ['index.html', 'sw.js', 'manifest.webmanifest', 'css/app.css', 'js/app.js', 'data/dishes.json'];
const missing = must.filter((f) => !fs.existsSync(path.join(dst, f)));
if (missing.length) {
  console.error('Thiếu file trong public/: ' + missing.join(', '));
  process.exit(1);
}
console.log('Đã đồng bộ web/ -> public/');
