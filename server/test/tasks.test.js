'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { load, render, waves, totals, everything } = require('../../scripts/tasks');
const { plan } = require('../../scripts/create-issues');

const root = path.join(__dirname, '..', '..');
const data = load();
const all = everything(data);

test('mã việc không trùng; chức năng, phụ thuộc đều có thật; không vòng lặp', () => {
  const ids = all.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  const tracks = new Set(data.team.map((m) => m.id));
  for (const t of data.tasks) {
    assert.ok(tracks.has(t.track), t.id + ' thuộc chức năng không tồn tại');
    assert.ok(t.id.startsWith(t.track), t.id + ' phải bắt đầu bằng mã chức năng');
    for (const d of t.depends) assert.ok(data.tasks.some((x) => x.id === d && x.track === t.track), `${t.id} chỉ được phụ thuộc việc cùng chức năng, không có ${d}`);
  }
  for (const t of data.shared) {
    assert.equal(t.track, 'N');
    assert.ok(t.id.startsWith('N'));
    for (const d of t.depends) assert.ok(ids.includes(d), `${t.id} phụ thuộc ${d} không tồn tại`);
  }
  assert.doesNotThrow(() => waves(data)); // vòng lặp sẽ làm đệ quy tràn và ném lỗi
});

test('năm chức năng có tổng điểm bằng nhau', () => {
  assert.equal(data.team.length, 5);
  const pts = Object.values(totals(data)).map((m) => m.points);
  assert.equal(new Set(pts).size, 1, 'điểm các chức năng: ' + pts.join(', '));
});

test('mỗi thành viên phụ trách một chức năng người dùng thấy được, không phải hạ tầng', () => {
  for (const m of data.team) {
    assert.ok(m.feature && m.focus, 'nhóm ' + m.id + ' thiếu tên chức năng');
    const mine = data.tasks.filter((t) => t.track === m.id);
    assert.ok(mine.length >= 4 && mine.length <= 6, `nhóm ${m.id} có ${mine.length} việc`);
    assert.ok(mine.every((t) => t.labels.includes('feature')), `mọi việc của nhóm ${m.id} phải có nhãn feature`);
  }
  const infra = ['ops', 'tooling', 'testing', 'refactor', 'mobile', 'research'];
  for (const t of data.tasks) for (const l of infra) assert.ok(!t.labels.includes(l), `${t.id} mang nhãn hạ tầng ${l}, nên chuyển sang danh sách việc chung`);
});

test('việc có điểm hợp lệ, có việc cần làm và tiêu chí nghiệm thu đủ rõ', () => {
  for (const t of all) {
    assert.ok([1, 2, 3, 5, 8].includes(t.points), t.id + ' điểm ' + t.points);
    assert.ok(t.todo.length >= 2, t.id + ' cần ít nhất 2 việc');
    assert.ok(t.criteria.length >= 2, t.id + ' cần ít nhất 2 tiêu chí nghiệm thu');
    assert.ok(t.context.length > 20, t.id + ' thiếu bối cảnh');
    assert.ok(t.files.length >= 1, t.id + ' cần nêu tệp liên quan');
  }
});

test('mọi tệp được nhắc tới là "hiện có" đều có thật trong repo', () => {
  for (const t of all) for (const f of t.files) assert.ok(fs.existsSync(path.join(root, f)), `${t.id}: không có ${f}`);
});

test('mỗi chức năng có ít nhất một việc không phụ thuộc để bắt đầu ngay', () => {
  for (const m of data.team) assert.ok(data.tasks.some((t) => t.track === m.id && !t.depends.length), 'nhóm ' + m.id);
});

test('docs/TASKS.md khớp với tasks.json (chạy npm run tasks:doc nếu lệch)', () => {
  assert.equal(fs.readFileSync(path.join(root, 'docs', 'TASKS.md'), 'utf8'), render(data));
});

test('kế hoạch tạo issue: đủ lệnh, gán đúng người theo chức năng, việc chung không gán ai', () => {
  const cmds = plan(data, { repo: 'o/r', assign: 'A=an,B=binh,C=chi,D=dung,E=em' });
  const issues = cmds.filter((c) => c[0] === 'issue');
  assert.equal(issues.length, all.length);
  const get = (id) => issues.find((c) => c[3].startsWith(`[${id}]`));
  assert.equal(get('A1')[get('A1').indexOf('--assignee') + 1], 'an');
  assert.equal(get('E3')[get('E3').indexOf('--assignee') + 1], 'em');
  assert.ok(!get('N0').includes('--assignee'));
  assert.match(get('A1')[get('A1').indexOf('--body') + 1], /- \[ \] /);
  assert.match(get('N0')[get('N0').indexOf('--label') + 1], /track:chung/);
});

test('chạy mặc định chỉ in lệnh, không gọi gh', () => {
  const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'create-issues.js')], { env: { ...process.env, PATH: '/nonexistent' }, encoding: 'utf8' });
  assert.match(out, /chưa chạy gì/);
  assert.equal((out.match(/gh issue create/g) || []).length, all.length);
});

test('.gitignore không chặn nhầm web/data và ml/data (lỗi thật đã làm CI đỏ vì thiếu dishes.json)', () => {
  const lines = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
  assert.ok(!lines.includes('data') && !lines.includes('data/'), 'dòng "data/" không có dấu / ở đầu sẽ chặn mọi thư mục tên data; hãy dùng "/data/"');
  assert.ok(lines.includes('/data/'), 'phải vẫn chặn thư mục dữ liệu chạy thật ở gốc repo');
  for (const f of ['web/data/dishes.json', 'ml/data/gold.jsonl', 'ml/data/holdout.jsonl']) assert.ok(fs.existsSync(path.join(root, f)), f);
});
