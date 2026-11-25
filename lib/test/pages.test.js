'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../pages');
const auth = require('../auth');
const { createFakeRepo } = require('./fake-repo');

const TODAY = new Date(2026, 10, 26); // 26/11/2026, Thứ 5

const STATE = {
  tasks: [
    { title: 'Đi chợ', emoji: '🛒', when: '2026-11-26T17:00', repeat: 'none', done: false },
    { title: 'Học bài', emoji: '📚', when: '2026-11-24T20:00', repeat: 'daily', done: false },
    { title: 'Gym', emoji: '💪', when: '2026-11-02T06:00', repeat: 'weekly', done: false },
    { title: 'Nộp bài', when: '2026-11-20T09:00', repeat: 'none', done: true },
    { title: 'Tháng trước', when: '2026-10-31T09:00', repeat: 'none', done: false },
  ],
  habits: [
    { title: 'Uống nước', emoji: '💧', portionMl: 250, times: ['08:00', '10:00', '14:00', '16:00'], days: [0, 1, 2, 3, 4, 5, 6],
      log: { '2026-11-24': 4, '2026-11-25': 4, '2026-11-26': 2 } },
    { title: 'Đọc sách', emoji: '📖', times: ['21:00'], days: [1, 3, 5], log: { '2026-11-23': 1, '2026-11-25': 1 } },
  ],
  dayNotes: { '2026-11-26': 'Sinh nhật mẹ', '2026-10-30': 'không thuộc tháng 11' },
};

test('todayVN lấy ngày theo giờ Việt Nam, không theo UTC', () => {
  // 18:30 UTC ngày 25 là 01:30 sáng ngày 26 ở Việt Nam
  const d = P.todayVN(Date.UTC(2026, 10, 25, 18, 30));
  assert.equal(d.getDate(), 26);
  assert.equal(d.getHours(), 0);
});

test('parseMonth đọc ?thang= và bỏ qua giá trị sai', () => {
  assert.deepEqual(P.parseMonth('2026-02', TODAY), { y: 2026, m: 2 });
  for (const bad of ['', '2026-13', 'abc', '2026-1', '1800-01', undefined]) assert.deepEqual(P.parseMonth(bad, TODAY), { y: 2026, m: 11 }, String(bad));
});

test('tasksOn gồm việc trong ngày và việc lặp, sắp theo giờ', () => {
  const t = P.tasksOn(STATE.tasks, '2026-11-30'); // Thứ 2, cùng thứ với Gym (02/11)
  assert.deepEqual(t.map((x) => x.title), ['Gym', 'Học bài']);
  assert.ok(t.every((x) => x.projected));
  const d26 = P.tasksOn(STATE.tasks, '2026-11-26');
  assert.deepEqual(d26.map((x) => x.title), ['Đi chợ', 'Học bài']);
  assert.equal(d26[0].projected, false);
  assert.equal(P.tasksOn(STATE.tasks, '2026-11-23').some((x) => x.title === 'Học bài'), false, 'việc lặp không hiện trước ngày bắt đầu');
});

test('calendarMonth: lưới bắt đầu Thứ 2, đủ tuần, có ghi chú và đếm việc', () => {
  const c = P.calendarMonth(STATE, { y: 2026, m: 11 }, TODAY);
  assert.equal(c.title, 'Tháng 11/2026');
  assert.equal(c.prev, '2026-10');
  assert.equal(c.next, '2026-12');
  // 01/11/2026 là Chủ nhật nên ô đầu tiên là Thứ 2, 26/10
  assert.equal(c.weeks[0][0].key, '2026-10-26');
  assert.equal(c.weeks[0][6].key, '2026-11-01');
  assert.ok(c.weeks.every((w) => w.length === 7));
  const all = c.weeks.flat();
  assert.ok(all.filter((d) => d.inMonth).length === 30);
  const d26 = all.find((d) => d.key === '2026-11-26');
  assert.equal(d26.isToday, true);
  assert.equal(d26.note, 'Sinh nhật mẹ');
  assert.equal(all.find((d) => d.key === '2026-10-31').tasks.length, 0, 'ngày ngoài tháng không liệt kê việc');
  assert.ok(c.total > 0 && c.done === 1);
});

test('calendarMonth: tháng 12/2026 chuyển năm đúng', () => {
  const c = P.calendarMonth(STATE, { y: 2026, m: 12 }, TODAY);
  assert.equal(c.next, '2027-01');
  assert.equal(c.prev, '2026-11');
});

test('statsSummary tính nước, số lần, tỉ lệ, chuỗi và huy hiệu', () => {
  const s = P.statsSummary(STATE, 7, TODAY);
  assert.equal(s.days, 7);
  assert.equal(s.water.points.length, 7);
  assert.equal(s.water.total, (4 + 4 + 2) * 250);
  assert.equal(s.acts.total, 2);
  assert.match(s.water.svg, /^<svg/);
  const water = s.rates.find((r) => r.title === 'Uống nước');
  assert.equal(water.done, 2); // 24 và 25 đủ 4 lần, 26 mới 2 lần
  assert.equal(water.streak, 2);
  const read = s.rates.find((r) => r.title === 'Đọc sách');
  assert.equal(read.total, 2); // chỉ tính T2 23/11 và T4 25/11 (từ ngày bắt đầu ghi)
  assert.equal(read.pct, 100);
  assert.equal(s.tasks.total, 3); // 7 ngày 20–26/11: Nộp bài (20), Học bài (24), Đi chợ (26)
  assert.equal(s.tasks.done, 1);
  assert.ok(Array.isArray(s.badges) && s.badges.length > 0);
});

test('statsSummary 30 ngày và dữ liệu rỗng', () => {
  const s = P.statsSummary({ tasks: [], habits: [], dayNotes: {} }, 30, TODAY);
  assert.equal(s.days, 30);
  assert.equal(s.water.total, 0);
  assert.deepEqual(s.rates, []);
  assert.equal(P.statsSummary({ tasks: [], habits: [], dayNotes: {} }, 999, TODAY).days, 7);
});

test('userFromCookie và loadState đọc từ CSDL (repo giả)', async () => {
  const repo = createFakeRepo({ t: Date.now() });
  const u = await repo.createUser({ email: 'a@b.vn', name: 'Xíu', passHash: 'x' });
  const token = auth.newToken();
  await repo.createSession(u.id, auth.sha(token), Date.now() + 60000);
  await repo.saveState(u.id, 0, { tasks: [{ title: 'A', when: '2026-11-26T09:00' }, { bad: 1 }], habits: [{ title: 'H' }] });
  const me = await P.userFromCookie(repo, token);
  assert.equal(me.name, 'Xíu');
  assert.equal(await P.userFromCookie(repo, 'sai'), null);
  assert.equal(await P.userFromCookie(repo, ''), null);
  const st = await P.loadState(repo, u.id);
  assert.equal(st.tasks.length, 1, 'bỏ việc hỏng không có tiêu đề');
  assert.deepEqual(st.habits[0].days, [0, 1, 2, 3, 4, 5, 6]);
  const empty = await P.loadState(repo, 'khong-co');
  assert.deepEqual(empty.tasks, []);
});
