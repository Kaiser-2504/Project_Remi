const test = require('node:test');
const assert = require('node:assert');
const C = require('../../web/js/cal-utils.js');
const T = (h, m = 0) => new Date(2026, 10, 10, h, m).getTime();

test('báo trùng giờ', () => {
  const ev = [{ id: 1, start: T(9), end: T(10) }, { id: 2, start: T(9, 30), end: T(11) }, { id: 3, start: T(11), end: T(12) }];
  const c = C.findConflicts(ev);
  assert.strictEqual(c.length, 1);
  assert.deepStrictEqual(c[0].map((e) => e.id), [1, 2]);
  assert.strictEqual(C.conflictsWith({ id: 9, start: T(10, 30), end: T(11, 30) }, ev).length, 2);
});

test('tìm giờ trống', () => {
  const ev = [{ start: T(9), end: T(10) }, { start: T(12), end: T(13) }];
  const f = C.findFreeSlots(ev, new Date(2026, 10, 10), { fromHour: 8, toHour: 14, minMinutes: 60 });
  assert.deepStrictEqual(f, [{ start: T(8), end: T(9) }, { start: T(10), end: T(12) }, { start: T(13), end: T(14) }]);
});

test('kéo thả giữ độ dài, làm tròn 15 phút', () => {
  const m = C.moveEvent({ id: 1, start: T(9), end: T(10, 30) }, T(14, 7));
  assert.strictEqual(m.start, T(14)); assert.strictEqual(m.end, T(15, 30));
});

test('xuất rồi nhập .ics giữ nguyên dữ liệu (có tiếng Việt, dấu phẩy, xuống dòng)', () => {
  const ev = [
    { id: 'a1', title: 'Họp nhóm, phần D; chốt', start: T(9), end: T(10), description: 'Dòng 1\nDòng 2 ' + 'rất dài '.repeat(20), location: 'Đà Nẵng' },
    { id: 'a2', title: 'Sinh nhật', start: T(0), end: T(0) + 86400000, allDay: true },
  ];
  const ics = C.toICS(ev);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  ics.split('\r\n').forEach((l) => assert.ok(Buffer.byteLength(l) <= 75, 'dòng quá 75 byte'));
  const back = C.parseICS(ics);
  assert.strictEqual(back.length, 2);
  assert.strictEqual(back[0].title, ev[0].title);
  assert.strictEqual(back[0].description, ev[0].description);
  assert.strictEqual(back[0].start, ev[0].start);
  assert.strictEqual(back[1].allDay, true);
});

test('freeGaps dùng được với phút', () => {
  const g = C.freeGaps([[540, 600], [720, 780]], 480, 840, 60);
  assert.deepStrictEqual(g, [{ start: 480, end: 540 }, { start: 600, end: 720 }, { start: 780, end: 840 }]);
  assert.deepStrictEqual(C.freeGaps([[500, 900]], 480, 840, 60), []);
});

test('RRULE, nhắc trước (VALARM), DURATION', () => {
  const ics = C.toICS([{ id: 'x', title: 'Uống thuốc', start: T(8), end: T(8, 30), repeat: 'daily', leadMin: 10 }]);
  assert.ok(ics.includes('RRULE:FREQ=DAILY'));
  assert.ok(ics.includes('TRIGGER:-PT10M'));
  const back = C.parseICS(ics);
  assert.strictEqual(back.length, 1);
  assert.strictEqual(back[0].rrule, 'FREQ=DAILY');
  assert.strictEqual(back[0].title, 'Uống thuốc'); // không bị DESCRIPTION của VALARM ghi đè
  const d = C.parseICS('BEGIN:VEVENT\r\nDTSTART:20261110T090000Z\r\nDURATION:PT1H30M\r\nSUMMARY:A\r\nEND:VEVENT');
  assert.strictEqual(d[0].end - d[0].start, 90 * 60000);
});
