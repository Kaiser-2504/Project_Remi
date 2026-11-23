'use strict';

/**
 * Thông báo đẩy (Web Push). Khóa VAPID BẮT BUỘC đặt qua biến môi trường vì Vercel
 * không có ổ đĩa để lưu khóa tự sinh: thiếu khóa thì thông báo đẩy tắt, phần còn lại vẫn chạy.
 * `sender(subscription, payload)` truyền vào được khi test.
 */
function createPush({ repo, cfg, sender, log = console }) {
  let send = sender || null;
  if (!send && cfg.vapidPublic && cfg.vapidPrivate) {
    try {
      const webpush = require('web-push');
      webpush.setVapidDetails(cfg.vapidSubject, cfg.vapidPublic, cfg.vapidPrivate);
      send = (sub, payload) =>
        webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 1800, urgency: 'high', timeout: 5000 });
    } catch (e) {
      log.warn('[push] Không nạp được web-push hoặc khóa VAPID sai, thông báo đẩy tắt:', e && e.message);
      send = null;
    }
  }

  const isGone = (e) => !!e && (e.statusCode === 404 || e.statusCode === 410);

  return {
    publicKey: cfg.vapidPublic,
    enabled: !!send,
    send,
    isGone,
    async sendToUser(userId, payload) {
      const result = { sent: 0, failed: 0, removed: 0 };
      if (!send) return result;
      const subs = await repo.listSubsForUsers([userId]);
      for (const s of subs) {
        try {
          await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          result.sent++;
        } catch (e) {
          if (isGone(e)) {
            await repo.deletePushSub(s.endpoint); // thiết bị đã gỡ đăng ký
            result.removed++;
          } else {
            result.failed++;
            log.warn('[push] gửi lỗi:', (e && (e.statusCode || e.message)) || e);
          }
        }
      }
      return result;
    },
  };
}

module.exports = { createPush };
