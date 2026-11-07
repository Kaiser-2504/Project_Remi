'use strict';
/**
 * Bảng việc của nhóm nằm ở docs/tasks.json. Tệp này dựng ra docs/TASKS.md và nội dung issue.
 *   npm run tasks:doc       ghi lại docs/TASKS.md sau khi sửa tasks.json
 *
 * Cấu trúc: 5 chức năng (mỗi người một chức năng), cộng danh sách việc chung chưa phân công.
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'docs', 'tasks.json');
const load = () => JSON.parse(fs.readFileSync(file, 'utf8'));
const everything = (data) => data.tasks.concat(data.shared || []);

/** Đợt làm trong từng chức năng: việc không phụ thuộc là đợt 1, việc phụ thuộc thì sau đợt lớn nhất của nó. */
function waves(data) {
  const byId = Object.fromEntries(data.tasks.map((t) => [t.id, t]));
  const memo = {};
  const depth = (id) => {
    if (memo[id]) return memo[id];
    return (memo[id] = 1 + Math.max(0, ...byId[id].depends.map(depth)));
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
  const head = m
    ? `**Chức năng ${t.track}: ${m.feature}** | **Điểm: ${t.points}** | Phụ thuộc: ${t.depends.length ? t.depends.join(', ') : 'không'}`
    : `**Việc chung (chưa phân công, ai rảnh nhận)** | **Điểm: ${t.points}** | Phụ thuộc: ${t.depends.length ? t.depends.join(', ') : 'không'}`;
  return [
    head, '',
    '### Bối cảnh', t.context, '',
    '### Việc cần làm', ...t.todo.map((x) => `- ${x}`), '',
    '### Tiêu chí nghiệm thu', ...t.criteria.map((x) => `- [ ] ${x}`), '',
    '### Tệp liên quan hiện có', ...t.files.map((f) => `- \`${f}\``), '',
    'Quy ước làm việc: xem CONTRIBUTING.md. Chạy `npm test` và các bộ test trình duyệt liên quan trước khi mở pull request.',
  ].join('\n');
}

function taskBlock(L, t) {
  L.push(`### ${t.id}. ${t.title} (${t.points} điểm)`, '');
  L.push(`Phụ thuộc: ${t.depends.length ? t.depends.join(', ') : 'không'}. Nhãn: ${t.labels.join(', ')}.`, '');
  L.push(`**Bối cảnh.** ${t.context}`, '', '**Việc cần làm**', ...t.todo.map((x) => `- ${x}`), '', '**Tiêu chí nghiệm thu**', ...t.criteria.map((x) => `- [ ] ${x}`), '');
  L.push('**Tệp hiện có liên quan:** ' + t.files.map((f) => `\`${f}\``).join(', '), '');
}

function render(data) {
  const tot = totals(data);
  const w = waves(data);
  const L = [];
  L.push('# Bảng việc của nhóm', '');
  L.push('Tệp này được **sinh tự động** từ `docs/tasks.json` bằng `npm run tasks:doc`. Sửa ở `tasks.json`, đừng sửa tay ở đây.', '');
  L.push('**Cách chia:** mỗi thành viên phụ trách trọn **một chức năng mới** của Remi, từ dữ liệu, máy chủ, giao diện tới test và tài liệu. Năm chức năng độc lập với nhau nên làm song song được, ngoài vài chỗ phụ thuộc ghi rõ bên dưới.', '');
  L.push('Điểm là mức công sức tương đối (1 nhỏ, 2 nhỏ vừa, 3 vừa, 5 lớn), **không phải số ngày**. Năm chức năng có tổng điểm bằng nhau; có test kiểm tra điều này.', '');
  L.push('## Phân công', '', '| Nhóm | Chức năng | Gồm | Số việc | Tổng điểm | Thành viên (tài khoản GitHub) |', '|---|---|---|---|---|---|');
  for (const m of Object.values(tot)) L.push(`| ${m.id} | **${m.feature}** | ${m.focus} | ${m.count} | ${m.points} | |`);
  L.push('', 'Điền tên thành viên vào cột cuối khi chốt.', '');
  L.push('## Quyết định cần chốt trước khi bắt đầu', '', 'Cả nhóm nên họp một lần để chốt các mục này.', '', '| Mã | Quyết định | Nội dung | Ai chốt |', '|---|---|---|---|');
  for (const d of data.decisions) L.push(`| ${d.id} | ${d.title} | ${d.body} | ${d.owner} |`);
  L.push('', '## Thứ tự làm trong mỗi chức năng', '');
  for (const k of Object.keys(w).sort((a, b) => a - b)) {
    L.push(`**Đợt ${k}**${k === '1' ? ' (làm ngay được, không phụ thuộc việc khác)' : ''}: ` + w[k].map((t) => `${t.id} (${t.points})`).join(', '), '');
  }
  L.push('Việc đầu của mỗi chức năng đều có giá trị dùng được riêng, nên nếu thiếu thời gian có thể dừng ở giữa chừng mà không bỏ phí.', '');
  for (const m of data.team) {
    L.push(`## Chức năng ${m.id}: ${m.feature}`, '', `${m.focus}. Tổng ${tot[m.id].points} điểm.`, '');
    for (const t of data.tasks.filter((x) => x.track === m.id)) taskBlock(L, t);
  }
  if (data.shared && data.shared.length) {
    L.push('## Việc chung, chưa phân công', '');
    L.push('Đây là các việc nền tảng (hạ tầng, bảo mật, di động, công cụ) không thuộc chức năng nào. **Không tính vào 95 điểm ở trên.** Ai xong phần của mình sớm thì nhận thêm. Riêng **N0** nên làm trước vì nó giảm xung đột khi 5 người cùng sửa một tệp.', '');
    for (const t of data.shared) taskBlock(L, t);
  }
  return L.join('\n') + '\n';
}

if (require.main === module) {
  const out = path.join(__dirname, '..', 'docs', 'TASKS.md');
  fs.writeFileSync(out, render(load()));
  console.log('Đã ghi', out);
}

module.exports = { load, render, waves, totals, issueBody, everything };
