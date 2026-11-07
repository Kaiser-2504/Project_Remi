'use strict';
const http = require('node:http');
const { loadConfig, validateConfig } = require('./config');
const { openDb } = require('./db');
const { HttpError, sendJson, serveStatic, securityHeaders } = require('./http');
const { createApi } = require('./routes');
const { createPush } = require('./push');
const { createScheduler } = require('./scheduler');

/**
 * Dựng toàn bộ ứng dụng. Tách riêng khỏi listen() để test gọi được
 * (cổng 0, DB trong bộ nhớ, bộ gửi push giả, fetch giả).
 */
function createApp(cfg = loadConfig(), deps = {}) {
  const log = deps.log || console;
  const db = openDb(cfg.dataDir);
  const push = createPush({ db, cfg, sender: deps.pushSender, log });
  const scheduler = createScheduler({ db, push, cfg, log, now: deps.now });
  const api = createApi({ db, cfg, push, log, fetchImpl: deps.fetchImpl });
  const secHeaders = securityHeaders(cfg);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const r = await api(req, url);
        return sendJson(res, r.status || 200, r.json, { ...secHeaders, ...(r.headers || {}) });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return sendJson(res, 405, { error: 'method_not_allowed' }, secHeaders);
      }
      if (serveStatic(cfg, req, res, url.pathname, secHeaders)) return;
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...secHeaders });
      res.end('Không tìm thấy trang.');
    } catch (e) {
      if (e instanceof HttpError) {
        return sendJson(res, e.status, { error: e.code, message: e.message, ...e.extra }, secHeaders);
      }
      log.error('[server]', e);
      if (!res.headersSent) sendJson(res, 500, { error: 'server_error', message: 'Máy chủ gặp lỗi, thử lại sau.' }, secHeaders);
    }
  });

  return {
    cfg, db, push, scheduler, server,
    listen(port = cfg.port, host = cfg.host) {
      return new Promise((resolve) => server.listen(port, host, () => resolve(server.address())));
    },
    async close() {
      scheduler.stop();
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      db.close();
    },
  };
}

if (require.main === module) {
  const cfg = loadConfig();
  const problems = validateConfig(cfg);
  if (problems.length) {
    console.error('Remi không thể khởi động:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
  const app = createApp(cfg);
  app.scheduler.start();
  app.listen().then((addr) => {
    console.log(`Remi chạy tại http://localhost:${addr.port}`);
    if (!cfg.anthropicKey) console.log('[ai] Chưa có ANTHROPIC_API_KEY: câu nói chưa được AI hiểu. Điền khóa vào .env rồi chạy lại. Các nút tạo nhanh vẫn dùng được.');
  });
  const stop = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { createApp };
