'use strict';
/** Định dạng đầu vào/đầu ra dùng cho model tự huấn luyện (prompt ngắn: luật đã nằm trong trọng số). */
const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function weekdayOf(now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(now);
  return WEEKDAYS[new Date(+m[1], +m[2] - 1, +m[3]).getDay()];
}

function buildPrompt({ text, now }) {
  return `Bây giờ: ${weekdayOf(now)}, ${now}\nCâu: ${text}\nJSON:`;
}

/** Đầu ra mong muốn: JSON gọn, thứ tự khoá cố định, bỏ các trường model không cần sinh (assumption, summary, tips). */
function targetOf(o) {
  const t = { intent: o.intent, title: o.title, emoji: o.emoji };
  if (o.intent === 'task') {
    Object.assign(t, { when: o.when, repeat: o.repeat, leadMinutes: o.leadMinutes, shopping: o.shopping, servings: o.servings, checklist: o.checklist });
  } else {
    t.habit = o.habit;
  }
  return JSON.stringify(t);
}

/** Đọc JSON từ chữ model sinh ra (chịu được rác ở đầu/cuối). Trả null nếu không đọc được. */
function parseModelOutput(text) {
  const a = String(text).indexOf('{'), b = String(text).lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try {
    const o = JSON.parse(String(text).slice(a, b + 1));
    // đưa về dạng đầy đủ mà app cần
    return Object.assign({ assumption: '', summary: '', tips: [], checklist: [], habit: null, shopping: false, servings: 4, repeat: 'none', leadMinutes: 0 }, o);
  } catch {
    return null;
  }
}

module.exports = { buildPrompt, targetOf, parseModelOutput, weekdayOf };
