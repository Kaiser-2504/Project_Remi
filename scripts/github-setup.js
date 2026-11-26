'use strict';
/**
 * Tạo milestone, nhãn và issue trên GitHub từ scripts/github-plan.json (dùng `gh api`, REST).
 *
 *   node scripts/github-setup.js            xem trước, không tạo gì
 *   node scripts/github-setup.js --run      tạo thật
 *
 * Cần `gh auth login`. Chạy lại không bị trùng: milestone, nhãn, issue đã có thì bỏ qua.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const plan = require(path.join(__dirname, 'github-plan.json'));

const RUN = process.argv.includes('--run');
const REPO = 'repos/{owner}/{repo}';
const api = (args) => JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' }) || 'null');

function issueBody(t) {
  return [
    `**Mục rubric:** ${t.rubric}`,
    '',
    '## Việc cần làm',
    t.todo,
    '',
    '## Tiêu chí nghiệm thu',
    ...t.criteria.map((c) => `- [ ] ${c}`),
    '',
    `Nhánh: \`${t.id}-...\`. Commit ghi \`(#số-issue)\`, PR ghi \`Closes #số-issue\`.`,
  ].join('\n');
}

function main() {
  if (!RUN) {
    for (const m of plan.milestones) console.log(`milestone  ${m.title}  (hạn ${m.due})`);
    for (const t of plan.tasks) console.log(`issue      [${t.id}] ${t.title}  → ${t.milestone}  ${t.labels.join(',')}`);
    console.log('\nChưa tạo gì. Thêm --run để tạo thật.');
    return;
  }
  const ms = Object.fromEntries(api([`${REPO}/milestones?state=all&per_page=100`]).map((m) => [m.title, m.number]));
  for (const m of plan.milestones) {
    if (ms[m.title]) continue;
    ms[m.title] = api(['-X', 'POST', `${REPO}/milestones`, '-f', `title=${m.title}`, '-f', `due_on=${m.due}T23:59:00Z`, '-f', `description=${m.description}`]).number;
    console.log('+ milestone', m.title);
  }
  const haveLabels = new Set(api([`${REPO}/labels?per_page=100`]).map((l) => l.name));
  for (const l of new Set(plan.tasks.flatMap((t) => t.labels))) {
    if (haveLabels.has(l)) continue;
    api(['-X', 'POST', `${REPO}/labels`, '-f', `name=${l}`, '-f', 'color=C5DEF5']);
    console.log('+ nhãn', l);
  }
  const haveIssues = new Set(api([`${REPO}/issues?state=all&per_page=100`]).map((i) => i.title));
  for (const t of plan.tasks) {
    const title = `[${t.id}] ${t.title}`;
    if (haveIssues.has(title)) continue;
    const ms4 = plan.milestones.find((m) => m.key === t.milestone).title;
    const args = ['-X', 'POST', `${REPO}/issues`, '-f', `title=${title}`, '-f', `body=${issueBody(t)}`, '-F', `milestone=${ms[ms4]}`];
    for (const l of t.labels) args.push('-f', 'labels[]=' + l);
    if (t.assignee) args.push('-f', 'assignees[]=' + t.assignee);
    const res = api(args);
    console.log(`+ #${res.number} ${title}`);
  }
}

if (require.main === module) main();
module.exports = { issueBody };
