'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generate } = require('../../ml/gen/generate');
const { evaluate, check, loadJsonl } = require('../../ml/eval/run');
const { validateIntent } = require('../../ml/schema');
const { buildPrompt, targetOf, parseModelOutput } = require('../../ml/format');
const { createParser } = require('../../web/js/local-parse');
const Q = require('../../web/js/qty');
const dishes = require('../../web/data/dishes.json');

const root = path.join(__dirname, '..', '..');
const rules = { name: 'rules', parse: (() => { const p = createParser(dishes); return ({ text, now }) => p.parse(text, now); })() };

test('bộ sinh dữ liệu cho kết quả giống hệt khi cùng seed, khác khi khác seed', () => {
  assert.deepEqual(generate(200, 5), generate(200, 5));
  assert.notDeepEqual(generate(50, 5).map((x) => x.input), generate(50, 6).map((x) => x.input));
});

test('mọi nhãn sinh ra đều hợp lệ và giờ nhắc nằm sau lúc nói', () => {
  for (const r of generate(1500, 9)) {
    const full = Object.assign({ assumption: '', summary: '', tips: [] }, r.output);
    assert.deepEqual(validateIntent(full), [], r.input);
    if (r.output.intent === 'task') assert.ok(new Date(r.output.when) > new Date(r.now), `${r.input}: ${r.output.when} không sau ${r.now}`);
  }
});

test('công cụ đánh giá: đáp án đúng ra 100%, không trả gì ra 0%', async () => {
  const rows = generate(300, 4);
  const good = await evaluate({ parse: (_i, ex) => ex.output }, rows);
  const none = await evaluate({ parse: () => ({}) }, rows);
  assert.equal(good.pass, 1);
  assert.equal(none.pass, 0);
  assert.equal(none.valid, 0);
});

test('công cụ đánh giá: sai giờ một phút vẫn là sai', () => {
  const exp = { intent: 'task', when: '2026-11-05T09:30' };
  assert.deepEqual(check({ intent: 'task', when: '2026-11-05T09:30' }, exp), []);
  assert.equal(check({ intent: 'task', when: '2026-11-05T09:31' }, exp).length, 1);
});

test('bộ hiểu câu trên máy đạt ngưỡng trên các bộ câu viết tay (chặn hồi quy)', async () => {
  for (const f of ['gold', 'holdout']) {
    const rep = await evaluate(rules, loadJsonl(path.join(root, 'ml', 'data', f + '.jsonl')));
    assert.ok(rep.pass >= 0.95, `${f}: ${rep.pass}\n` + JSON.stringify(rep.failures.slice(0, 3), null, 1));
    assert.equal(rep.valid, 1);
  }
});

test('bộ hiểu câu trên máy đạt ngưỡng trên dữ liệu sinh với seed chưa từng dùng', async () => {
  const rep = await evaluate(rules, generate(2000, 777));
  assert.ok(rep.pass >= 0.98, String(rep.pass));
});

test('bộ hiểu câu trên máy không có đường ra mạng (yêu cầu dữ liệu không rời máy)', () => {
  for (const f of ['web/js/local-parse.js', 'web/js/qty.js']) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|require\(['"](?:node:)?(?:http|https|net|dgram|child_process)['"]\)/, f);
  }
});

test('kho món ăn: mọi định lượng đều đọc được và tên không trùng', () => {
  const names = new Set();
  for (const d of dishes) {
    for (const k of [d.name].concat(d.aliases || [])) { assert.ok(!names.has(k), 'trùng tên: ' + k); names.add(k); }
    assert.ok(d.items.length >= 4, d.name);
    for (const it of d.items) assert.ok(Q.parseQty(it.qty), `${d.name}: "${it.qty}"`);
  }
});

test('định dạng cho model: đầu ra chuẩn đọc lại được nguyên vẹn', () => {
  for (const r of generate(200, 21)) {
    const back = parseModelOutput(targetOf(r.output));
    for (const k of Object.keys(JSON.parse(targetOf(r.output)))) assert.deepEqual(back[k], r.output[k], `${r.input} ${k}`);
    assert.match(buildPrompt({ text: r.input, now: r.now }), /JSON:$/);
  }
  assert.equal(parseModelOutput('không có json'), null);
  assert.deepEqual(parseModelOutput('rác {"intent":"task","title":"A"} rác').intent, 'task');
});
