'use strict';
/**
 * Kiểm thử đầu-cuối: trình duyệt thật + máy chủ thật + "Anthropic" giả.
 *   npm install && npm run test:e2e        (đặt CHROME_PATH nếu muốn dùng Chrome có sẵn)
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');

function fakeAnthropic() {
  const calls = [];
  const ctl = { fail: false };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsedBody = JSON.parse(body);
      calls.push({ headers: req.headers, body: parsedBody });
      if (ctl.fail) { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{"error":"boom"}'); }
      const userText = (/Câu của người dùng: """([\s\S]*)"""/.exec(parsedBody.messages[0].content) || [])[1] || '';
      const who = /cho (\d+) người/.exec(userText);   // chỉ đọc câu của người dùng, không đọc ví dụ trong prompt
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const when = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:00`;
      const intent = {
        intent: 'task', title: 'Đi chợ nấu cà ri', emoji: '🛒', when, repeat: 'none', leadMinutes: 60, shopping: true, servings: who ? Number(who[1]) : 4,
        assumption: '19:00 ngày mai', summary: '',
        checklist: [{ item: 'Thịt gà', qty: '500g' }, { item: 'Bột cà ri', qty: '1 gói' }, { item: 'Khoai tây', qty: '3 củ' }],
        tips: [], habit: null,
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(intent) + '\n```' }] }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, calls, ctl, url: `http://127.0.0.1:${server.address().port}` })));
}

(async () => {
  const fake = await fakeAnthropic();
  const clock = { t: Date.now() };
  const pushes = [];
  const cfg = loadConfig({}, {
    dataDir: ':memory:', host: '127.0.0.1', schedulerMs: 3600000,
    webDir: path.join(__dirname, '..', 'web'),
    anthropicKey: 'sk-fake', anthropicBase: fake.url, secureCookies: false,
  });
  const app = createApp(cfg, { pushSender: async (sub, payload) => { pushes.push(payload); }, now: () => clock.t, log: { warn() {}, error: console.error, log() {} } });
  const addr = await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${addr.port}`;

  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'], headless: 'new' });
  const errors = [];
  const devices = {};
  async function device(name) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844 });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) errors.push(`${name} CSP: ${m.text()}`); });
    const rawClick = page.click.bind(page);
    page.click = async (sel, ...a) => {
      try { return await rawClick(sel, ...a); } catch (e) { throw new Error(`click(${sel}) trên máy ${name}: ${e.message}`); }
    };
    page.on('console', (m) => console.log(`[${name} console]`, m.type(), m.text()));
    page.on('pageerror', (e) => console.log(`[${name} pageerror]`, e.stack || e.message));
    page.on('requestfailed', (r) =>
      console.log(`[${name} requestfailed]`, r.url(), r.failure()?.errorText));
    page.on('response', (r) => {
      const u = r.url();
      if (r.status() >= 400 || u.includes('/api/') || /\.js(\?|$)/.test(u))
        console.log(`[${name} http]`, r.status(), u);
    });
    const cdp = await page.createCDPSession();
    await cdp.send('Runtime.enable');
    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails: d }) => {
      console.log(`[${name} vị trí lỗi]`, d.url || d.scriptId,
        'dòng', d.lineNumber + 1, 'cột', d.columnNumber + 1);
    });
    await page.goto(base);
    devices[name] = page;
    return page;
  }
  const text = (page) => page.evaluate(() => document.body.innerText);
  const api = (page, p) => page.evaluate(async (u) => (await fetch(u, { headers: { 'X-Remi': '1' } })).json(), p);
  // Đợi khung trượt lên xong hẳn (hiệu ứng CSS kết thúc) rồi mới thao tác
  const sheetReady = (p) => p.waitForFunction(() => {
    const sh = document.querySelector('#sheet');
    return document.body.classList.contains('sheet-open') &&
      !document.getAnimations().some((a) => a.effect && a.effect.target && (a.effect.target === sh || sh.contains(a.effect.target)));
  });
  const step = (s) => console.log('  ✓', s);

  try {
    console.log('1. Đăng ký trên thiết bị A');
    const A = await device('A');
    await A.waitForSelector('#auth-form');
    await A.click('#a-sw');
    await A.waitForSelector('#a-name');
    await A.type('#a-name', 'Xíu');
    await A.type('#a-email', 'xiu@example.com');
    await A.type('#a-pw', 'matkhau-dai-123');
    await A.click('#a-go');
    await A.waitForFunction(() => document.querySelector('#welcome').hidden);
    assert.match(await A.$eval('#greet', (e) => e.textContent), /Xíu/);
    step('đăng ký thành công, lời chào gọi đúng tên "Xíu"');

    console.log('2. AI qua máy chủ, không có chế độ cơ bản');
    fake.ctl.fail = true;
    await A.type('#ta', 'vợ nhờ tôi đi chợ nấu cà ri lúc 7h');
    await A.click('#send');
    await A.waitForFunction(() => [...document.querySelectorAll('.alert')].some((a) => /Remi chưa hiểu được lúc này/.test(a.innerText)));
    assert.equal(await A.evaluate(() => document.body.classList.contains('sheet-open')), false, 'AI lỗi thì không được tự đoán và mở form');
    assert.equal(await A.$eval('#ta', (e) => e.value), 'vợ nhờ tôi đi chợ nấu cà ri lúc 7h', 'phải giữ nguyên câu đã gõ');
    step('AI lỗi: báo rõ, không tự đoán, giữ nguyên câu để thử lại');
    await A.$$eval('.alert .x', (xs) => xs.forEach((x) => x.click()));
    fake.ctl.fail = false;
    await A.click('#send');
    await A.waitForSelector('#sh-list .srow');
    await sheetReady(A);
    const last = fake.calls[fake.calls.length - 1];
    assert.equal(last.headers['x-api-key'], 'sk-fake');
    assert.match(last.body.messages[0].content, /vợ nhờ tôi đi chợ nấu cà ri lúc 7h/);
    const html = await A.content();
    assert.ok(!html.includes('sk-fake'), 'khóa API lộ ra trang');
    assert.match(await A.$eval('#sh-list', (e) => e.textContent), /Thịt gà/);
    assert.equal(await A.$eval('#sh-sel', (e) => e.textContent.includes('Chưa có món nào')), true);
    step('AI trả về gợi ý nguyên liệu, danh sách đi chợ bắt đầu trống');

    console.log('2b. Tinh chỉnh định lượng');
    await A.click('#sh-list .srow');           // chọn món đầu tiên: Thịt gà 500g
    const qv = () => A.$eval('#sh-sel .qv', (e) => e.value);
    assert.equal(await qv(), '500g');
    await A.click('#sh-sel [data-q="1"]');
    assert.equal(await qv(), '550 g');
    await A.click('#sh-sel [data-q="-1"]');
    await A.click('#sh-sel [data-q="-1"]');
    assert.equal(await qv(), '450 g');
    await A.click('#sh-sel [data-q="1"]');
    await A.click('#sh-sel [data-q="1"]');
    assert.equal(await qv(), '550 g');
    step('nút + và − đổi 50 g mỗi lần: 500 → 550 → 450 → 550');
    await A.click('.serv [data-sv="1"]');
    assert.equal(await A.$eval('#sh-sv', (e) => e.textContent), '5');
    assert.equal(await qv(), '690 g');
    step('đổi từ 4 lên 5 người: 550 g co giãn thành 690 g');
    await A.click('#s-ok');
    await A.waitForFunction(() => document.body.classList.contains('sheet-open') === false);
    step('tạo việc đi chợ cùng danh sách');

    console.log('3. Dữ liệu và lịch nhắc lên máy chủ');
    await sleep(2800);
    // lấy cookie của A để hỏi API như chính nó
    const st = await api(A, '/api/state');
    assert.equal(st.version >= 1, true);
    assert.equal(st.state.tasks.length, 1);
    assert.equal(st.state.tasks[0].title, 'Đi chợ nấu cà ri');
    assert.equal(st.state.tasks[0].checklist.length, 1);
    assert.equal(st.state.tasks[0].checklist[0].qty, '690 g');
    assert.equal(st.state.tasks[0].servings, 5);
    const rows = app.db.prepare('SELECT key, title, fire_at FROM reminders ORDER BY fire_at').all();
    assert.ok(rows.length >= 2, 'phải có nhắc trước 1 tiếng và nhắc đúng giờ');
    assert.ok(rows.some((r) => /Xíu/.test(r.title)), 'lời nhắc phải gọi tên người dùng');
    step(`máy chủ có việc và ${rows.length} lời nhắc, tiêu đề: "${rows[0].title}"`);

    console.log('3b. Chỉnh trong khung chi tiết và Remi nhớ định lượng');
    await A.click('nav.tabs button[data-tab="soon"]');
    await A.click('.task h3');
    await A.waitForSelector('#t-sv');
    await sheetReady(A);
    assert.equal(await A.$eval('#t-sv', (e) => e.textContent), '5');
    await A.click('.serv [data-sv="-1"]');
    assert.equal(await A.$eval('#t-sv', (e) => e.textContent), '4');
    assert.equal(await A.$eval('#t-list .lq', (e) => e.value), '550 g');   // 690 g co giãn về 4 người
    await A.click('#t-list [data-qp="0"]');
    assert.equal(await A.$eval('#t-list .lq', (e) => e.value), '600 g');
    await A.click('#t-x');
    await A.waitForFunction(() => document.body.classList.contains('sheet-open') === false);
    await sleep(2800);
    const st2 = await api(A, '/api/state');
    assert.equal(st2.state.tasks[0].servings, 4);
    assert.equal(st2.state.tasks[0].checklist[0].qty, '600 g');
    assert.deepEqual(st2.state.dishes['nấu cà ri'], { s: 4, items: [{ item: 'Thịt gà', qty: '600 g' }] });
    step('đổi về 4 người ra 550 g, bấm + thành 600 g, lưu lên máy chủ kèm số người');
    await A.click('nav.tabs button[data-tab="today"]');
    await A.type('#ta', 'đi chợ nấu cà ri cho 6 người');
    await A.click('#send');
    await A.waitForSelector('#sh-list .srow');
    await sheetReady(A);
    assert.equal(await A.$eval('#sh-sv', (e) => e.textContent), '6');
    const mem = await A.$eval('#sh-list', (e) => { const h = [...e.querySelectorAll('.shead')][0]; const r = h.nextElementSibling; return h.textContent + '|' + r.textContent; });
    assert.match(mem, /Lần trước bạn mua\|\+Thịt gà900 g/);
    step('lần sau nấu cho 6 người: món nhớ lần trước tự co giãn 600 g thành 900 g');
    await A.click('#s-cancel');
    await A.waitForFunction(() => document.body.classList.contains('sheet-open') === false);

    console.log('4. Thiết bị B đăng nhập, thấy cùng dữ liệu');
    const B = await device('B');
    await B.waitForSelector('#a-email');
    await B.type('#a-email', 'xiu@example.com');
    await B.type('#a-pw', 'matkhau-dai-123');
    await B.click('#a-go');
    await B.waitForFunction(() => document.querySelector('#welcome').hidden);
    await sleep(800);
    await B.click('nav.tabs button[data-tab="soon"]');
    assert.match(await text(B), /Đi chợ nấu cà ri/);
    step('B thấy việc do A tạo');

    console.log('5. Sửa trên hai máy gần như cùng lúc, gộp không mất dữ liệu');
    await A.setOfflineMode(true);
    await A.click('nav.tabs button[data-tab="today"]');
    await A.type('#ta', 'Mai họp lúc 9h30');            // mất mạng: AI không hiểu được, phải báo rõ
    await A.click('#send');
    await A.waitForFunction(() => [...document.querySelectorAll('.alert')].some((a) => /Cần có mạng/.test(a.innerText)));
    assert.equal(await A.evaluate(() => document.body.classList.contains('sheet-open')), false);
    await A.$eval('#ta', (e) => { e.value = ''; });
    await A.$$eval('.alert .x', (xs) => xs.forEach((x) => x.click()));
    await A.click('[data-new="reminder"]');             // nút tạo nhanh vẫn dùng được khi ngoại tuyến
    await A.waitForSelector('#f-title');
    await sheetReady(A);
    await A.$eval('#f-title', (e) => { e.value = '📅 Việc tạo lúc ngoại tuyến'; });
    await A.click('#s-ok');
    await sleep(300);
    await B.click('nav.tabs button[data-tab="today"]');
    await B.click('[data-new="reminder"]');
    await B.waitForSelector('#f-title');
    await sheetReady(B);
    await B.$eval('#f-title', (e) => { e.value = '📞 Việc tạo từ máy B'; });
    await B.click('#s-ok');
    await sleep(2800);                              // B đẩy lên máy chủ
    await A.setOfflineMode(false);
    await A.evaluate(() => window.dispatchEvent(new Event('online')));
    await sleep(3500);
    const merged = await api(A, '/api/state');
    const titles = merged.state.tasks.map((t) => t.title).sort();
    assert.ok(titles.some((t) => /ngoại tuyến/.test(t)), 'mất việc tạo lúc ngoại tuyến: ' + titles);
    assert.ok(titles.some((t) => /máy B/.test(t)), 'mất việc tạo từ máy B: ' + titles);
    assert.ok(titles.some((t) => /Đi chợ/.test(t)));
    step('cả 3 việc đều còn sau khi gộp: ' + titles.join(' | '));

    console.log('6. Xoá trên B lan sang A (bia mộ)');
    await B.evaluate(() => document.querySelectorAll('.task h3').forEach((h) => { if (/máy B/.test(h.textContent)) h.click(); }));
    await B.waitForSelector('#t-del');
    await sheetReady(B);
    await B.click('#t-del');
    await B.click('#t-del');                        // chạm hai lần mới xoá
    await sleep(2800);
    await A.evaluate(() => window.dispatchEvent(new Event('online')));
    await sleep(3500);
    const afterDel = await api(A, '/api/state');
    assert.ok(!afterDel.state.tasks.some((t) => /máy B/.test(t.title)), 'việc đã xoá vẫn còn');
    assert.ok(afterDel.state.tasks.some((t) => /ngoại tuyến/.test(t.title)));
    step('việc bị xoá ở B biến mất, việc khác còn nguyên');

    console.log('7. Máy chủ gửi thông báo đẩy đúng giờ');
    const sub = { subscription: { endpoint: 'https://push.example.com/e2e', keys: { p256dh: 'p', auth: 'a' } } };
    await A.evaluate(async (s) => (await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Remi': '1' }, body: JSON.stringify(s) })).status, sub);
    const first = app.db.prepare("SELECT fire_at FROM reminders WHERE sent = 0 AND key LIKE 't:%' ORDER BY fire_at LIMIT 1").get();
    clock.t = first.fire_at + 1000;
    const r = await app.scheduler.tick();
    assert.ok(r.sent >= 1, JSON.stringify(r));
    assert.ok(pushes.some((p) => /Xíu/.test(p.title)), 'thông báo đẩy phải gọi tên: ' + JSON.stringify(pushes));
    step(`thông báo đẩy: "${pushes[0].title}"`);

    console.log('8. Đăng xuất xoá dữ liệu trên máy');
    await A.$$eval('.alert .x', (xs) => xs.forEach((x) => x.click()));   // thông báo trong app có thể che nút tài khoản
    await A.click('#me');
    await A.waitForSelector('#p-out');
    await sheetReady(A);
    await A.click('#p-out');
    await A.waitForFunction(() => !document.querySelector('#welcome').hidden && document.querySelector('#auth-form'));
    // Sau khi tải lại, app tự ghi trạng thái rỗng; điều quan trọng là không còn dữ liệu của người cũ.
    const left = await A.evaluate(() => ({
      me: localStorage.getItem('remi.me'),
      base: localStorage.getItem('remi.base'),
      tasks: JSON.parse(localStorage.getItem('remi.tasks') || '[]').length,
      habits: JSON.parse(localStorage.getItem('remi.habits') || '[]').length,
      dishes: Object.keys(JSON.parse(localStorage.getItem('remi.dishes') || '{}')).length,
      pantry: Object.keys(JSON.parse(localStorage.getItem('remi.pantry') || '{}')).length,
    }));
    assert.deepEqual(left, { me: null, base: null, tasks: 0, habits: 0, dishes: 0, pantry: 0 });
    assert.equal((await A.evaluate(async () => (await fetch('/api/me', { headers: { 'X-Remi': '1' } })).status)), 401);
    step('đã đăng xuất, dữ liệu người cũ bị xoá khỏi máy, phiên bị huỷ');

    assert.deepEqual(errors, [], 'có lỗi JavaScript trong trình duyệt: ' + errors.join('; '));
    console.log('\nTẤT CẢ ĐỀU QUA');
  } catch (e) {
    console.error('\nTHẤT BẠI:', e.message);
    console.error(' lỗi trình duyệt:', errors);
    for (const [n, pg] of Object.entries(devices)) {
      try {
        console.error(' welcome', n, await pg.evaluate(() =>
          document.querySelector('#welcome')?.outerHTML.slice(0, 1000)));
        await pg.screenshot({ path: `e2e-fail-${n}.png`, fullPage: true });
      } catch (x) { console.error(' không chụp được máy', n, x.message); }
    }
    for (const [n, pg] of Object.entries(devices)) {
      try {
        console.error(' trạng thái máy', n, await pg.evaluate(() => ({ sheetOpen: document.body.classList.contains('sheet-open'), welcomeHidden: document.querySelector('#welcome').hidden, tab: [...document.querySelectorAll('nav.tabs button')].find((b) => b.getAttribute('aria-selected') === 'true')?.dataset.tab, sheet: document.querySelector('#sheet').innerText.slice(0, 120), alerts: [...document.querySelectorAll('.alert')].map((a) => a.innerText) })));
      } catch (x) { console.error(' không đọc được máy', n, x.message); }
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
    await app.close();
    fake.server.close();
  }
})();