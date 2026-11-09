'use strict';
/**
 * MỐC SO SÁNH: bộ hiểu câu theo luật hiện có của Remi (web/js/local-parse.js), đổi kết quả của nó sang 4 nhãn.
 *   node remi-ai/tools/rules_baseline.js [remi-ai/data/test_hand.csv]   (cần cả repo Remi, vì dùng web/js/local-parse.js)
 * Mô hình tự huấn luyện chỉ có ý nghĩa nếu so được với mốc này (và với mốc "luôn đoán nhãn phổ biến nhất").
 */
const fs = require('node:fs');
const path = require('node:path');
const { createParser, fold } = require('../../web/js/local-parse.js');

const LABELS = ['di_cho', 'habit_khac', 'nuoc', 'viec'];
const parser = createParser(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', 'dishes.json'), 'utf8')));

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0]) rows.push(row); row = []; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function ruleLabel(o) {
  if (o.intent === 'habit') return (o.habit && o.habit.ml) || /\bnuoc\b/.test(fold(o.title || '')) ? 'nuoc' : 'habit_khac';
  return o.shopping ? 'di_cho' : 'viec';
}

function report(rows, pred) {
  const f1 = [];
  console.log('  nhãn         precision  recall   F1');
  for (const l of LABELS) {
    const tp = rows.filter((r, i) => r.label === l && pred[i] === l).length;
    const fp = rows.filter((r, i) => r.label !== l && pred[i] === l).length;
    const fn = rows.filter((r, i) => r.label === l && pred[i] !== l).length;
    const p = tp + fp ? tp / (tp + fp) : 0, r = tp + fn ? tp / (tp + fn) : 0, f = p + r ? (2 * p * r) / (p + r) : 0;
    f1.push(f);
    console.log(`  ${l.padEnd(12)} ${p.toFixed(3).padStart(8)} ${r.toFixed(3).padStart(8)} ${f.toFixed(3).padStart(6)}`);
  }
  const acc = rows.filter((r, i) => r.label === pred[i]).length / rows.length;
  console.log(`  độ chính xác ${acc.toFixed(3)}   macro-F1 ${(f1.reduce((a, b) => a + b, 0) / f1.length).toFixed(3)}`);
  return acc;
}

if (require.main === module) {
  const file = process.argv[2] || path.join(__dirname, '..', 'data', 'test_hand.csv');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const pred = rows.map((r) => ruleLabel(parser.parse(r.text, '2026-11-04T10:00')));
  console.log(`Bộ luật hiện có của Remi trên ${path.basename(file)} (${rows.length} câu):`);
  report(rows, pred);
  const wrong = rows.map((r, i) => [r, pred[i]]).filter(([r, p]) => r.label !== p);
  console.log(`  ${wrong.length} câu sai, ví dụ:`);
  for (const [r, p] of wrong.slice(0, 12)) console.log(`    - ${JSON.stringify(r.text)}: đúng ${r.label}, bộ luật ra ${p}`);
  const counts = Object.fromEntries(LABELS.map((l) => [l, rows.filter((r) => r.label === l).length]));
  const major = Math.max(...Object.values(counts)) / rows.length;
  console.log(`  Mốc "luôn đoán nhãn phổ biến nhất": ${major.toFixed(3)}`);
}

module.exports = { parseCsv, ruleLabel };
