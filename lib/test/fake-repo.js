'use strict';
/**
 * Repo giả trong bộ nhớ, CÙNG HÌNH DẠNG với lib/repo.js (Postgres), để test api.js và dispatch.js
 * mà không cần cơ sở dữ liệu. Ngữ nghĩa các hàm phải khớp bản Postgres; bản Postgres được kiểm
 * riêng trên Postgres thật (db/smoke.sql và db/test/repo.test.js).
 */
function createFakeRepo(clock = { t: Date.now() }) {
  const now = () => clock.t;
  const users = new Map();       // id -> { id, email, name, pass }
  const sessions = new Map();    // hash -> { userId, expiresAt }
  const states = new Map();      // userId -> { version, data, updatedAt }
  const reminders = [];          // { id, user_id, key, at, title, body, cond, sent_at }
  const subs = [];               // { user_id, endpoint, p256dh, auth }
  const aiUsage = new Map();     // `${userId}|${day}` -> count
  const limits = new Map();      // key -> { start, count }
  let seq = 0;

  const repo = {
    _users: users, _sessions: sessions, _states: states, _reminders: reminders, _subs: subs, _limits: limits,
    async ping() { return true; },

    async createUser({ email, name, passHash }) {
      for (const u of users.values()) if (u.email.toLowerCase() === email.toLowerCase()) {
        throw Object.assign(new Error('email_taken'), { code: 'email_taken' });
      }
      const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
      users.set(id, { id, email, name, pass: passHash });
      return { id, email, name };
    },
    async getUserByEmail(email) {
      for (const u of users.values()) if (u.email.toLowerCase() === email.toLowerCase()) return { ...u };
      return null;
    },
    async getUserPass(id) { return users.has(id) ? users.get(id).pass : null; },
    async deleteUser(id) {
      users.delete(id); states.delete(id);
      for (const [h, s] of sessions) if (s.userId === id) sessions.delete(h);
      for (let i = reminders.length - 1; i >= 0; i--) if (reminders[i].user_id === id) reminders.splice(i, 1);
      for (let i = subs.length - 1; i >= 0; i--) if (subs[i].user_id === id) subs.splice(i, 1);
    },

    async createSession(userId, tokenHash, expiresAtMs) {
      // Map expiry to the fake clock instead of mixing the real clock with clock.t in tests.
      const ttl = expiresAtMs - Date.now();
      sessions.set(tokenHash, { userId, expiresAt: now() + ttl });
    },
    async getSessionUser(tokenHash) {
      const s = sessions.get(tokenHash);
      if (!s || s.expiresAt <= now()) return null;
      const u = users.get(s.userId);
      return u ? { id: u.id, email: u.email, name: u.name } : null;
    },
    async deleteSession(tokenHash) { sessions.delete(tokenHash); },

    async getState(userId) {
      const s = states.get(userId);
      return s ? { version: s.version, data: s.data, updatedAt: s.updatedAt } : null;
    },
    async saveState(userId, baseVersion, data, schedule) {
      const cur = states.get(userId);
      const curV = cur ? cur.version : 0;
      if (baseVersion !== curV) return { ok: false, version: curV, state: cur ? cur.data : null };
      states.set(userId, { version: curV + 1, data, updatedAt: now() });
      if (schedule) {
        const byKey = new Map(schedule.map((r) => [r.key, r]));
        for (let i = reminders.length - 1; i >= 0; i--) {
          const r = reminders[i];
          if (r.user_id === userId && r.sent_at === null && !byKey.has(r.key)) reminders.splice(i, 1);
        }
        for (const r of byKey.values()) {
          const ex = reminders.find((x) => x.user_id === userId && x.key === r.key);
          if (ex) {
            const changed = ex.at !== r.at;
            Object.assign(ex, { at: r.at, title: r.title, body: r.body, cond: r.cond });
            if (changed) ex.sent_at = null;
          } else {
            reminders.push({ id: String(++seq), user_id: userId, key: r.key, at: r.at, title: r.title, body: r.body, cond: r.cond, sent_at: null });
          }
        }
      }
      return { ok: true, version: curV + 1 };
    },

    async upsertPushSub({ userId, endpoint, p256dh, auth }) {
      const ex = subs.find((s) => s.endpoint === endpoint);
      if (ex) Object.assign(ex, { user_id: userId, p256dh, auth });
      else subs.push({ user_id: userId, endpoint, p256dh, auth });
    },
    async deletePushSub(endpoint) { const i = subs.findIndex((s) => s.endpoint === endpoint); if (i >= 0) subs.splice(i, 1); },
    async deletePushSubForUser(userId, endpoint) {
      const i = subs.findIndex((s) => s.endpoint === endpoint && s.user_id === userId); if (i >= 0) subs.splice(i, 1);
    },
    async listSubsForUsers(ids) { return subs.filter((s) => ids.includes(s.user_id)).map((s) => ({ ...s })); },

    async claimDueReminders(limit) {
      const t = now();
      const due = reminders
        .filter((r) => r.sent_at === null && r.at <= t && r.at > t - 30 * 60 * 1000)
        .sort((a, b) => a.at - b.at).slice(0, limit);
      for (const r of due) r.sent_at = t;
      return due.map((r) => ({ id: r.id, user_id: r.user_id, key: r.key, title: r.title, body: r.body, cond: r.cond, at: new Date(r.at) }));
    },
    async usersAsleep(ids) {
      return ids.filter((id) => { const s = states.get(id); return !!(s && s.data.sleep && s.data.sleep.awake === false); });
    },

    async bumpAiUsage(userId, day, limit) {
      const k = `${userId}|${day}`; const c = aiUsage.get(k) || 0;
      if (c >= limit) return { ok: false, count: null };
      aiUsage.set(k, c + 1); return { ok: true, count: c + 1 };
    },
    async hitRateLimit(key, windowSec, max) {
      const t = now(); let e = limits.get(key);
      if (!e || e.start < t - windowSec * 1000) e = { start: t, count: 0 };
      e.count++; limits.set(key, e);
      return { ok: e.count <= max, count: e.count };
    },
    async clearRateLimit(key) { limits.delete(key); },
  };
  return repo;
}

module.exports = { createFakeRepo };
