'use strict';
/**
 * Kiểm thử tính năng mới trên bản full stack: chia lượng nước và bộ chọn ngày giờ,
 * kèm việc dữ liệu và lịch nhắc có lên máy chủ đúng không.
 *   npm run test:features
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const dk = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

(async () => {
  const cfg = loadConfig({}, { dataDir: ':memory:', host: '127.0.0.1', webDir: path.join(__dirname, '..', 'web'), secureCookies: false });
  const app = createApp(cfg, { log: { warn() {}, error: console.error, log() {} } });
  const addr = await app.listen(0, '127.0.0.1');
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'], headless: 'new' });
  const errors = [];
  const ok = (m) => console.log('  ✓', m);
  try {
    const pg = await (await browser.createBrowserContext()).newPage();
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.setViewport({ width: 390, height: 844 });
    await pg.goto('http://127.0.0.1:' + addr.port);
    await pg.waitForSelector('#a-sw');
    await pg.click('#a-sw');
    await pg.waitForSelector('#a-name');
    await pg.type('#a-name', 'Xíu');
    await pg.type('#a-email', 'x@e.co');
    await pg.type('#a-pw', 'matkhau-dai-123');
    await pg.click('#a-go');
    await pg.waitForFunction(() => document.querySelector('#welcome').hidden);
    await sleep(500);

    const sheetReady = () => pg.waitForFunction(() => {
      const sh = document.querySelector('#sheet');
      return document.body.classList.contains('sheet-open') &&
        !document.getAnimations().some((a) => a.effect && a.effect.target && (a.effect.target === sh || sh.contains(a.effect.target)));
    });
    const closed = () => pg.waitForFunction(() => !document.body.classList.contains('sheet-open'));
    const tile = async (kind) => {
      await pg.$$eval('.alert .x', (xs) => xs.forEach((x) => x.click()));
      await pg.evaluate((k) => { document.querySelector('nav.tabs button[data-tab="today"]').click(); document.querySelector(`[data-new="${k}"]`).click(); }, kind);
      await sheetReady();
    };
    const api = (p) => pg.evaluate(async (u) => (await fetch(u, { headers: { 'X-Remi': '1' } })).json(), p);

    console.log('1. Chia lượng nước: 1 lít, 4 lần, từ 13:00 đến 17:00');
    await tile('habit');
    assert.equal(await pg.$eval('#wt-on', (e) => e.checked), false);
    await pg.click('#wt-on');
    await pg.click('#wt-pre [data-v="1000"]');
    await pg.click('#wt-mode [data-v="window"]');
    assert.equal(await pg.$eval('#wt-count', (e) => e.textContent), '4');
    const sum = await pg.$eval('#wt-sum', (e) => e.textContent);
    assert.match(sum, /Mỗi lần 250 ml/);
    assert.match(sum, /13:00, 14:20, 15:40, 17:00/);
    ok('mỗi lần 250 ml: ' + sum);
    await pg.click('#hf-seg [data-o="0"]');            // lặp lại mỗi ngày để lịch nhắc luôn có giờ trong 48 giờ tới
    await pg.type('#f-title', ' uống nước');
    await pg.click('#s-ok');
    await closed();
    await sleep(2800);
    const st = await api('/api/state');
    const hb = st.state.habits[0];
    assert.equal(hb.portionMl, 250);
    assert.deepEqual(hb.times, ['13:00', '14:20', '15:40', '17:00']);
    assert.equal(hb.once, undefined);
    const rows = app.db.prepare("SELECT title, body FROM reminders WHERE key LIKE 'h:%' ORDER BY fire_at").all();
    assert.ok(rows.length >= 4, 'phải có lịch nhắc uống nước: ' + rows.length);
    assert.ok(rows.every((r) => /^Uống 250 ml/.test(r.body)), 'nội dung nhắc phải ghi lượng nước: ' + JSON.stringify(rows[0]));
    assert.ok(rows.some((r) => /Xíu/.test(r.title)));
    ok(`lưu lên máy chủ, ${rows.length} lời nhắc, mẫu: "${rows[0].title}" / "${rows[0].body}"`);
    await pg.evaluate(() => document.querySelector('nav.tabs button[data-tab="today"]').click());
    await sleep(200);
    const status = await pg.$eval('#today-habits .hcard p', (e) => e.textContent);
    assert.equal(status, '0 / 1000 ml hôm nay');
    assert.equal(await pg.$eval('#today-habits .hcard .hbtns button', (e) => e.textContent), 'Uống 250 ml');
    ok('thẻ thói quen: "0 / 1000 ml hôm nay" và nút "Uống 250 ml"');

    console.log('2. Bộ chọn ngày giờ');
    await tile('reminder');
    await pg.click('#f-days [data-v="' + dk(1) + '"]');
    await pg.click('#f-pre [data-v="19:00"]');
    await pg.click('#f-step [data-d="5"]');
    assert.equal((await pg.$eval('#f-when', (e) => e.value)), dk(1) + 'T19:05');
    assert.match(await pg.$eval('#f-step [data-w]', (e) => e.textContent), /7 giờ 5 tối/);
    await pg.click('#f-leadc [data-v="60"]');
    await pg.click('#f-repc [data-v="daily"]');
    await pg.type('#f-title', 'Gọi cho khách');
    await pg.click('#s-ok');
    await closed();
    await sleep(2800);
    const t = (await api('/api/state')).state.tasks.find((x) => /Gọi cho khách/.test(x.title));
    assert.equal(t.when, dk(1) + 'T19:05');
    assert.equal(t.leadMin, 60);
    assert.equal(t.repeat, 'daily');
    ok(`việc lưu đúng: ${t.when}, nhắc trước ${t.leadMin} phút, lặp ${t.repeat}`);

    assert.deepEqual(errors, [], errors.join('; '));
    console.log('\nTẤT CẢ ĐỀU QUA');
  } catch (e) {
    console.error('\nTHẤT BẠI:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await app.close();
  }
})();
