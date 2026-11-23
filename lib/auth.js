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
const newToken = () => crypto.randomBytes(32).toString('base64url');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = { SESSION_MS, COOKIE, EMAIL_RE, hashPassword, verifyPassword, sha, newToken };
