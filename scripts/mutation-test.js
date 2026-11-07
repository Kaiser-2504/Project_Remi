'use strict';
/**
 * Kiểm thử đột biến (mutation testing) cỡ nhỏ, không cần thư viện ngoài.
 * Lần lượt "làm hỏng" mã một chút (đổi < thành <=, && thành ||, true thành false, đổi số...),
 * chạy bộ test và xem test có đỏ không. Đột biến "sống sót" nghĩa là có chỗ sai mà test không bắt được.
 *
 *   node scripts/mutation-test.js web/js/kitchen.js server/test/kitchen.test.js
 *   node scripts/mutation-test.js web/js/kitchen.js server/test/kitchen.test.js --max 80
 *
 * Mã gốc luôn được khôi phục, kể cả khi bấm Ctrl+C.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const [file, testFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const maxArg = process.argv.indexOf('--max');
const MAX = maxArg > 0 ? Number(process.argv[maxArg + 1]) : Infinity;
if (!file || !testFile) {
  console.error('Cách dùng: node scripts/mutation-test.js <file mã> <file test> [--max N]');
  process.exit(2);
}
const src = fs.readFileSync(file, 'utf8');
const restore = () => fs.writeFileSync(file, src);
process.on('SIGINT', () => { restore(); process.exit(130); });

const RULES = [
  [/<=/g, '<'], [/>=/g, '>'], [/(?<![<=!>])<(?![=<])/g, '<='], [/(?<![=!<>-])>(?![=>])/g, '>='],
  [/===/g, '!=='], [/!==/g, '==='], [/&&/g, '||'], [/\|\|/g, '&&'],
  [/\btrue\b/g, 'false'], [/\bfalse\b/g, 'true'],
  [/(?<=[\s(])-(?=\d)/g, ''], [/\b1000\b/g, '100'], [/\b(\d+)\b(?=\s*\*\s*\d)/g, (m) => String(Number(m) + 1)],
  [/\+ 1\b/g, '- 1'], [/- 1\b/g, '+ 1'], [/Math\.ceil/g, 'Math.round'], [/Math\.max/g, 'Math.min'], [/Math\.min/g, 'Math.max'],
];

// Bỏ qua dòng chú thích để không đếm đột biến vô nghĩa.
const lines = src.split('\n');
const offsets = [];
let pos = 0;
for (const l of lines) { offsets.push([pos, /^\s*(\/\/|\/\*|\*)/.test(l)]); pos += l.length + 1; }
const isComment = (i) => { let c = false; for (const [o, cm] of offsets) { if (o > i) break; c = cm; } return c; };

const mutants = [];
for (const [re, rep] of RULES) {
  for (const m of src.matchAll(re)) {
    if (isComment(m.index)) continue;
    const r = typeof rep === 'function' ? rep(m[0]) : rep;
    mutants.push({ at: m.index, from: m[0], to: r });
  }
}
const pick = mutants.length > MAX ? mutants.filter((_, i) => i % Math.ceil(mutants.length / MAX) === 0) : mutants;

const run = () => spawnSync(process.execPath, ['--test', '--test-reporter=dot', testFile], { encoding: 'utf8', timeout: 60000 }).status;
if (run() !== 0) { console.error('Bộ test đang đỏ với mã gốc, sửa trước đã.'); process.exit(2); }

let killed = 0;
const survived = [];
try {
  pick.forEach((m, i) => {
    fs.writeFileSync(file, src.slice(0, m.at) + m.to + src.slice(m.at + m.from.length));
    const status = run();
    if (status !== 0) killed++;
    else {
      const line = src.slice(0, m.at).split('\n').length;
      survived.push(`${path.basename(file)}:${line}  ${m.from} -> ${m.to}  | ${lines[line - 1].trim().slice(0, 90)}`);
    }
    process.stdout.write(status !== 0 ? '.' : 'S');
    if ((i + 1) % 60 === 0) process.stdout.write('\n');
  });
} finally { restore(); }

const pct = pick.length ? Math.round((killed / pick.length) * 100) : 100;
console.log(`\n\nĐột biến: ${pick.length}, bị test bắt: ${killed}, sống sót: ${survived.length} (điểm ${pct}%)`);
if (survived.length) console.log('Sống sót:\n  ' + survived.join('\n  '));
