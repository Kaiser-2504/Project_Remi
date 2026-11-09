'use strict';
/**
 * Kiểm tra bố cục thích ứng: không tràn ngang, đúng dạng điều hướng và số cột ở từng cỡ màn hình,
 * cửa sổ chi tiết hiện giữa (máy tính) hoặc trượt từ dưới (điện thoại).
 *   npm run test:responsive
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = [
  { name: 'máy tính 1440x900', w: 1440, h: 900, kind: 'sidebar', cols: 2 },
  { name: 'laptop 1280x720', w: 1280, h: 720, kind: 'sidebar', cols: 2 },
  { name: 'tablet ngang 1024x768', w: 1024, h: 768, kind: 'rail', cols: 2 },
  { name: 'tablet dọc 768x1024', w: 768, h: 1024, kind: 'bottom', cols: 1 },
  { name: 'điện thoại 390x844', w: 390, h: 844, kind: 'bottom', cols: 1 },
  { name: 'điện thoại ngang 844x390', w: 844, h: 390, kind: 'rail', cols: 2 },
  { name: 'điện thoại nhỏ 320x568', w: 320, h: 568, kind: 'bottom', cols: 1 },
];

(async () => {
  const cfg = loadConfig({}, { dataDir: ':memory:', host: '127.0.0.1', webDir: path.join(__dirname, '..', 'web'), secureCookies: false });
  const app = createApp(cfg, { log: { warn() {}, error: console.error, log() {} } });
  const addr = await app.listen(0, '127.0.0.1');
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'], headless: 'new' });
  const errors = [];
  try {
    const pg = await (await browser.createBrowserContext()).newPage();
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.setViewport({ width: 1440, height: 900 });
    await pg.goto('http://127.0.0.1:' + addr.port);
    await pg.waitForSelector('#a-sw');
    await pg.click('#a-sw');
    await pg.waitForSelector('#a-name');
    await pg.type('#a-name', 'Xíu');
    await pg.type('#a-email', 'x@e.co');
    await pg.type('#a-pw', 'matkhau-dai-123');
    await pg.click('#a-go');
    await pg.waitForFunction(() => document.querySelector('#welcome').hidden);
    await pg.evaluate(() => {
      const p = (n) => String(n).padStart(2, '0');
      const day = (o, h, m) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(h)}:${p(m)}`; };
      const T = (id, t, e, when, x = {}) => Object.assign({ id, title: t, emoji: e, when, leadMin: 0, repeat: 'none', summary: '', checklist: [], tips: [], done: false, u: Date.now() }, x);
      const tasks = [T('a', 'Họp nhóm', '🤝', day(0, 23, 30)), T('b', 'Đi chợ nấu cà ri', '🛒', day(0, 23, 50), { shop: true, servings: 4, checklist: [{ item: 'Thịt gà', qty: '600 g', done: false }] }),
        T('c', 'Đón con', '🚗', day(1, 16, 30)), T('d', 'Khám răng', '🦷', day(2, 9, 0)), T('e', 'Họp phụ huynh', '🏫', day(4, 19, 30))];
      const habits = [{ id: 'w', title: 'Uống nước 2 lít', emoji: '💧', times: ['07:30', '13:30', '19:30'], days: [0, 1, 2, 3, 4, 5, 6], log: {}, u: Date.now() }];
      localStorage.setItem('remi.tasks', JSON.stringify(tasks));
      localStorage.setItem('remi.habits', JSON.stringify(habits));
    });
    await pg.reload();
    await pg.waitForFunction(() => document.querySelector('#welcome').hidden);
    await sleep(600);

    for (const s of SIZES) {
      await pg.setViewport({ width: s.w, height: s.h });
      await sleep(250);
      for (const tab of ['today', 'cal', 'soon', 'habits', 'kitchen']) {
        await pg.evaluate((t) => document.querySelector(`nav.tabs button[data-tab="${t}"]`).click(), tab);
        await sleep(120);
        const m = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        assert.ok(m.sw <= m.iw + 1, `${s.name}, tab ${tab}: tràn ngang ${m.sw} > ${m.iw}`);
      }
      await pg.evaluate(() => document.querySelector('nav.tabs button[data-tab="today"]').click());
      await sleep(150);
      const g = await pg.evaluate(() => {
        const r = (sel) => { const e = document.querySelector(sel); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, bottom: b.bottom, right: b.right }; };
        return { nav: r('nav.tabs'), quick: r('#quick'), comp: r('#composer'), vh: window.innerHeight, vw: window.innerWidth };
      });
      if (s.kind === 'bottom') {
        assert.ok(Math.abs(g.nav.bottom - g.vh) < 2 && g.nav.w >= g.vw - 2, `${s.name}: thanh điều hướng phải nằm dưới cùng`);
      } else {
        assert.ok(g.nav.x < 2 && g.nav.h >= g.vh - 2, `${s.name}: thanh bên phải dính trái và cao hết màn hình`);
        assert.ok(g.nav.w === (s.kind === 'sidebar' ? 260 : 92), `${s.name}: bề rộng thanh bên ${g.nav.w}`);
      }
      if (s.cols === 2) {
        assert.ok(g.quick.x > g.comp.right - 2, `${s.name}: khối tạo nhanh phải nằm bên phải ô nhập`);
        assert.ok(Math.abs(g.quick.y - g.comp.y) < 4, `${s.name}: hai cột phải thẳng hàng ở phía trên (${g.quick.y} và ${g.comp.y})`);
      } else {
        assert.ok(Math.abs(g.quick.x - g.comp.x) < 2, `${s.name}: một cột thì các khối phải thẳng hàng dọc`);
      }
      // cửa sổ chi tiết
      await pg.evaluate(() => { document.querySelector('.task h3').click(); });
      await pg.waitForFunction(() => document.body.classList.contains('sheet-open') && !document.getAnimations().some((a) => a.effect && a.effect.target && (a.effect.target.id === 'sheet')));
      const sh = await pg.evaluate(() => { const b = document.querySelector('#sheet').getBoundingClientRect(); return { cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2, bottom: b.bottom, w: b.width, top: b.top, vh: innerHeight, vw: innerWidth }; });
      if (s.w >= 700) {
        assert.ok(Math.abs(sh.cx - sh.vw / 2) < 3 && Math.abs(sh.cy - sh.vh / 2) < 3 || sh.top <= 30, `${s.name}: cửa sổ phải nằm giữa màn hình`);
        assert.ok(sh.w <= 600 + 1, `${s.name}: cửa sổ không quá 600px`);
      } else {
        assert.ok(Math.abs(sh.bottom - sh.vh) < 2, `${s.name}: trên điện thoại khung trượt từ đáy lên`);
        assert.ok(sh.w <= sh.vw, `${s.name}: khung không rộng hơn màn hình`);
      }
      await pg.keyboard.press('Escape');                                   // phím Esc đóng cửa sổ
      await pg.waitForFunction(() => !document.body.classList.contains('sheet-open'));
      console.log('  ✓', s.name);
    }
    // phím tắt "/" đưa con trỏ vào ô nhập
    await pg.setViewport({ width: 1440, height: 900 });
    await pg.evaluate(() => document.querySelector('nav.tabs button[data-tab="cal"]').click());
    await pg.keyboard.press('/');
    assert.equal(await pg.evaluate(() => document.activeElement.id), 'ta');
    assert.equal(await pg.evaluate(() => document.body.dataset.tab), 'today');
    console.log('  ✓ phím "/" về Hôm nay và chọn ô nhập');
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
