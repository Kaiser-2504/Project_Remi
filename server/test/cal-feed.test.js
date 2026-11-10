const test = require('node:test');
const assert = require('node:assert');
const { buildFeed, taskEvents } = require('../cal-feed.js');

const state = {
  tasks: [
    { id: 'a', title: 'Họp', emoji: '👥', when: '2026-11-10T21:00', durMin: 60, repeat: 'none', leadMin: 10 },
    { id: 'b', title: 'Uống thuốc', emoji: '💊', when: '2026-11-10T08:00', repeat: 'daily' },
    { id: 'c', title: 'Đã xong', when: '2026-11-10T09:00', repeat: 'none', done: true },
    { id: 'd', title: 'Không giờ' },
    { id: 'e', title: 'Giờ hỏng', when: 'hôm qua' },
  ],
};

test('chỉ lấy việc có giờ hợp lệ và chưa xong; việc lặp luôn được lấy', () => {
  assert.deepStrictEqual(taskEvents(state).map((e) => e.id), ['a', 'b']);
});

test('giờ ghi ra đúng số giờ người dùng đặt, không lệch theo múi giờ máy chủ', () => {
  const ics = buildFeed(state, { now: Date.UTC(2026, 10, 1) });
  assert.ok(ics.includes('DTSTART:20261110T210000\r\n'), 'phải là giờ treo, không có Z');
  assert.ok(ics.includes('DTEND:20261110T220000\r\n'));
  assert.ok(ics.includes('RRULE:FREQ=DAILY'));
  assert.ok(ics.includes('TRIGGER:-PT10M'));
  assert.ok(!ics.includes('Đã xong'));
});

test('dữ liệu rỗng hoặc hỏng không làm lỗi', () => {
  assert.ok(buildFeed(null).startsWith('BEGIN:VCALENDAR'));
  assert.ok(buildFeed({ tasks: 'x' }).includes('END:VCALENDAR'));
});
