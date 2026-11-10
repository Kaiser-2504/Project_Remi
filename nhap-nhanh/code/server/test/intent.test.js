'use strict';
const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createIntentModel, fold, featurize } = require('../../web/js/intent-model.js');
const { parseCsv } = require('../../remi-ai/tools/rules_baseline.js');

const root = path.join(__dirname, '..', '..');
const model = JSON.parse(fs.readFileSync(path.join(root, 'web', 'data', 'intent-model.json'), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'remi-ai', 'fixtures', 'parity.json'), 'utf8'));
const LABELS = ['di_cho', 'habit_khac', 'nuoc', 'viec'];
const im = createIntentModel(model);

test('mô hình JSON nhất quán: nhãn, số đặc trưng, kích thước các mảng', () => {
  assert.deepEqual(model.labels, LABELS);
  const F = Object.keys(model.vocab).length;
  assert.equal(model.idf.length, F);
  assert.equal(model.coef.length, F * LABELS.length);
  assert.equal(model.intercept.length, LABELS.length);
  const idx = Object.values(model.vocab);
  assert.equal(new Set(idx).size, F, 'chỉ số đặc trưng không được trùng');
  assert.ok(idx.every((i) => Number.isInteger(i) && i >= 0 && i < F));
  assert.ok(model.idf.every(Number.isFinite) && model.coef.every(Number.isFinite));
});

test('mô hình và fixture đi cùng nhau: mã băm khớp (commit cả web/data/intent-model.json và remi-ai/fixtures/parity.json sau mỗi lần huấn luyện)', () => {
  const bytes = fs.readFileSync(path.join(root, 'web', 'data', 'intent-model.json'));
  const digest = crypto.createHash('sha256').update(Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1')).digest('hex');
  assert.equal(digest, fixture.model_sha256, 'mô hình đã bị sửa hoặc huấn luyện lại mà chưa cập nhật fixture; chạy lại python remi-ai/train.py');
});

test('JavaScript cho cùng xác suất với mô hình Python trên mọi câu trong fixture (sai số dưới 1e-6)', () => {
  assert.ok(fixture.cases.length >= 40);
  assert.deepEqual(fixture.labels, LABELS);
  for (const c of fixture.cases) {
    const p = im.probs(c.text);
    p.forEach((v, k) => assert.ok(Math.abs(v - c.probs[k]) < 1e-6, `${JSON.stringify(c.text)} nhãn ${LABELS[k]}: JS ${v} khác Python ${c.probs[k]}`));
  }
});

test('chuẩn hoá chữ: bỏ dấu, đ thành d, mọi chuỗi số thành 0', () => {
  assert.equal(fold('Đi chợ 2,5 kg!'), 'di cho 0 0 kg');
  assert.equal(fold('  Uống   NƯỚC 1000ml '), 'uong nuoc 0ml');
  assert.equal(fold(''), '');
  assert.equal(fold(null), '');
  assert.deepEqual(featurize('uống nước').slice(0, 3), ['uong', 'nuoc', 'uong_nuoc']);
});

test('dự đoán: xác suất cộng lại bằng 1, nhãn hợp lệ, đầu vào lạ không làm hỏng', () => {
  for (const t of ['uống nước 2 lít mỗi ngày', '', '   ', null, undefined, 'constructor __proto__ hasOwnProperty', 'x'.repeat(5000), '😀😀']) {
    const r = im.predict(t);
    assert.ok(LABELS.includes(r.label));
    assert.ok(Math.abs(Object.values(r.probs).reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.ok(r.confidence > 0 && r.confidence <= 1);
  }
});

test('mô hình bộ khung nhận ra 4 loại câu rõ ràng (nếu nhóm huấn luyện lại, cập nhật các câu này theo mô hình mới)', () => {
  const cases = [
    ['uống nước 2 lít mỗi ngày', 'nuoc'],
    ['đi bộ 30 phút mỗi sáng', 'habit_khac'],
    ['mai 9h họp nhóm', 'viec'],
    ['đi chợ nấu cà ri', 'di_cho'],
  ];
  for (const [t, want] of cases) assert.equal(im.predict(t).label, want, t);
});

test('dữ liệu mẫu: tệp CSV có đúng 2 cột, nhãn hợp lệ, tập viết tay cân bằng', () => {
  for (const f of ['train.csv', 'test_synth.csv', 'test_hand.csv']) {
    const rows = parseCsv(fs.readFileSync(path.join(root, 'remi-ai', 'data', f), 'utf8'));
    assert.ok(rows.length >= 50, f);
    for (const r of rows) {
      assert.ok(LABELS.includes(r.label), `${f}: nhãn lạ ${r.label}`);
      assert.ok(r.text && r.text.trim(), `${f}: câu trống`);
    }
  }
  const hand = parseCsv(fs.readFileSync(path.join(root, 'remi-ai', 'data', 'test_hand.csv'), 'utf8'));
  for (const l of LABELS) assert.equal(hand.filter((r) => r.label === l).length, 25, l);
});
