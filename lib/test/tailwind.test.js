'use strict';
/** Tailwind của các trang Next.js: biên dịch thật app/trang.css bằng cấu hình trong repo rồi kiểm CSS sinh ra. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const config = require('../../tailwind.config.js');

const root = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

async function build() {
  // content tính theo thư mục đang chạy, nên đổi sang đường dẫn tuyệt đối cho chắc.
  const content = [path.join(root, 'app').replace(/\\/g, '/') + '/**/*.{js,jsx}'];
  const out = await postcss([tailwind({ ...config, content })]).process(read('app/trang.css'), { from: path.join(root, 'app/trang.css') });
  return out.css;
}

test('gói và cấu hình Tailwind có trong repo', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.devDependencies.tailwindcss);
  assert.ok(pkg.devDependencies.autoprefixer);
  assert.ok(require('../../postcss.config.js').plugins.tailwindcss);
  assert.match(read('app/layout.js'), /import '\.\/trang\.css'/);
});

test('CSS sinh ra có utility bố cục, mốc màn hình và màu theo biến (chế độ tối)', async () => {
  const css = await build();
  assert.match(css, /\.grid-cols-7\s*\{/, 'lịch tháng 7 cột');
  assert.match(css, /@media \(min-width: 860px\)[\s\S]*wide\\:grid-cols-4/, 'thống kê 4 cột trên màn rộng');
  assert.match(css, /@media not all and \(min-width: 641px\)[\s\S]*max-sm\\:min-h-16/, 'ô lịch thấp hơn trên điện thoại');
  assert.match(css, /\.bg-surface\s*\{[^}]*var\(--surface\)/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /font-size:\s*clamp\(24px,\s*4vw,\s*32px\)/, 'tiêu đề co giãn là cỡ chữ, không bị hiểu thành màu');
});

test('giữ các lớp mà web/js/lien-he.js gán lại', async () => {
  const css = await build();
  const js = read('web/js/lien-he.js');
  for (const name of ['ok', 'bad']) {
    assert.ok(js.includes(`'form-status ${name}'`));
    assert.match(css, new RegExp(`\\.form-status\\.${name}\\s*\\{`));
  }
});
