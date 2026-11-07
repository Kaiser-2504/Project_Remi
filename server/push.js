'use strict';
const crypto = require('node:crypto');
const { kvGet, kvSet } = require('./db');

let webpush = null;
try {
  webpush = require('web-push');
} catch {
  webpush = null; // chưa chạy npm install: thông báo đẩy tạm tắt, phần còn lại vẫn chạy
}

/** Sinh cặp khóa VAPID (P-256) ở dạng base64url như Web Push yêu cầu. */
function generateVapidKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pub = publicKey.export({ format: 'jwk' });
  const prv = privateKey.export({ format: 'jwk' });
  const point = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);
  return { publicKey: point.toString('base64url'), privateKey: prv.d };
}

/**
 * `sender(subscription, payload)` có thể được truyền vào khi test.
 * Mặc định dùng gói web-push.
 */
function createPush({ db, cfg, sender, log = console }) {
  let pub = cfg.vapidPublic;
  let prv = cfg.vapidPrivate;
  if (!pub || !prv) {
    pub = kvGet(db, 'vapid_public');
    prv = kvGet(db, 'vapid_private');
    if (!pub || !prv) {
      const k = generateVapidKeys();
      pub = k.publicKey;
      prv = k.privateKey;
      kvSet(db, 'vapid_public', pub);
      kvSet(db, 'vapid_private', prv);
    }
  }
  let send = sender;
  if (!send && webpush) {
    webpush.setVapidDetails(cfg.vapidSubject, pub, prv);
    send = (sub, payload) => webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
  }
  if (!send) log.warn('[push] Chưa cài gói web-push, thông báo đẩy tạm tắt. Chạy `npm install`.');

  return {
    publicKey: pub,
    enabled: !!send,
    async sendToUser(userId, payload) {
      const result = { sent: 0, failed: 0, removed: 0 };
      if (!send) return result;
      const subs = db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subs WHERE user_id = ?').all(userId);
      for (const s of subs) {
        try {
          await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          result.sent++;
        } catch (e) {
          if (e && (e.statusCode === 404 || e.statusCode === 410)) {
            db.prepare('DELETE FROM push_subs WHERE id = ?').run(s.id); // thiết bị đã gỡ đăng ký
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

module.exports = { createPush, generateVapidKeys };
