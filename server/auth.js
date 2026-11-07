'use strict';
const crypto = require('node:crypto');

const SESSION_MS = 30 * 24 * 3600 * 1000;
const COOKIE = 'remi_session';
const N = 16384, R = 8, P = 1, KEYLEN = 64;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, KEYLEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), h.toString('base64')].join('$');
}

function verifyPassword(pw, stored) {
  try {
    const [alg, n, r, p, s, h] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(h, 'base64');
    const got = crypto.scryptSync(pw, Buffer.from(s, 'base64'), want.length, { N: +n, r: +r, p: +p });
    return crypto.timingSafeEqual(got, want);
  } catch {
    return false;
  }
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = {
  COOKIE, SESSION_MS, EMAIL_RE,
  hashPassword, verifyPassword, createSession, userFromToken, destroySession, RateLimiter,
};
