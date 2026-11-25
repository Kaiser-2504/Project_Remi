'use strict';
/**
 * Dữ liệu cho các trang Next.js /lich và /thong-ke.
 * Đọc người dùng từ cookie phiên, đọc tài liệu trạng thái của họ trong bảng remi.states,
 * rồi tính lịch tháng và thống kê giống hệt giao diện web/js/app.js (dùng chung web/js/stats.js).
 * Các hàm tính toán là hàm thuần, nhận `today` để test được.
 */
const auth = require('./auth');
const Stats = require('../web/js/stats.js');

const TZ_OFFSET_MIN = 7 * 60; // người dùng ở Việt Nam; máy chủ Vercel chạy theo UTC
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** "Hôm nay" theo giờ Việt Nam, trả về Date ở 00:00 giờ máy để dùng với stats.js. */
function todayVN(nowMs = Date.now()) {
  const t = new Date(nowMs + TZ_OFFSET_MIN * 60000);
  return new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/** Người dùng đang đăng nhập (hoặc null) từ giá trị cookie phiên. */
async function userFromCookie(repo, token) {
  if (!token) return null;
  try { return await repo.getSessionUser(auth.sha(token)); } catch { return null; }
}

/** Tài liệu trạng thái đã chuẩn hoá: luôn có tasks, habits, dayNotes. */
async function loadState(repo, userId) {
  const row = await repo.getState(userId);
  const s = (row && row.data) || {};
  const habits = Array.isArray(s.habits) ? s.habits : [];
  habits.forEach((h) => {
    if (!h.log || typeof h.log !== 'object') h.log = {};
    if (!Array.isArray(h.days) || !h.days.length) h.days = [0, 1, 2, 3, 4, 5, 6];
    if (!Array.isArray(h.times) || !h.times.length) h.times = ['07:00'];
  });
  return {
    tasks: Array.isArray(s.tasks) ? s.tasks.filter((t) => t && typeof t.title === 'string') : [],
    habits,
    dayNotes: s.dayNotes && typeof s.dayNotes === 'object' ? s.dayNotes : {},
    updatedAt: row ? row.updatedAt : null,
  };
}

/** Đọc ?thang=YYYY-MM; sai hoặc thiếu thì lấy tháng hiện tại. */
function parseMonth(q, today) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(q || ''));
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 2000 && +m[1] <= 2100) return { y: +m[1], m: +m[2] };
  return { y: today.getFullYear(), m: today.getMonth() + 1 };
}

const shiftMonth = ({ y, m }, d) => {
  const t = new Date(y, m - 1 + d, 1);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`;
};

/** Việc rơi vào ngày `key` (kể cả việc lặp hằng ngày / hằng tuần), sắp theo giờ. Giống projTasks() trong app.js. */
function tasksOn(tasks, key) {
  const wd = new Date(key + 'T00:00:00').getDay();
  const out = [];
  for (const t of tasks) {
    if (!t.when) continue;
    const tk = String(t.when).slice(0, 10);
    const time = String(t.when).slice(11, 16);
    const item = { title: t.title, emoji: t.emoji || '', time, done: !!t.done, repeat: t.repeat || 'none', projected: tk !== key };
    if (tk === key) out.push(item);
    else if (t.repeat && t.repeat !== 'none' && !t.done && key > tk) {
      if (t.repeat === 'daily' || (t.repeat === 'weekly' && new Date(tk + 'T00:00:00').getDay() === wd)) out.push(item);
    }
  }
  return out.sort((a, b) => (a.time < b.time ? -1 : 1));
}

/** Lưới tháng bắt đầu từ Thứ 2, mỗi ô có việc và ghi chú của ngày đó. */
function calendarMonth(state, { y, m }, today) {
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // số ô trống trước ngày 1 (tuần bắt đầu Thứ 2)
  const start = new Date(y, m - 1, 1 - lead);
  const todayKey = Stats.dayKey(today);
  const weeks = [];
  let total = 0, done = 0;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
      const key = Stats.dayKey(d);
      const inMonth = d.getMonth() === m - 1;
      const tasks = inMonth ? tasksOn(state.tasks, key) : [];
      if (inMonth) { total += tasks.length; done += tasks.filter((t) => t.done).length; }
      week.push({ key, day: d.getDate(), inMonth, isToday: key === todayKey, tasks, note: inMonth ? String(state.dayNotes[key] || '').trim() : '' });
    }
    weeks.push(week);
    if (w >= 3 && new Date(start.getFullYear(), start.getMonth(), start.getDate() + (w + 1) * 7).getMonth() !== m - 1) break;
  }
  return {
    title: `Tháng ${m}/${y}`,
    prev: shiftMonth({ y, m }, -1),
    next: shiftMonth({ y, m }, 1),
    weekdays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
    weeks,
    total,
    done,
  };
}

/** Thống kê n ngày gần nhất, cùng công thức với màn Thống kê trong app. */
function statsSummary(state, n, today) {
  const days = n === 30 ? 30 : 7;
  const habits = state.habits;
  const waterOn = (k) => habits.reduce((s, h) => s + (h.portionMl ? (h.log[k] || 0) * h.portionMl : 0), 0);
  const timesOn = (k) => habits.reduce((s, h) => s + (h.portionMl ? 0 : (h.log[k] || 0)), 0);
  const water = Stats.series(days, waterOn, today);
  const acts = Stats.series(days, timesOn, today);

  const rates = habits.filter((h) => !h.once).map((h) => {
    const goal = Math.max(1, (h.times || []).length);
    const logged = Object.keys(h.log).filter((k) => (h.log[k] || 0) > 0).sort();
    if (!logged.length) return null;
    const doneDays = Object.keys(h.log).filter((k) => (h.log[k] || 0) >= goal);
    const since = Math.round((today - new Date(logged[0] + 'T00:00:00')) / 86400000) + 1;
    const r = Stats.completionRate(doneDays, h.days, Math.max(1, Math.min(days, since)), today);
    const streak = Stats.habitStreak(doneDays, h.days, today);
    return { title: h.title || 'Thói quen', emoji: h.emoji || '', ...r, streak: streak.current, longest: streak.longest };
  }).filter((r) => r && r.total > 0);

  const tasksInRange = state.tasks.filter((t) => {
    const k = String(t.when || '').slice(0, 10);
    return k && k >= water[0].key && k <= water[water.length - 1].key;
  });
  const badges = Stats.evaluateBadges(habits, today, { goalOf: (h) => (h.times || []).length });

  return {
    days,
    water: { points: water, total: water.reduce((s, p) => s + p.value, 0), svg: Stats.barChartSvg(water, { label: 'Nước uống mỗi ngày (ml)' }) },
    acts: { points: acts, total: acts.reduce((s, p) => s + p.value, 0), svg: Stats.barChartSvg(acts, { label: 'Số lần làm thói quen mỗi ngày' }) },
    tasks: { total: tasksInRange.length, done: tasksInRange.filter((t) => t.done).length },
    bestStreak: rates.reduce((m, r) => Math.max(m, r.streak), 0),
    rates,
    badges,
    earned: badges.filter((b) => b.earned).length,
  };
}

module.exports = { todayVN, userFromCookie, loadState, parseMonth, tasksOn, calendarMonth, statsSummary, WD };
