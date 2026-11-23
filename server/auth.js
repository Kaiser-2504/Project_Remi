'use strict';
const crypto = require('node:crypto');
const shared = require('../lib/auth');

const { SESSION_MS, COOKIE, EMAIL_RE, hashPassword, verifyPassword, sha } = shared;

function createSession(db, userId, ua) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions(hash, user_id, created_at, expires_at, ua) VALUES(?,?,?,?,?)')
    .run(sha(token), userId, now, now + SESSION_MS, String(ua || '').slice(0, 200));
  return token;
}

function userFromToken(db, token) {
  if (!token) return null;
  const row = db.prepare(
    'SELECT u.id, u.email, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ?'
  ).get(sha(token));
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, email: row.email, name: row.name };
}

function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE hash = ?').run(sha(token));
}

/** Giới hạn số lần thử trong một khoảng thời gian (trong bộ nhớ). */
class RateLimiter {
  constructor(max, windowMs) {
    this.max = max;
    this.windowMs = windowMs;
    this.m = new Map();
  }
  hit(key) {
    const now = Date.now();
    let e = this.m.get(key);
    if (!e || e.reset < now) {
      e = { count: 0, reset: now + this.windowMs };
      this.m.set(key, e);
    }
    e.count++;
    if (this.m.size > 5000) for (const [k, v] of this.m) if (v.reset < now) this.m.delete(k);
    return e.count <= this.max;
  }
  clear(key) {
    this.m.delete(key);
  }
}

module.exports = {
  COOKIE, SESSION_MS, EMAIL_RE,
  hashPassword, verifyPassword, createSession, userFromToken, destroySession, RateLimiter,
};
