'use strict';
const path = require('node:path');

/** Đọc cấu hình từ biến môi trường. `overrides` dùng cho test. */
function loadConfig(env = process.env, overrides = {}) {
  const root = path.join(__dirname, '..');
  const prod = env.NODE_ENV === 'production';
  const cfg = {
    env: env.NODE_ENV || 'development',
    port: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    dataDir: env.DATA_DIR || path.join(root, 'data'),
    webDir: path.join(root, 'web'),
    secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : prod,
    trustProxy: env.TRUST_PROXY === '1',
    allowRegistration: env.ALLOW_REGISTRATION !== '0',
    // AI (Anthropic). Khóa chỉ nằm ở máy chủ, không bao giờ gửi xuống app.
    anthropicKey: env.ANTHROPIC_API_KEY || '',
    anthropicBase: (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
    // Ưu tiên Gemini (có gói miễn phí) khi đặt GEMINI_API_KEY. AI_MODEL để trống thì dùng model mặc định của nhà cung cấp.
    geminiKey: env.GEMINI_API_KEY || '',
    geminiBase: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
    aiModel: env.AI_MODEL || '',
    aiDailyLimit: Number(env.AI_DAILY_LIMIT) || 60,
    // Thông báo đẩy (Web Push / VAPID). Để trống: tự sinh khóa và lưu trong DB.
    vapidSubject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    vapidPublic: env.VAPID_PUBLIC_KEY || '',
    vapidPrivate: env.VAPID_PRIVATE_KEY || '',
    schedulerMs: Number(env.SCHEDULER_MS) || 15000,
  };
  return Object.assign(cfg, overrides);
}

/** Trả về danh sách vấn đề khiến máy chủ không nên khởi động. */
function validateConfig(cfg) {
  const problems = [];
  if (cfg.env === 'production' && !cfg.anthropicKey && !cfg.geminiKey) {
    problems.push('Thiếu GEMINI_API_KEY hoặc ANTHROPIC_API_KEY. Remi dùng AI để hiểu câu nói của mọi người dùng nên bắt buộc có khóa khi chạy production.');
  }
  return problems;
}

module.exports = { loadConfig, validateConfig };
