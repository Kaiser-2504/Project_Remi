'use strict';
/**
 * Kiểm thử trình duyệt cho nhóm B: thực đơn tuần và tủ đồ nhà.
 * Trình duyệt thật + máy chủ thật, đi hết luồng như người dùng:
 * tủ đồ và hạn dùng -> gợi ý "hôm nay nấu gì" -> lên thực đơn -> gộp danh sách đi chợ -> nấu xong trừ tủ
 * -> món của tôi -> đi chợ về cất đồ vào tủ -> đồng bộ sang máy thứ hai -> bố cục ở 3 cỡ màn hình.
 *   npm run test:kitchen
 * Đặt KITCHEN_SHOTS=thư-mục để lưu ảnh chụp màn hình (dùng khi soát giao diện).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = process.env.KITCHEN_SHOTS;

(async () => {
  const cfg = loadConfig({}, { dataDir: ':memory:', host: '127.0.0.1', webDir: path.join(__dirname, '..', 'web'), secureCookies: false });
  const app = createApp(cfg, { log: { warn() {}, error: console.error, log() {} } });
  const addr = await app.listen(0, '127.0.0.1');
  const base = 'http://127.0.0.1:' + addr.port;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'], headless: 'new' });
  const errors = [];
  const ok = (m) => console.log('  ✓', m);
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const shot = async (pg, name) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, name + '.png') }); };

  async function device(name, register) {
    const pg = await (await browser.createBrowserContext()).newPage();
    pg.on('pageerror', (e) => errors.push(name + ': ' + e.message));
    pg.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) errors.push(name + ' CSP: ' + m.text()); });
    await pg.setViewport({ width: 390, height: 844 });
    await pg.goto(base);
    if (register) {
      await pg.waitForSelector('#a-sw');
      await pg.click('#a-sw');
      await pg.waitForSelector('#a-name');
      await pg.type('#a-name', 'Xíu');
    }
    await pg.waitForSelector('#a-email');
    await pg.type('#a-email', 'bep@e.co');
    await pg.type('#a-pw', 'matkhau-dai-123');
    await pg.click('#a-go');
    await pg.waitForFunction(() => document.querySelector('#welcome').hidden);
    await sleep(300);
    return pg;
  }
  const sheetReady = (pg) => pg.waitForFunction(() => {
    const sh = document.querySelector('#sheet');
    return document.body.classList.contains('sheet-open') &&
      !document.getAnimations().some((a) => a.effect && a.effect.target && (a.effect.target === sh || sh.contains(a.effect.target)));
  });
  const closed = (pg) => pg.waitForFunction(() => !document.body.classList.contains('sheet-open'));
  const tab = (pg, t) => pg.evaluate((x) => document.querySelector(`nav.tabs button[data-tab="${x}"]`).click(), t);
  const sub = (pg, v) => pg.evaluate((x) => document.querySelector(`.kseg [data-v="${x}"]`).click(), v);
  const dismiss = (pg) => pg.$$eval('.alert .x', (xs) => xs.forEach((x) => x.click()));
  const api = (pg, p) => pg.evaluate(async (u) => (await fetch(u, { headers: { 'X-Remi': '1' } })).json(), p);
  const stockNames = (pg) => pg.$$eval('#k-stock .kitem b', (bs) => bs.map((b) => b.textContent));
  const noOverflow = async (pg, label) => {
    const m = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    assert.ok(m.sw <= m.iw + 1, `${label}: tràn ngang ${m.sw} > ${m.iw}`);
  };

  try {
    const A = await device('A', true);
    // Giờ trong ngày quyết định "bữa đang tới"; test đọc lại từ trang để không phụ thuộc lúc chạy.
    const ctx = await A.evaluate(() => {
      const K = window.RemiKitchen, t = K.localKey(new Date()), slot = K.slotForHour(new Date().getHours());
      return { today: t, slot, other: slot === 'sang' ? 'toi' : 'sang', soon: K.addDays(t, 2) };
    });

    console.log('1. Mở tab Bếp, kho món có sẵn tải được');
    await tab(A, 'kitchen');
    await A.waitForSelector('#k-week');
    assert.equal(await A.$$eval('#k-week .kday', (d) => d.length), 7, 'lưới 7 ngày');
    assert.equal(await A.$$eval('#k-week .kslot', (d) => d.length), 21, '7 ngày x 3 bữa');
    assert.equal(await A.$eval('#k-week .kday.today h3', (e) => e.textContent.startsWith('Hôm nay')), true);
    assert.equal(await A.$eval('[data-k="shop"]', (b) => b.disabled), true, 'chưa có món thì chưa gộp được');
    assert.match(await A.$eval('#k-today', (e) => e.textContent), /Tủ đồ/);
    ok('lưới 7 ngày x 3 bữa, hôm nay được đánh dấu, nút gộp bị khoá khi trống');

    console.log('2. Tủ đồ: thêm đồ, hạn dùng, cộng dồn, báo lỗi');
    await sub(A, 'stock');
    await A.waitForSelector('#ks-name');
    await A.click('#ks-add');
    assert.equal(await A.$eval('#ks-err', (e) => e.textContent), 'Nhập tên món đồ.');
    const addStock = async (name, qty, exp) => {
      await A.type('#ks-name', name);
      if (qty) await A.type('#ks-qty', qty);
      if (exp) await A.click(`#ks-exp [data-v="${exp}"]`);
      await A.click('#ks-add');
      await A.waitForFunction((n) => [...document.querySelectorAll('#k-stock .kitem b')].some((b) => b.textContent === n), {}, name);
      await dismiss(A);
    };
    await addStock('Thịt gà', '300 g', '3');
    await addStock('Gừng', '100 g');
    await addStock('Hành tím', '5 củ');
    await addStock('Thịt gà', '0,2 kg', '3');                 // cùng tên cùng hạn: cộng dồn
    assert.deepEqual(await stockNames(A), ['Thịt gà', 'Gừng', 'Hành tím'], 'đồ sắp hết hạn lên đầu');
    assert.equal(await A.$eval('#k-stock .kitem .lq', (e) => e.value), '500 g', '300 g + 0,2 kg = 500 g');
    assert.match(await A.$eval('#k-stock .kitem .chip', (e) => e.textContent), /Còn 3 ngày/);
    assert.equal(await A.$eval('.kseg .kbadge', (e) => e.textContent), '1');
    ok('3 món trong tủ, thịt gà cộng dồn thành 500 g, hạn "Còn 3 ngày", huy hiệu 1 món cần chú ý');
    await A.click('#k-stock .kitem [data-k="sq"][data-d="1"]');   // nút + : 500 g -> 550 g
    await A.waitForFunction(() => document.querySelector('#k-stock .kitem .lq').value === '550 g');
    await A.click('#k-stock .kitem [data-k="sq"][data-d="-1"]');
    await A.waitForFunction(() => document.querySelector('#k-stock .kitem .lq').value === '500 g');
    ok('nút + và − chỉnh lượng trong tủ');
    await shot(A, 'tu-do-390');

    console.log('3. Hôm nay nấu gì: gợi ý theo tủ đồ, ưu tiên đồ sắp hết hạn');
    await sub(A, 'plan');
    await A.waitForSelector('#k-today .ksug');
    const first = await A.$eval('#k-today .ksug', (e) => e.textContent);
    assert.match(first, /Gà rang gừng/);
    assert.match(first, /Dùng Thịt gà sắp hết hạn/);
    assert.match(first, /Đủ nguyên liệu chính/);
    await A.click('#k-today .ksug [data-k="sugadd"]');
    await A.waitForFunction((k) => !!document.querySelector(`.kslot[data-key="${k}"] .kmeal`), {}, ctx.today + '|' + ctx.slot);
    await dismiss(A);
    ok('gợi ý đầu là Gà rang gừng (đủ nguyên liệu, dùng thịt gà sắp hết hạn), thêm vào bữa đang tới');
    await shot(A, 'thuc-don-390');

    console.log('4. Thêm món bằng ô tìm kiếm, chỉnh số người');
    await dismiss(A);
    await A.click(`.kslot[data-key="${ctx.today}|${ctx.other}"] [data-k="add"]`);
    await sheetReady(A);
    await A.type('#kp-q', 'cari');                                    // tên gọi khác, không dấu
    await A.waitForFunction(() => [...document.querySelectorAll('#kp-list [data-pick]')].some((b) => /Cà ri gà/.test(b.textContent)));
    await A.click('.serv [data-sv="-1"]');
    await A.click('.serv [data-sv="-1"]');
    assert.equal(await A.$eval('#kp-sv', (e) => e.textContent), '2');
    await A.click('#kp-list [data-pick="lib:ca ri ga"]');
    await closed(A);
    const chip = await A.$eval(`.kslot[data-key="${ctx.today}|${ctx.other}"] .kmeal`, (e) => e.textContent);
    assert.match(chip, /Cà ri gà/);
    assert.match(chip, /2/);
    ok('tìm "cari" ra Cà ri gà, thêm cho 2 người');

    console.log('5. Gộp nguyên liệu cả tuần thành danh sách đi chợ, đã trừ tủ đồ');
    await A.click('[data-k="shop"]');
    await sheetReady(A);
    const rows = await A.$$eval('#ks-need .krow', (rs) => rs.map((r) => ({ name: r.querySelector('b').textContent, qty: r.querySelector('.kq').textContent, on: r.querySelector('input').checked, sub: r.querySelector('small').textContent })));
    const row = (n) => rows.find((r) => r.name === n);
    // Gà rang gừng 4 người: thịt gà 700 g; cà ri gà 2 người: 600 x 2/4 = 300 g. Cần 1 kg, tủ có 500 g -> mua 500 g.
    assert.equal(row('Thịt gà').qty, '500 g');
    assert.match(row('Thịt gà').sub, /Tủ có 500 g/);
    assert.match(row('Thịt gà').sub, /Cà ri gà, Gà rang gừng|Gà rang gừng, Cà ri gà/);
    assert.equal(row('Khoai tây').qty, '2 củ', '3 củ cho 4 người -> 1,5 củ cho 2 người, làm tròn lên 2');
    assert.equal(row('Gừng'), undefined, 'gừng đã đủ trong tủ (cần 50 g, có 100 g)');
    assert.ok(rows.every((r) => r.on), 'món cần mua được chọn sẵn');
    const haveTxt = await A.$eval('details.more', (e) => e.textContent);
    assert.match(haveTxt, /Gừng/);
    assert.match(haveTxt, /Hành tím/);
    ok(`${rows.length} món cần mua; thịt gà 1 kg trừ 500 g trong tủ còn 500 g; gừng, hành tím đã đủ`);
    await shot(A, 'di-cho-390');
    await A.click('#ks-need .krow:first-child input');                // bỏ chọn một món (không phải thịt gà)
    assert.notEqual(rows[0].name, 'Thịt gà');
    assert.match(await A.$eval('#ks-n', (e) => e.textContent), new RegExp((rows.length - 1) + ' món đã chọn'));
    await A.click('#kw-days [data-v="' + ctx.soon + '"]');
    await A.click('#kw-pre [data-v="09:00"]');
    await A.click('#ks-ok');
    await closed(A);
    await sleep(2800);
    let st = await api(A, '/api/state');
    const shopTask = st.state.tasks.find((t) => t.mealWeek);
    assert.ok(shopTask, 'có việc đi chợ trên máy chủ');
    assert.equal(shopTask.when, ctx.soon + 'T09:00');
    assert.equal(shopTask.shop, true);
    assert.equal(shopTask.checklist.length, rows.length - 1);
    assert.deepEqual(shopTask.checklist.find((c) => c.item === 'Thịt gà'), { item: 'Thịt gà', qty: '500 g', done: false });
    assert.equal(st.state.kitchen.stock.length, 3, 'tủ đồ lên máy chủ');
    assert.ok(Object.keys(st.state.meta.mealU).length >= 2, 'thực đơn có dấu thời gian để gộp');
    ok('việc đi chợ lưu lên máy chủ đúng ngày giờ, đúng ' + shopTask.checklist.length + ' món, tủ đồ và thực đơn cũng lên máy chủ');
    // Gộp lần hai không tạo việc trùng mà cập nhật việc cũ
    await dismiss(A);
    await A.click('[data-k="shop"]');
    await sheetReady(A);
    assert.match(await A.$eval('#sheet', (e) => e.textContent), /cập nhật việc đó/);
    await A.click('#ks-ok');
    await closed(A);
    await sleep(300);
    assert.equal((await A.evaluate(() => JSON.parse(localStorage.getItem('remi.tasks')))).filter((t) => t.mealWeek).length, 1);
    ok('gộp lại lần hai cập nhật việc cũ, không tạo việc trùng');

    console.log('6. Nấu xong: trừ nguyên liệu khỏi tủ');
    await dismiss(A);
    await A.click(`.kslot[data-key="${ctx.today}|${ctx.slot}"] .kmeal`);
    await sheetReady(A);
    assert.match(await A.$eval('#km-ing', (e) => e.textContent), /Thịt gà700 g/);
    await A.click('[data-k="mcook"]');
    await closed(A);
    await sub(A, 'stock');
    await A.waitForSelector('#k-stock');
    // Gà rang gừng 4 người dùng 700 g thịt gà (tủ có 500 g -> hết), 50 g gừng (còn 50 g), 3 củ hành tím (còn 2 củ)
    assert.deepEqual(await stockNames(A), ['Gừng', 'Hành tím']);
    assert.deepEqual(await A.$$eval('#k-stock .lq', (xs) => xs.map((x) => x.value)), ['50 g', '2 củ']);
    ok('thịt gà dùng hết bị bỏ khỏi tủ, gừng còn 50 g, hành tím còn 2 củ');

    console.log('7. Món của tôi: kiểm tra dữ liệu, tạo, dùng trong thực đơn');
    await sub(A, 'mine');
    await A.click('[data-k="newrec"]');
    await sheetReady(A);
    await A.click('#kr-ok');
    assert.equal(await A.$eval('#kr-err', (e) => e.textContent), 'Món cần có tên.');
    await A.type('#kr-name', 'Canh rau ngót thịt bằm');
    await A.click('#kr-ok');
    assert.equal(await A.$eval('#kr-err', (e) => e.textContent), 'Thêm ít nhất một nguyên liệu.');
    await A.type('[data-ri="0"][data-f="item"]', 'Rau ngót');
    await A.type('[data-ri="0"][data-f="qty"]', '2 bó');
    await A.click('#kr-addi');
    await A.type('[data-ri="1"][data-f="item"]', 'Gừng');
    await A.type('[data-ri="1"][data-f="qty"]', '20 g');
    await A.click('.serv [data-sv="-1"]');
    await A.click('.serv [data-sv="-1"]');
    await A.click('#kr-ok');
    await closed(A);
    assert.match(await A.$eval('.krecs .krec', (e) => e.textContent), /Canh rau ngót thịt bằm2 người · 2 nguyên liệu/);
    await dismiss(A);
    await sub(A, 'plan');
    await A.waitForSelector('#k-today .ksug');
    assert.match(await A.$eval('#k-today', (e) => e.textContent), /Canh rau ngót thịt bằm/, 'món của tôi có gừng trong tủ nên được gợi ý');
    ok('báo lỗi khi thiếu tên và nguyên liệu, lưu món 2 người, món của tôi xuất hiện trong gợi ý');

    console.log('8. Băng nhắc ở tab Hôm nay và đi chợ về cất đồ vào tủ');
    await A.evaluate((d) => {
      const k = JSON.parse(localStorage.getItem('remi.kitchen'));
      k.stock.push({ id: 'old-milk', name: 'Sữa tươi', qty: '1 lít', exp: d, u: Date.now() });
      localStorage.setItem('remi.kitchen', JSON.stringify(k));
    }, await A.evaluate(() => window.RemiKitchen.addDays(window.RemiKitchen.localKey(new Date()), -1)));
    await A.reload();
    await A.waitForFunction(() => document.querySelector('#welcome').hidden);
    await tab(A, 'today');
    await A.waitForSelector('#k-ban');
    assert.match(await A.$eval('#k-ban', (e) => e.textContent), /Sữa tươi/);
    await A.click('#k-ban [data-k="gostock"]');
    await A.waitForSelector('#k-stock');
    assert.equal(await A.evaluate(() => document.body.dataset.tab), 'kitchen');
    assert.match(await A.$eval('#k-stock .kitem', (e) => e.textContent), /Sữa tươiHết hạn hôm qua/);
    await A.click('[data-k="sclean"]');
    await A.waitForFunction(() => ![...document.querySelectorAll('#k-stock .kitem b')].some((b) => b.textContent === 'Sữa tươi'));
    await dismiss(A);
    ok('tab Hôm nay báo đồ hết hạn, bấm "Xem tủ" mở đúng Tủ đồ, bỏ đồ hết hạn một chạm');
    // mở việc đi chợ, tick 2 món, cất vào tủ
    await A.evaluate((id) => { document.querySelector('nav.tabs button[data-tab="soon"]').click(); }, shopTask.id);
    await A.waitForSelector(`.task[data-id="${shopTask.id}"]`);
    await A.evaluate((id) => document.querySelector(`.task[data-id="${id}"] h3`).click(), shopTask.id);
    await sheetReady(A);
    await A.click('#t-list input[data-ti="0"]');
    await A.click('#t-list input[data-ti="1"]');
    const bought = await A.$$eval('#t-list .ln', (xs) => xs.slice(0, 2).map((x) => x.textContent));
    await A.click('#t-stock');
    await A.waitForFunction(() => [...document.querySelectorAll('.alert b')].some((b) => /Đã cất 2 món vào tủ/.test(b.textContent)));
    await A.click('#t-stock');                                          // bấm lần nữa không cất trùng
    await A.waitForFunction(() => [...document.querySelectorAll('.alert b')].some((b) => /Chưa có món nào để cất/.test(b.textContent)));
    await dismiss(A);                                                   // thông báo nổi phía trên che nút đóng
    await A.click('#t-x');
    await closed(A);
    await dismiss(A);
    await tab(A, 'kitchen');
    await sub(A, 'stock');
    await A.waitForSelector('#k-stock');
    const names = await stockNames(A);
    bought.forEach((b) => assert.ok(names.includes(b), b + ' phải có trong tủ'));
    assert.equal(names.length, 2 + bought.length, 'không cất trùng');
    ok('cất ' + bought.join(', ') + ' vào tủ; bấm lần hai không cất trùng');

    console.log('9. Đồng bộ sang máy thứ hai, xoá ở máy B lan sang máy A');
    await sleep(2800);
    const B = await device('B', false);
    await tab(B, 'kitchen');
    await B.waitForSelector('#k-week');
    await B.waitForFunction((k) => !!document.querySelector(`.kslot[data-key="${k}"] .kmeal`), {}, ctx.today + '|' + ctx.other);
    await sub(B, 'stock');
    await B.waitForSelector('#k-stock');
    assert.deepEqual((await stockNames(B)).sort(), names.slice().sort());
    await sub(B, 'mine');
    assert.match(await B.$eval('.krecs', (e) => e.textContent), /Canh rau ngót thịt bằm/);
    await sub(B, 'stock');
    await B.waitForSelector('#k-stock');
    await B.evaluate(() => [...document.querySelectorAll('#k-stock .kitem')].find((x) => /Gừng/.test(x.textContent)).querySelector('[data-k="sdel"]').click());
    await B.waitForFunction(() => ![...document.querySelectorAll('#k-stock .kitem b')].some((b) => b.textContent === 'Gừng'));
    await sleep(2800);
    await A.reload();
    await A.waitForFunction(() => document.querySelector('#welcome').hidden);
    await sleep(1500);
    await tab(A, 'kitchen');
    await sub(A, 'stock');
    await A.waitForSelector('#k-stock');
    assert.ok(!(await stockNames(A)).includes('Gừng'), 'gừng bị xoá ở B phải biến mất ở A');
    ok('máy B thấy thực đơn, tủ đồ, món của tôi; xoá gừng ở B thì A cũng mất');

    console.log('9b. Hỏi nhanh "hôm nay nấu gì" ở ô nhập mở thẳng gợi ý, không cần AI');
    await tab(A, 'today');
    await A.type('#ta', 'Hôm nay nấu gì?');
    await A.keyboard.press('Enter');
    await A.waitForFunction(() => document.body.dataset.tab === 'kitchen' && !!document.querySelector('#k-today'));
    assert.equal(await A.$eval('#ta', (e) => e.value), '');
    ok('gõ "Hôm nay nấu gì?" chuyển sang Bếp, thẻ gợi ý hiện ra');

    console.log('10. Bố cục ở 320px, 390px, 1440px: không tràn ngang');
    for (const [w, h] of [[320, 568], [390, 844], [1440, 900]]) {
      await A.setViewport({ width: w, height: h });
      for (const v of ['plan', 'stock', 'mine']) {
        await sub(A, v);
        await sleep(150);
        await noOverflow(A, `${w}px, ${v}`);
      }
      await sub(A, 'plan');
      await sleep(150);
      if (w === 1440) {
        const cols = await A.$$eval('#k-week .kday', (ds) => new Set(ds.map((d) => Math.round(d.getBoundingClientRect().top))).size);
        assert.equal(cols, 1, 'màn hình rộng: 7 ngày nằm trên một hàng');
      }
      await shot(A, 'thuc-don-' + w);
      ok(`${w}px không tràn ngang` + (w === 1440 ? ', cả tuần nằm trên một hàng' : ''));
    }

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
