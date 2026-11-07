'use strict';
/**
 * Bảng việc của nhóm nằm ở docs/tasks.json. Tệp này dựng ra docs/TASKS.md và nội dung issue.
 *   npm run tasks:doc       ghi lại docs/TASKS.md sau khi sửa tasks.json
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'docs', 'tasks.json');
const load = () => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Đợt làm: việc không phụ thuộc ai là đợt 1, việc phụ thuộc thì sau đợt lớn nhất của nó. */
function waves(data) {
  const byId = Object.fromEntries(data.tasks.map((t) => [t.id, t]));
  const memo = {};
  const depth = (id) => {
    if (memo[id]) return memo[id];
    const t = byId[id];
    return (memo[id] = 1 + Math.max(0, ...t.depends.map(depth)));
  };
  const out = {};
  for (const t of data.tasks) (out[depth(t.id)] = out[depth(t.id)] || []).push(t);
  return out;
}

function totals(data) {
  const r = {};
  for (const m of data.team) r[m.id] = { ...m, count: 0, points: 0 };
  for (const t of data.tasks) { r[t.track].count++; r[t.track].points += t.points; }
  return r;
}

function issueBody(t, data) {
  const m = data.team.find((x) => x.id === t.track);
  return [
    `**Nhóm ${t.track}: ${m.name}** | **Điểm: ${t.points}** | Phụ thuộc: ${t.depends.length ? t.depends.join(', ') : 'không'}`,
    '',
    '### Bối cảnh', t.context, '',
    '### Việc cần làm', ...t.todo.map((x) => `- ${x}`), '',
    '### Tiêu chí nghiệm thu', ...t.criteria.map((x) => `- [ ] ${x}`), '',
    '### Tệp liên quan', ...t.files.map((f) => `- \`${f}\``), '',
    'Quy ước làm việc: xem CONTRIBUTING.md. Cần chạy `npm test` và các bộ test trình duyệt liên quan trước khi mở pull request.',
  ].join('\n');
}

function render(data) {
  const tot = totals(data);
  const w = waves(data);
  const L = [];
  L.push('# Bảng việc của nhóm', '');
  L.push('Tệp này được **sinh tự động** từ `docs/tasks.json` bằng `npm run tasks:doc`. Sửa ở `tasks.json`, đừng sửa tay ở đây.', '');
  L.push('Điểm là mức công sức tương đối (1 nhỏ, 2 nhỏ vừa, 3 vừa, 5 lớn), **không phải số ngày**. Năm nhóm có tổng điểm bằng nhau; có test kiểm tra điều này.', '');
  L.push('## Phân công', '', '| Nhóm | Phụ trách | Trọng tâm | Số việc | Tổng điểm |', '|---|---|---|---|---|');
  for (const m of Object.values(tot)) L.push(`| ${m.id} | ${m.name} | ${m.focus} | ${m.count} | ${m.points} |`);
  L.push('', 'Mỗi nhóm giao cho một thành viên. Tên thành viên điền vào bảng dưới khi chốt:', '', '| Nhóm | Thành viên (tài khoản GitHub) |', '|---|---|');
  for (const m of data.team) L.push(`| ${m.id} | |`);
  L.push('', '## Quyết định cần chốt trước khi bắt đầu', '', 'Cả nhóm nên họp một lần để chốt các mục này; nhiều việc bên dưới phụ thuộc vào chúng.', '', '| Mã | Quyết định | Nội dung | Ai chốt |', '|---|---|---|---|');
  for (const d of data.decisions) L.push(`| ${d.id} | ${d.title} | ${d.body} | ${d.owner} |`);
  L.push('', '## Thứ tự làm theo phụ thuộc', '');
  for (const k of Object.keys(w).sort((a, b) => a - b)) {
    L.push(`**Đợt ${k}**${k === '1' ? ' (làm song song được, không phụ thuộc việc khác)' : ''}: ` + w[k].map((t) => `${t.id} (${t.points})`).join(', '), '');
  }
  for (const m of data.team) {
    L.push(`## Nhóm ${m.id}: ${m.name}`, '', `${m.focus}. Tổng ${tot[m.id].points} điểm.`, '');
    for (const t of data.tasks.filter((x) => x.track === m.id)) {
      L.push(`### ${t.id}. ${t.title} (${t.points} điểm)`, '');
      L.push(`Phụ thuộc: ${t.depends.length ? t.depends.join(', ') : 'không'}. Nhãn: ${t.labels.join(', ')}.`, '');
      L.push(`**Bối cảnh.** ${t.context}`, '', '**Việc cần làm**', ...t.todo.map((x) => `- ${x}`), '', '**Tiêu chí nghiệm thu**', ...t.criteria.map((x) => `- [ ] ${x}`), '');
      L.push('**Tệp liên quan:** ' + t.files.map((f) => `\`${f}\``).join(', '), '');
    }
  }
  return L.join('\n') + '\n';
}

if (require.main === module) {
  const out = path.join(__dirname, '..', 'docs', 'TASKS.md');
  fs.writeFileSync(out, render(load()));
  console.log('Đã ghi', out);
}

module.exports = { load, render, waves, totals, issueBody };
