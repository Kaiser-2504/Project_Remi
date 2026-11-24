/* Service worker của Remi: mở app khi mất mạng và nhận thông báo đẩy từ máy chủ. */
'use strict';
const CACHE = 'remi-v6';
const SHELL = ['/', '/css/app.css', '/js/api.js', '/js/qty.js', '/js/stats.js', '/js/kitchen.js', '/js/kitchen-ui.js', '/data/dishes.json', '/js/app.js', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Có mạng thì lấy bản mới nhất (và lưu lại), mất mạng thì dùng bản đã lưu. API không bao giờ qua cache.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('/')))
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Remi', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      // App đang mở và nhìn thấy: để app tự hiện thông báo trong màn hình, tránh báo hai lần.
      if (cs.some((c) => c.visibilityState === 'visible')) {
        cs.forEach((c) => c.postMessage({ type: 'push', title: d.title, body: d.body }));
        return undefined;
      }
      return self.registration.showNotification(d.title || 'Remi', {
        body: d.body || '',
        icon: '/icons/icon-192.png',
        tag: d.tag,
        // Nút hành động (Xong, Nhắc lại): Android/Chrome/Edge có, iPhone chưa hỗ trợ thì chỉ là thông báo thường.
        actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : [],
        data: { url: d.url || '/', key: d.key || d.tag || '' },
      });
    })
  );
});

function focusOrOpen(url, msg) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs[0];
    if (c) { if (msg) c.postMessage(msg); return c.focus(); }
    // App đang đóng: mở app và nhờ trang đọc hành động từ #act=...
    const hash = msg ? '#act=' + msg.action + '&key=' + encodeURIComponent(msg.key) : '';
    return self.clients.openWindow(url + hash);
  });
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const url = data.url || '/';
  const key = data.key || '';
  if (e.action === 'snooze' && key) {
    // Nhắc lại chạy thẳng trên máy chủ, không cần mở app (cookie phiên tự đi kèm).
    e.waitUntil(
      fetch('/api/reminders/snooze', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Remi': '1' },
        body: JSON.stringify({ key, minutes: 10 }),
      })
        .then((r) => {
          if (!r.ok) throw new Error('snooze ' + r.status);
          return self.registration.showNotification('Remi', { body: 'Sẽ nhắc lại sau 10 phút.', icon: '/icons/icon-192.png', tag: 'snooze-ok', silent: true });
        })
        .then(() => new Promise((res) => setTimeout(res, 2500)))
        .then(() => self.registration.getNotifications({ tag: 'snooze-ok' }))
        .then((ns) => ns.forEach((n) => n.close()))
        // Hết mạng hoặc phiên hết hạn: mở app để người dùng tự xử lý.
        .catch(() => focusOrOpen(url))
    );
    return;
  }
  if (e.action === 'done' && key) {
    e.waitUntil(focusOrOpen(url, { type: 'action', action: 'done', key }));
    return;
  }
  e.waitUntil(focusOrOpen(url));
});
