'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

test('.gitignore không chặn nhầm web/data và ml/data (lỗi thật đã làm CI đỏ vì thiếu dishes.json)', () => {
  const lines = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
  assert.ok(!lines.includes('data') && !lines.includes('data/'), 'dòng "data/" không có dấu / ở đầu sẽ chặn mọi thư mục tên data; hãy dùng "/data/"');
  assert.ok(lines.includes('/data/'), 'phải vẫn chặn thư mục dữ liệu chạy thật ở gốc repo');
  for (const f of ['web/data/dishes.json', 'ml/data/gold.jsonl', 'ml/data/holdout.jsonl']) assert.ok(fs.existsSync(path.join(root, f)), f);
});

test('.gitignore vẫn chặn bí mật và dữ liệu chạy thật', () => {
  const lines = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
  for (const must of ['node_modules/', '.env', '*.sqlite']) assert.ok(lines.includes(must), 'thiếu ' + must);
});
