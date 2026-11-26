/* Theo dõi hành vi (Google Analytics 4) và ghi lỗi tập trung (Sentry) cho giao diện.
 * Cấu hình đọc từ window.REMI_MONITOR do /js/monitor-config.js đặt (sinh lúc build từ biến môi trường).
 * Không có cấu hình thì không làm gì. Không gửi email, tên hay nội dung việc của người dùng. */
'use strict';
(function () {
  const cfg = window.REMI_MONITOR || {};

  /* ---------- Google Analytics 4 ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (cfg.gaId) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.gaId);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', cfg.gaId, { anonymize_ip: true });
  }
  // Gọi từ app.js: remiTrack('tab_view', { tab: 'cal' }). Chỉ gửi tên sự kiện và tham số ngắn.
  window.remiTrack = function (name, params) {
    if (cfg.gaId) gtag('event', name, params || {});
  };

  /* ---------- Sentry ---------- */
  let target = null;
  try {
    if (cfg.sentryDsn) {
      const u = new URL(cfg.sentryDsn);
      const pid = u.pathname.replace(/^\/+|\/+$/g, '');
      target = u.protocol + '//' + u.host + '/api/' + pid + '/envelope/?sentry_key=' + u.username + '&sentry_version=7';
    }
  } catch (e) { target = null; }

  let sent = 0;
  function frames(stack) {
    return String(stack || '').split('\n').map(function (l) {
      const m = l.trim().match(/(?:at )?(?:(.+?)[ @]\(?)?(https?:\/\/[^\s)]+):(\d+):(\d+)\)?$/);
      return m && { function: m[1] || '?', filename: m[2], lineno: +m[3], colno: +m[4], in_app: true };
    }).filter(Boolean).reverse();
  }
  function capture(err, extra) {
    if (!target || sent >= 10) return; // tối đa 10 lỗi mỗi lần mở trang, tránh dội lỗi
    sent++;
    const e = err instanceof Error ? err : new Error(String(err && err.message || err));
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '').slice(0, 32).padEnd(32, '0');
    const event = {
      event_id: id,
      timestamp: Date.now() / 1000,
      platform: 'javascript',
      level: 'error',
      environment: cfg.env || 'production',
      release: cfg.release,
      request: { url: location.origin + location.pathname, headers: { 'User-Agent': navigator.userAgent } },
      extra: extra,
      exception: { values: [{ type: e.name || 'Error', value: e.message, stacktrace: { frames: frames(e.stack) } }] },
    };
    const body = JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }) + '\n' + JSON.stringify({ type: 'event' }) + '\n' + JSON.stringify(event);
    try { fetch(target, { method: 'POST', body: body, keepalive: true }).catch(function () {}); } catch (x) { /* bỏ qua */ }
  }
  window.remiCapture = capture;
  window.addEventListener('error', function (ev) { capture(ev.error || ev.message, { source: ev.filename, line: ev.lineno }); });
  window.addEventListener('unhandledrejection', function (ev) { capture(ev.reason || 'unhandledrejection'); });

  // Mở /?sentry-test=1 để gửi một lỗi thử (dùng làm bằng chứng khi nộp bài).
  if (new URLSearchParams(location.search).get('sentry-test') === '1') {
    setTimeout(function () { capture(new Error('Remi: lỗi thử để kiểm tra Sentry (giao diện)')); }, 500);
  }
})();
