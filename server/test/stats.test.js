const test = require('node:test');
const assert = require('node:assert');
const S = require('../../web/js/stats.js');

// 7/11/2026 là Thứ 7. Lịch dùng số của getDay: 2 = Thứ 3, 4 = Thứ 5, 6 = Thứ 7.
const TODAY = new Date(2026, 10, 7);
const SCHEDULE = [2, 4, 6];

test('thói quen Thứ 3, Thứ 5, Thứ 7: ngày nghỉ không làm đứt chuỗi', () => {
  const r = S.habitStreak(['2026-11-03', '2026-11-05', '2026-11-07'], SCHEDULE, TODAY);
  assert.strictEqual(r.current, 3);
  assert.strictEqual(r.longest, 3);
});

test('bỏ lỡ một ngày trong lịch thì chuỗi đứt', () => {
  const r = S.habitStreak(['2026-11-03', '2026-11-07'], SCHEDULE, TODAY);
  assert.strictEqual(r.current, 1);
});

test('hôm nay chưa làm thì chuỗi chưa đứt', () => {
  const r = S.habitStreak(['2026-11-03', '2026-11-05'], SCHEDULE, TODAY);
  assert.strictEqual(r.current, 2);
});

test('chuỗi ngày liên tiếp bình thường', () => {
  const r = S.computeStreak(['2026-11-05', '2026-11-06', '2026-11-07'], TODAY);
  assert.deepStrictEqual(r, { current: 3, longest: 3 });
});

test('dữ liệu cũ chưa có nhật ký chạy bình thường', () => {
  assert.deepStrictEqual(S.habitStreak([], SCHEDULE, TODAY), { current: 0, longest: 0 });
  assert.strictEqual(S.completionRate([], [], 7, TODAY).pct, 0);
});

test('tỉ lệ hoàn thành chỉ tính ngày trong lịch', () => {
  // 7 ngày gần nhất (1 đến 7/11) có 3 ngày trong lịch: 3/11, 5/11, 7/11
  const r = S.completionRate(['2026-11-03', '2026-11-07'], SCHEDULE, 7, TODAY);
  assert.deepStrictEqual(r, { done: 2, total: 3, pct: 67 });
});
test('series trả đúng n ngày, cũ đến mới', () => {
  const s = S.series(7, (k) => (k === '2026-11-07' ? 5 : 0), TODAY);
  assert.strictEqual(s.length, 7);
  assert.strictEqual(s[0].key, '2026-11-01');
  assert.strictEqual(s[6].key, '2026-11-07');
  assert.strictEqual(s[6].value, 5);
});

test('biểu đồ cột: đủ số cột, không lỗi khi toàn số 0', () => {
  const pts = S.series(7, (k) => (k === '2026-11-06' ? 2000 : k === '2026-11-07' ? 1000 : 0), TODAY);
  const svg = S.barChartSvg(pts, { label: 'Nước uống' });
  assert.ok(svg.startsWith('<svg'));
  assert.strictEqual((svg.match(/class="bar"/g) || []).length, 2);
  const empty = S.barChartSvg(S.series(30, () => 0, TODAY));
  assert.strictEqual((empty.match(/class="bar"/g) || []).length, 0);
});