'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQty, unitKind, stepQty, scaleQty, canStep } = require('../../web/js/qty.js');

test('đọc định lượng viết kiểu người Việt', () => {
  assert.deepEqual(parseQty('500g'), { n: 500, u: 'g' });
  assert.deepEqual(parseQty('1,5 kg'), { n: 1.5, u: 'kg' });
  assert.deepEqual(parseQty('1.5 lít'), { n: 1.5, u: 'lít' });
  assert.deepEqual(parseQty('1/2 muỗng cà phê'), { n: 0.5, u: 'muỗng cà phê' });
  assert.deepEqual(parseQty('3'), { n: 3, u: '' });
  assert.equal(parseQty('một ít'), null);
  assert.equal(parseQty(''), null);
  assert.equal(parseQty('0 g'), null);
});

test('nhận ra loại đơn vị, kể cả có dấu và viết hoa', () => {
  assert.equal(unitKind('g'), 'g');
  assert.equal(unitKind('Gram'), 'g');
  assert.equal(unitKind('kg'), 'kg');
  assert.equal(unitKind('lít'), 'l');
  assert.equal(unitKind('ml'), 'ml');
  assert.equal(unitKind('muỗng canh'), 'spoon');
  assert.equal(unitKind('củ'), 'count');
  assert.equal(unitKind(''), 'count');
});

test('nút + và - đi theo bước hợp lý cho từng đơn vị', () => {
  assert.equal(stepQty('500g', 1), '550 g');
  assert.equal(stepQty('500g', -1), '450 g');
  assert.equal(stepQty('90 g', 1), '100 g');   // dưới 100 g bước 10, từ 100 g bước 50
  assert.equal(stepQty('100 g', -1), '50 g');
  assert.equal(stepQty('1 kg', 1), '1,25 kg');
  assert.equal(stepQty('2 kg', 1), '2,5 kg');
  assert.equal(stepQty('3 củ', 1), '4 củ');
  assert.equal(stepQty('1 muỗng', 1), '1,5 muỗng');
  assert.equal(stepQty('250 ml', -1), '200 ml');
});

test('không bao giờ giảm xuống 0 hoặc số âm', () => {
  assert.equal(stepQty('10 g', -1), '10 g');
  assert.equal(stepQty('1 củ', -1), '1 củ');
  assert.equal(stepQty('0,25 kg', -1), '0,25 kg');
});

test('ô trống: bấm + cho "1", bấm - giữ nguyên; chữ tự do không chỉnh được', () => {
  assert.equal(stepQty('', 1), '1');
  assert.equal(stepQty('', -1), '');
  assert.equal(stepQty('một ít', 1), 'một ít');
  assert.equal(canStep(''), true);
  assert.equal(canStep('2 củ'), true);
  assert.equal(canStep('một ít'), false);
});

test('co giãn theo số người ăn và làm tròn gọn', () => {
  assert.equal(scaleQty('500g', 1), '500g'); // tỉ lệ 1 giữ nguyên chuỗi gốc
  assert.equal(scaleQty('500g', 1.5), '750 g');
  assert.equal(scaleQty('500g', 1.25), '630 g');
  assert.equal(scaleQty('60 g', 1.5), '90 g');
  assert.equal(scaleQty('3 củ', 1.25), '4 củ');
  assert.equal(scaleQty('3 củ', 2), '6 củ');
  assert.equal(scaleQty('1 gói', 1.25), '1 gói'); // không bao giờ ra 1,25 gói
  assert.equal(scaleQty('10 củ', 1.25), '13 củ');
  assert.equal(scaleQty('1 gói', 0.5), '1 gói');   // đồ đếm được thì tối thiểu 1
  assert.equal(scaleQty('1 kg', 1.5), '1,5 kg');
  assert.equal(scaleQty('2 muỗng', 0.75), '1,5 muỗng');
  assert.equal(scaleQty('một ít', 3), 'một ít');
  assert.equal(scaleQty('', 3), '');
});

test('co giãn xuống rất nhỏ không bao giờ ra 0', () => {
  assert.equal(scaleQty('5 g', 0.1), '5 g');
  assert.equal(scaleQty('1 củ', 0.1), '1 củ');
  assert.equal(scaleQty('1 muỗng', 0.1), '0,5 muỗng');
});

test('tăng số người rồi giảm lại gần như về số cũ', () => {
  for (const q of ['500 g', '3 củ', '1,5 kg', '2 muỗng', '250 ml']) {
    const up = scaleQty(q, 5 / 4);
    const back = scaleQty(up, 4 / 5);
    assert.equal(back, q, `${q} -> ${up} -> ${back}`);
  }
});
