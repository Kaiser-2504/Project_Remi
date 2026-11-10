'use strict';
/** Kiểm tra chặt một kết quả "ý định" (intent). Trả về danh sách lỗi, rỗng nghĩa là hợp lệ. */
const WHEN_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateIntent(o) {
  const e = [];
  if (!o || typeof o !== 'object' || Array.isArray(o)) return ['không phải object'];
  if (o.intent !== 'task' && o.intent !== 'habit') e.push('intent phải là task hoặc habit');
  if (typeof o.title !== 'string' || !o.title.trim()) e.push('thiếu title');
  if (o.intent === 'task') {
    if (typeof o.when !== 'string' || !WHEN_RE.test(o.when)) e.push('when sai định dạng');
    if (!['none', 'daily', 'weekly'].includes(o.repeat)) e.push('repeat sai');
    if (!Number.isInteger(o.leadMinutes) || o.leadMinutes < 0 || o.leadMinutes > 1440) e.push('leadMinutes sai');
    if (typeof o.shopping !== 'boolean') e.push('shopping phải là boolean');
    if (!Number.isInteger(o.servings) || o.servings < 1 || o.servings > 20) e.push('servings sai');
    if (!Array.isArray(o.checklist)) e.push('checklist phải là mảng');
  }
  if (o.intent === 'habit') {
    const h = o.habit;
    if (!h || typeof h !== 'object') e.push('thiếu habit');
    else {
      if (typeof h.recurring !== 'boolean') e.push('habit.recurring phải là boolean');
      if (!Array.isArray(h.days) || !h.days.length || h.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) e.push('habit.days sai');
      if (!Array.isArray(h.times) || h.times.some((t) => !TIME_RE.test(t))) e.push('habit.times sai');
      if (h.spread) {
        const s = h.spread;
        if (!Number.isInteger(s.count) || s.count < 1 || s.count > 20) e.push('spread.count sai');
        if (!/^(now|wake|\d{2}:\d{2})$/.test(s.from)) e.push('spread.from sai');
        if (!/^(bed|\d{2}:\d{2})$/.test(s.to)) e.push('spread.to sai');
      } else if (!h.times.length) e.push('habit cần times hoặc spread');
    }
  }
  return e;
}

module.exports = { validateIntent };
