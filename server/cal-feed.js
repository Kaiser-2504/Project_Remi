'use strict';
/* Nhóm D: tạo file lịch .ics từ dữ liệu (state) của một người dùng, dùng cho đường dẫn thuê bao. */
const { toICS } = require('../web/js/cal-utils.js');

const WHEN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const durOf = (t) => Math.max(15, Math.min(720, Number(t.durMin) || 30));

/** Việc -> sự kiện. `when` là giờ địa phương không kèm múi giờ nên dựng bằng Date.UTC và ghi ra dạng "giờ treo" (floating). */
function taskEvents(state) {
  const tasks = state && Array.isArray(state.tasks) ? state.tasks : [];
  const out = [];
  for (const t of tasks) {
    if (!t || typeof t.when !== 'string') continue;
    const m = WHEN.exec(t.when);
    if (!m) continue;
    if (t.done && (!t.repeat || t.repeat === 'none')) continue;
    const start = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    const list = Array.isArray(t.checklist) ? t.checklist : [];
    const desc = [
      typeof t.note === 'string' ? t.note : '',
      list.length ? 'Cần chuẩn bị: ' + list.map((x) => String(x.item || '') + (x.qty ? ' (' + x.qty + ')' : '')).join(', ') : '',
    ].filter(Boolean).join('\n');
    out.push({
      id: String(t.id), title: (t.emoji ? t.emoji + ' ' : '') + String(t.title || 'Việc'),
      start, end: start + durOf(t) * 60000, floating: true,
      repeat: t.repeat === 'daily' || t.repeat === 'weekly' ? t.repeat : 'none',
      leadMin: Number(t.leadMin) || 0, description: desc.slice(0, 2000),
    });
    if (out.length >= 2000) break;
  }
  return out;
}

function buildFeed(state, opts = {}) {
  return toICS(taskEvents(state), { name: 'Remi', ...opts });
}

module.exports = { taskEvents, buildFeed };
