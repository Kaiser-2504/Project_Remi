'use strict';
const { actionsFor } = require('./actions');

/** Khớp định dạng mà web/sw.js đọc: title, body, tag, url (+ actions, key nếu có nút). */
function buildPayload(d) {
  const p = { title: d.title, body: d.body, tag: d.key, url: '/' };
  const actions = actionsFor(d.key);
  if (actions.length) { p.actions = actions; p.key = d.key; }
  return p;
}

/**
 * Gửi các lời nhắc đến hạn. Được gọi mỗi phút bởi pg_cron của Supabase (qua /api/cron/dispatch).
 *
 * "Nhận trước, gửi sau": claimDueReminders đánh dấu đã gửi NGUYÊN TỬ ngay trong câu SQL nhận,
 * nên hai lần gọi chồng nhau không bao giờ gửi trùng một lời nhắc (thà bỏ lỡ còn hơn gửi trùng,
 * giống bộ lập lịch cũ). Cửa sổ 30 phút (bỏ lời nhắc đã trễ) nằm trong câu SQL.
 *
 * @param {object} o
 * @param {object} o.repo      cần claimDueReminders, usersAsleep, listSubsForUsers, deletePushSub
 * @param {Function} o.send    (subscription, payload) => Promise
 */
async function runDispatch({ repo, send, batch = 50, budgetMs = 8000, now = Date.now, log = console }) {
  const t0 = now();
  const out = { claimed: 0, sent: 0, pushes: 0, skipped: 0, failed: 0, removedSubs: 0, more: false, tookMs: 0 };
  for (;;) {
    if (now() - t0 > budgetMs) { out.more = true; break; }
    const due = await repo.claimDueReminders(batch);
    if (due.length === 0) break;
    out.claimed += due.length;

    // Lời nhắc "asleep" chỉ gửi khi người dùng đang ngủ (state.sleep.awake === false), như bộ cũ.
    const sleepers = due.filter((d) => d.cond === 'asleep').map((d) => d.user_id);
    const asleep = new Set(sleepers.length ? await repo.usersAsleep([...new Set(sleepers)]) : []);
    const todo = due.filter((d) => {
      if (d.cond === 'asleep' && !asleep.has(d.user_id)) { out.skipped++; return false; }
      return true;
    });

    // MỘT truy vấn lấy thiết bị cho cả lô, không hỏi từng người (tránh N+1).
    const subs = todo.length ? await repo.listSubsForUsers([...new Set(todo.map((d) => d.user_id))]) : [];
    const jobs = todo.flatMap((d) => subs.filter((s) => s.user_id === d.user_id).map((s) => ({ d, s })));
    const results = await Promise.allSettled(
      jobs.map(({ d, s }) =>
        send(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          // Khớp định dạng mà web/sw.js đọc: title, body, tag, url.
          buildPayload(d),
        ),
      ),
    );
    const okReminder = new Set();
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') { out.pushes++; okReminder.add(jobs[i].d.id); continue; }
      const code = r.reason && r.reason.statusCode;
      if (code === 404 || code === 410) {
        await repo.deletePushSub(jobs[i].s.endpoint);
        out.removedSubs++;
      } else {
        out.failed++;
        log.warn('[dispatch] gửi lỗi:', code || (r.reason && r.reason.message) || r.reason);
      }
    }
    out.sent += okReminder.size;
    if (due.length < batch) break; // không còn lô sau
  }
  out.tookMs = now() - t0;
  return out;
}

module.exports = { runDispatch };
