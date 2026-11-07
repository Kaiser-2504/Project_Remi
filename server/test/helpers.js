'use strict';
const path = require('node:path');
const { createApp } = require('../index');
const { loadConfig } = require('../config');

const quiet = { warn() {}, error() {}, log() {} };

/** Khởi động một máy chủ thật trên cổng ngẫu nhiên, DB trong bộ nhớ. */
async function start(over = {}, deps = {}) {
  const sent = [];
  const clock = { t: Date.now() };
  const cfg = loadConfig({}, {
    dataDir: ':memory:',
    host: '127.0.0.1',
    schedulerMs: 3600000,
    webDir: path.join(__dirname, '..', '..', 'web'),
    ...over,
  });
  const app = createApp(cfg, {
    pushSender: async (sub, payload) => { sent.push({ sub, payload }); },
    log: quiet,
    now: () => clock.t,
    ...deps,
  });
  const addr = await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${addr.port}`;

  /** Máy khách giả có "kho cookie", mỗi client là một trình duyệt. */
  function client() {
    let cookieStr = '';
    return {
      async req(method, p, body, headers = {}) {
        const r = await fetch(base + p, {
          method,
          headers: { 'content-type': 'application/json', 'x-remi': '1', ...(cookieStr ? { cookie: cookieStr } : {}), ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const sc = r.headers.get('set-cookie');
        if (sc) {
          const c = sc.split(';')[0];
          cookieStr = c.endsWith('=') ? '' : c;
        }
        let json = null;
        try { json = await r.json(); } catch { /* không có thân JSON */ }
        return { status: r.status, json, headers: r.headers };
      },
      get: (p) => this_.req('GET', p),
    };
  }
  const this_ = { req: null };
  async function user(email = 'xiu@example.com', name = 'Xíu', password = 'matkhau-dai-123') {
    const c = client();
    this_.req = c.req;
    const r = await c.req('POST', '/api/auth/register', { email, name, password });
    if (r.status !== 201) throw new Error('register failed ' + JSON.stringify(r.json));
    return { c, id: r.json.user.id };
  }
  return { app, base, sent, clock, client, user, close: () => app.close() };
}

module.exports = { start };
