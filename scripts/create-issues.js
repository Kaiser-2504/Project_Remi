'use strict';
/**
 * Tạo nhãn và issue trên GitHub từ docs/tasks.json bằng GitHub CLI (gh).
 *
 *   node scripts/create-issues.js                       chỉ in ra các lệnh sẽ chạy (mặc định, an toàn)
 *   node scripts/create-issues.js --run                 chạy thật trong repo hiện tại
 *   node scripts/create-issues.js --run --repo owner/ten --assign A=an,B=binh,C=chi,D=dung,E=em
 *
 * Cần cài gh và đã chạy `gh auth login`. Chạy hai lần sẽ tạo issue trùng, nên chỉ chạy thật một lần.
 */
const { execFileSync } = require('node:child_process');
const { load, issueBody } = require('./tasks');

const av = process.argv.slice(2);
const flag = (k) => av.includes('--' + k);
const val = (k) => { const i = av.indexOf('--' + k); return i >= 0 ? av[i + 1] : undefined; };

function plan(data, { repo, assign } = {}) {
  const owner = Object.fromEntries(String(assign || '').split(',').filter(Boolean).map((p) => p.split('=')));
  const base = repo ? ['--repo', repo] : [];
  const cmds = [];
  const colors = { A: '1D76DB', B: '0E8A16', C: '5319E7', D: 'FBCA04', E: 'D93F0B' };
  for (const m of data.team) cmds.push(['label', 'create', `track:${m.id}`, '--description', `${m.name}`, '--color', colors[m.id], '--force', ...base]);
  for (const p of [...new Set(data.tasks.map((t) => t.points))]) cmds.push(['label', 'create', `points:${p}`, '--color', 'C5DEF5', '--force', ...base]);
  for (const l of [...new Set(data.tasks.flatMap((t) => t.labels))]) cmds.push(['label', 'create', l, '--color', 'EDEDED', '--force', ...base]);
  for (const t of data.tasks) {
    const c = ['issue', 'create', '--title', `[${t.id}] ${t.title}`, '--body', issueBody(t, data),
      '--label', [`track:${t.track}`, `points:${t.points}`, ...t.labels].join(','), ...base];
    if (owner[t.track]) c.push('--assignee', owner[t.track]);
    cmds.push(c);
  }
  return cmds;
}

function main() {
  const cmds = plan(load(), { repo: val('repo'), assign: val('assign') });
  if (!flag('run')) {
    for (const c of cmds) console.log('gh ' + c.map((x) => (/[\s"'\n]/.test(x) ? JSON.stringify(x.length > 70 ? x.slice(0, 70) + '…' : x) : x)).join(' '));
    console.log(`\n(${cmds.length} lệnh, chưa chạy gì. Thêm --run để tạo thật.)`);
    return;
  }
  for (const c of cmds) {
    execFileSync('gh', c, { stdio: 'inherit' });
  }
  console.log('Xong.');
}

if (require.main === module) main();
module.exports = { plan };
