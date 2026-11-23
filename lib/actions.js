'use strict';
/**
 * Nút hành động trên thông báo đẩy.
 * Chỉ lời nhắc ĐẾN GIỜ của việc (t:<id>:<iso>:due), của thói quen (h:...) và bản nhắc lại (z:...) mới có nút.
 * Nhắc trước ("lead"), hạn dùng đồ, gọi dậy thì không có.
 */
const SNOOZE_MIN = 10;

/** Bỏ tiền tố "z:" của bản nhắc lại để luôn trỏ về lời nhắc gốc. */
function baseKey(key) {
  let k = String(key || '');
  while (k.startsWith('z:')) k = k.slice(2);
  return k;
}

function actionsFor(key) {
  const k = baseKey(key);
  const task = k.startsWith('t:') && k.endsWith(':due');
  const habit = k.startsWith('h:');
  if (!task && !habit) return [];
  return [
    { action: 'done', title: '✓ Xong' },
    { action: 'snooze', title: `⏰ Nhắc lại sau ${SNOOZE_MIN} phút` },
  ];
}

module.exports = { SNOOZE_MIN, baseKey, actionsFor };
