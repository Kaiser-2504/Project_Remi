'use strict';
/** Đổi mẫu sinh ra thành cặp (prompt, completion) để tinh chỉnh.
 *   node ml/train/prepare.js --in ml/data/synth-train.jsonl --out ml/data/train.jsonl */
const fs = require('node:fs');
const { buildPrompt, targetOf } = require('../format');

const av = process.argv.slice(2);
const arg = (k, d) => { const i = av.indexOf('--' + k); return i >= 0 ? av[i + 1] : d; };
const src = arg('in', 'ml/data/synth-train.jsonl'), dst = arg('out', 'ml/data/train.jsonl');

const rows = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const out = rows.map((r) => JSON.stringify({ prompt: buildPrompt({ text: r.input, now: r.now }), completion: ' ' + targetOf(r.output) }));
fs.writeFileSync(dst, out.join('\n') + '\n');
console.log(`Đã tạo ${out.length} cặp huấn luyện → ${dst}`);
