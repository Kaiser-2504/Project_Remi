'use strict';

function isAsleep(db, userId, cache) {
  if (cache.has(userId)) return cache.get(userId);
  let asleep = false;
  const row = db.prepare('SELECT data FROM states WHERE user_id = ?').get(userId);
  if (row) {
    try {
      const st = JSON.parse(row.data);
      asleep = !!(st.sleep && st.sleep.awake === false);
    } catch {
      asleep = false;
    }
  }
  cache.set(userId, asleep);
  return asleep;
}

const STALE_MS = 30 * 60 * 1000; // nhắc trễ hơn 30 phút thì bỏ, tránh dội thông báo cũ sau khi máy chủ khởi động lại

/**
 * Quét các lời nhắc đến hạn và gửi thông báo đẩy.
 * Đánh dấu "đã gửi" trước khi gửi:thà bỏ lỡ còn hơn gửi trùng.
 */
function createScheduler({ db, push, cfg, log = console, now = () => Date.now() }) {
  let running = false;
  let timer = null;

  async function tick() {
    if (running) return { skipped: true };
    running = true;
    try {
      const t = now();
      const due = db
        .prepare('SELECT user_id, key, fire_at, title, body, cond FROM reminders WHERE sent = 0 AND fire_at <= ? ORDER BY fire_at LIMIT 200')
        .all(t);
      const cache = new Map();
      let sent = 0;
      let skipped = 0;
      for (const r of due) {
        db.prepare('UPDATE reminders SET sent = 1 WHERE user_id = ? AND key = ?').run(r.user_id, r.key);
        if (t - r.fire_at > STALE_MS) { skipped++; continue; }
        if (r.cond === 'asleep' && !isAsleep(db, r.user_id, cache)) { skipped++; continue; }
        const res = await push.sendToUser(r.user_id, { title: r.title, body: r.body, tag: r.key, url: '/' });
        if (res.sent > 0) sent++;
      }
      db.prepare('DELETE FROM reminders WHERE sent = 1 AND fire_at < ?').run(t - 3 * 24 * 3600 * 1000);
      return { due: due.length, sent, skipped };
    } catch (e) {
      log.error('[scheduler]', e);
      return { error: true };
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start() {
      timer = setInterval(tick, cfg.schedulerMs);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}

module.exports = { createScheduler };
