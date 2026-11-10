'use strict';
/**
 * Đo chất lượng một "engine" (bộ hiểu câu) trên các tập mẫu.
 *   node ml/eval/run.js --engine rules --data ml/data/gold.jsonl [--min 0.9] [--verbose]
 * Một mẫu chỉ tính là ĐÚNG khi mọi trường trong `expect` đều khớp. Sai giờ là sai, không có "gần đúng".
 */
const fs = require('node:fs');
const path = require('node:path');
const { fold } = require('../../web/js/local-parse.js');
const { validateIntent } = require('../schema');

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (a) => [...a].sort();

/** So một kết quả với `expect`; trả về danh sách trường sai. */
function check(out, exp) {
  const bad = [];
  const eq = (k, got, want) => { if (!same(got, want)) bad.push({ field: k, want, got }); };
  if (!out || typeof out !== 'object') return [{ field: 'json', want: 'object', got: out }];
  if ('intent' in exp) eq('intent', out.intent, exp.intent);
  for (const k of ['when', 'repeat', 'leadMinutes', 'shopping', 'servings']) if (k in exp) eq(k, out[k], exp[k]);
  if ('title' in exp && !fold(out.title || '').includes(fold(exp.title))) bad.push({ field: 'title', want: exp.title, got: out.title });
  if (exp.items) {
    const got = (out.checklist || []).map((x) => x.item);
    eq('items', sorted(got), sorted(exp.items));
  }
  if (exp.qty) {
    for (const [name, q] of Object.entries(exp.qty)) {
      const it = (out.checklist || []).find((x) => x.item === name);
      eq('qty:' + name, it && it.qty, q);
    }
  }
  if (exp.habit) {
    const h = out.habit || {}, e = exp.habit;
    if ('recurring' in e) eq('habit.recurring', h.recurring, e.recurring);
    if (e.days) eq('habit.days', sorted(h.days || []), sorted(e.days));
    if (e.times) eq('habit.times', h.times, e.times);
    if (e.spread) eq('habit.spread', h.spread, e.spread);
    if ('ml' in e) eq('habit.ml', h.ml, e.ml);
  }
  return bad;
}

async function evaluate(engine, examples) {
  const res = [];
  for (const ex of examples) {
    let out = null, error = null;
    try { out = await engine.parse({ text: ex.input, now: ex.now }, ex); } catch (e) { error = e.message; }
    const valid = !!out && validateIntent(out).length === 0;
    const bad = error ? [{ field: 'engine', want: 'ok', got: error }] : check(out, ex.expect);
    res.push({ id: ex.id, family: ex.family || '-', input: ex.input, valid, pass: bad.length === 0, bad });
  }
  const rate = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : 0);
  const fam = {};
  for (const r of res) (fam[r.family] = fam[r.family] || []).push(r);
  const fields = {};
  for (const r of res) for (const b of r.bad) fields[b.field.split(':')[0]] = (fields[b.field.split(':')[0]] || 0) + 1;
  return {
    total: res.length,
    pass: rate(res, (r) => r.pass),
    valid: rate(res, (r) => r.valid),
    byFamily: Object.fromEntries(Object.entries(fam).map(([k, v]) => [k, { n: v.length, pass: rate(v, (r) => r.pass) }])),
    errorsByField: fields,
    failures: res.filter((r) => !r.pass),
  };
}

function loadJsonl(p) {
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const pct = (x) => (x * 100).toFixed(1) + '%';

async function main() {
  const args = {};
  const av = process.argv.slice(2);
  for (let i = 0; i < av.length; i++) if (av[i].startsWith('--')) args[av[i].slice(2)] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true;
  const engine = require(path.join('..', 'engines', args.engine || 'rules')).create();
  let failed = false;
  for (const file of String(args.data || 'ml/data/gold.jsonl').split(',')) {
    const rep = await evaluate(engine, loadJsonl(file));
    console.log(`\n== ${engine.name} trên ${file} (${rep.total} mẫu)`);
    console.log(`   đúng hoàn toàn: ${pct(rep.pass)}   JSON hợp lệ: ${pct(rep.valid)}`);
    console.log('   theo nhóm: ' + Object.entries(rep.byFamily).map(([k, v]) => `${k} ${pct(v.pass)} (${v.n})`).join(', '));
    if (Object.keys(rep.errorsByField).length) console.log('   lỗi theo trường: ' + Object.entries(rep.errorsByField).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', '));
    const show = args.verbose ? rep.failures : rep.failures.slice(0, 8);
    for (const f of show) console.log(`   ✗ [${f.id}] "${f.input}"\n       ` + f.bad.map((b) => `${b.field}: cần ${JSON.stringify(b.want)}, ra ${JSON.stringify(b.got)}`).join('\n       '));
    if (!args.verbose && rep.failures.length > 8) console.log(`   … và ${rep.failures.length - 8} mẫu sai khác (thêm --verbose để xem hết)`);
    if (args.min !== undefined && rep.pass < Number(args.min)) { failed = true; console.log(`   ✗ dưới ngưỡng ${args.min}`); }
  }
  if (failed) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { evaluate, check, loadJsonl };
