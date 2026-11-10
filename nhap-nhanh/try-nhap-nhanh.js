#!/usr/bin/env node
'use strict';
/**
 * THỬ "NHẬP NHANH" TRÊN TERMINAL: gõ một câu như trong ô nhập của Remi, xem Remi hiểu thế nào.
 *
 *   node try-nhap-nhanh.js                          gõ câu liên tục (thoát bằng :quit hoặc Ctrl+C)
 *   node try-nhap-nhanh.js --text "mai 9h họp"      chỉ xử lý một câu
 *   node try-nhap-nhanh.js --text "..." --json      in kết quả thô dạng JSON
 *   node try-nhap-nhanh.js --now 2026-11-04T10:00   cố định "bây giờ" để kết quả lặp lại được
 *
 * Chạy hai bộ hiểu câu CHẠY TRÊN MÁY của Remi (không gọi mạng, không cần khóa AI):
 *   1. bộ luật        code/web/js/local-parse.js
 *   2. mô hình học máy code/web/js/intent-model.js (đọc code/web/data/intent-model.json)
 * LƯU Ý: bản chạy trong app Remi hiện nay hiểu câu bằng AI qua máy chủ (code/server/ai.js). Công cụ này
 * KHÔNG gọi AI đó, nên kết quả là của hai bộ trên máy, không phải đúng thứ app đang dùng.
 */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { createParser, fold } = require('./code/web/js/local-parse.js');
const { createIntentModel } = require('./code/web/js/intent-model.js');

const read = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, 'code', 'web', 'data', p), 'utf8'));
const parser = createParser(read('dishes.json'));
const model = createIntentModel(read('intent-model.json'));

const argv = process.argv.slice(2);
const flag = (k) => argv.includes('--' + k);
const val = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const useColor = process.stdout.isTTY && !flag('no-color') && !process.env.NO_COLOR;
const c = (code, t) => (useColor ? `\x1b[${code}m${t}\x1b[0m` : t);
const pad = (n) => String(n).padStart(2, '0');
const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const NOW = val('now');
const WD = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** Đổi kết quả của bộ luật sang 4 nhãn của mô hình, để so sánh hai bên. */
function ruleLabel(o) {
  if (o.intent === 'habit') return (o.habit && o.habit.ml) || /\bnuoc\b/.test(fold(o.title || '')) ? 'nuoc' : 'habit_khac';
  return o.shopping ? 'di_cho' : 'viec';
}
const LABEL_VN = { nuoc: 'thói quen uống nước', habit_khac: 'thói quen khác', viec: 'việc có giờ', di_cho: 'việc đi chợ nấu ăn' };

function whenText(w) {
  if (!w) return '(không có giờ cụ thể)';
  const d = new Date(w);
  return `${WD[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)} lúc ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function describe(o) {
  const L = [];
  L.push(`    Loại:        ${o.intent === 'habit' ? 'THÓI QUEN (lặp lại)' : 'VIỆC (một thời điểm)'}`);
  L.push(`    Tên:         ${o.emoji ? o.emoji + ' ' : ''}${o.title || '(trống)'}`);
  if (o.intent === 'task') {
    L.push(`    Khi nào:     ${whenText(o.when)}`);
    L.push(`    Nhắc trước:  ${o.leadMinutes || 0} phút   Lặp lại: ${o.repeat || 'none'}`);
    if (o.shopping) L.push(`    Đi chợ:      có, ${o.servings || 4} người, ${(o.checklist || []).length} nguyên liệu` + ((o.checklist || []).length ? ` (${o.checklist.slice(0, 4).map((x) => x.item + (x.qty ? ' ' + x.qty : '')).join(', ')}${o.checklist.length > 4 ? ', ...' : ''})` : ''));
  } else if (o.habit) {
    const h = o.habit;
    L.push(`    Lặp lại:     ${h.recurring ? 'mỗi ngày (hoặc các ngày đã chọn)' : 'chỉ hôm nay'}`);
    if (h.times && h.times.length) L.push(`    Giờ nhắc:    ${h.times.join(', ')}`);
    if (h.spread) L.push(`    Chia đều:    ${h.spread.count} lần, từ ${h.spread.from} đến ${h.spread.to}`);
    if (h.ml) L.push(`    Lượng nước:  ${h.ml} ml`);
  }
  return L.join('\n');
}

function run(text) {
  const now = NOW || toLocal(new Date());
  const o = parser.parse(text, now);
  const p = model.predict(text);
  const rl = ruleLabel(o);
  if (flag('json')) return console.log(JSON.stringify({ text, now, rules: o, model: p }, null, 2));
  console.log('\n' + c(1, `  Câu: "${text}"`) + c(2, `   (bây giờ: ${now.replace('T', ' ')})`));
  console.log(c(36, '  [1] Bộ luật') + c(2, '  web/js/local-parse.js') + ' hiểu là:');
  console.log(describe(o));
  const sure = p.confidence >= 0.6;
  console.log(c(36, '  [2] Mô hình học máy') + c(2, '  web/js/intent-model.js') + ` đoán: ${c(1, p.label)} (${LABEL_VN[p.label]}), tin cậy ${(p.confidence * 100).toFixed(1)}%` + (sure ? '' : c(33, '  <- dưới 60%: Remi nên hỏi lại')));
  const probs = Object.entries(p.probs).sort((a, b) => b[1] - a[1]).map(([l, v]) => `${l} ${(v * 100).toFixed(0)}%`).join('   ');
  console.log(c(2, `      ${probs}`));
  if (rl === p.label) console.log(c(32, `  [3] Hai bên ĐỒNG Ý: ${LABEL_VN[p.label]}.`));
  else console.log(c(33, `  [3] Hai bên KHÁC NHAU: bộ luật ra "${LABEL_VN[rl]}", mô hình ra "${LABEL_VN[p.label]}". Đây là chỗ cần xem lại.`));
}

const text = val('text');
if (text !== undefined) {
  run(text);
} else {
  console.log(c(1, '\n  REMI: THỬ NHẬP NHANH') + '   (gõ một câu rồi Enter; :quit để thoát)');
  console.log(c(2, '  Ví dụ: nhắc tôi uống 2 ly nước mỗi ngày | mai 9h họp nhóm | đi chợ nấu cà ri | uống 1 lít nước chia 4 lần từ 1h-5h'));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '\nNhập câu > ' });
  rl.prompt();
  rl.on('line', (line) => {
    const t = line.trim();
    if (/^(:quit|:q|quit|exit|thoat)$/i.test(t)) { rl.close(); return; }
    if (t) { try { run(t); } catch (e) { console.log('  Lỗi: ' + e.message); } }
    rl.prompt();
  });
  rl.on('close', () => { console.log('\n  Tạm biệt!'); process.exit(0); });
}
