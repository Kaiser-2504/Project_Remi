'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { load, render, waves, totals } = require('../../scripts/tasks');
const { plan } = require('../../scripts/create-issues');

const root = path.join(__dirname, '..', '..');
const data = load();

test('mã việc không trùng, nhóm và phụ thuộc đều có thật, không vòng lặp', () => {
  const ids = data.tasks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  const tracks = new Set(data.team.map((m) => m.id));
  for (const t of data.tasks) {
    assert.ok(tracks.has(t.track), t.id + ' thuộc nhóm không tồn tại');
    assert.ok(t.id.startsWith(t.track), t.id + ' phải bắt đầu bằng mã nhóm');
    for (const d of t.depends) assert.ok(ids.includes(d), `${t.id} phụ thuộc ${d} không tồn tại`);
  }
  assert.doesNotThrow(() => waves(data)); // vòng lặp sẽ làm đệ quy tràn và ném lỗi
});

test('năm nhóm có tổng điểm bằng nhau', () => {
  assert.equal(data.team.length, 5);
  const pts = Object.values(totals(data)).map((m) => m.points);
  assert.equal(new Set(pts).size, 1, 'điểm các nhóm: ' + pts.join(', '));
});

test('việc có điểm hợp lệ, có việc cần làm và tiêu chí nghiệm thu đủ rõ', () => {
  for (const t of data.tasks) {
    assert.ok([1, 2, 3, 5, 8].includes(t.points), t.id + ' điểm ' + t.points);
    assert.ok(t.todo.length >= 2, t.id + ' cần ít nhất 2 việc');
    assert.ok(t.criteria.length >= 2, t.id + ' cần ít nhất 2 tiêu chí nghiệm thu');
    assert.ok(t.context.length > 20, t.id + ' thiếu bối cảnh');
    assert.ok(t.files.length >= 1, t.id + ' cần nêu tệp liên quan');
  }
});

test('mọi tệp được nhắc tới trong bảng việc đều có thật trong repo', () => {
  for (const t of data.tasks) for (const f of t.files) assert.ok(fs.existsSync(path.join(root, f)), `${t.id}: không có ${f}`);
});

test('mỗi nhóm có ít nhất một việc không phụ thuộc để bắt đầu ngay', () => {
  for (const m of data.team) assert.ok(data.tasks.some((t) => t.track === m.id && !t.depends.length), 'nhóm ' + m.id);
});

test('docs/TASKS.md khớp với tasks.json (chạy npm run tasks:doc nếu lệch)', () => {
  assert.equal(fs.readFileSync(path.join(root, 'docs', 'TASKS.md'), 'utf8'), render(data));
});

test('kế hoạch tạo issue: đủ lệnh, gán đúng người theo nhóm, nội dung có tiêu chí nghiệm thu', () => {
  const cmds = plan(data, { repo: 'o/r', assign: 'A=an,B=binh,C=chi,D=dung,E=em' });
  const issues = cmds.filter((c) => c[0] === 'issue');
  assert.equal(issues.length, data.tasks.length);
  const a1 = issues.find((c) => c[3].startsWith('[A1]'));
  assert.equal(a1[a1.indexOf('--assignee') + 1], 'an');
  assert.match(a1[a1.indexOf('--body') + 1], /- \[ \] /);
  const e1 = issues.find((c) => c[3].startsWith('[E1]'));
  assert.equal(e1[e1.indexOf('--assignee') + 1], 'em');
});

test('chạy mặc định chỉ in lệnh, không gọi gh', () => {
  const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'create-issues.js')], { env: { ...process.env, PATH: '/nonexistent' }, encoding: 'utf8' });
  assert.match(out, /chưa chạy gì/);
  assert.equal((out.match(/gh issue create/g) || []).length, data.tasks.length);
});
