'use strict';

/**
 * Đọc cấu hình từ biến môi trường (trên Vercel là Environment Variables).
 * `overrides` dùng cho test. Không có giá trị bí mật nào được ghi cứng ở đây.
 */
function loadConfig(env = process.env, overrides = {}) {
  const prod = env.NODE_ENV === 'production';
  const cfg = {
    env: env.NODE_ENV || 'development',
    secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : prod,
    // Trên Vercel, x-forwarded-for do nền tảng đặt nên tin được. Đặt TRUST_PROXY=0 để tắt.
    trustProxy: env.TRUST_PROXY !== '0',
    allowRegistration: env.ALLOW_REGISTRATION !== '0',
    anthropicKey: env.ANTHROPIC_API_KEY || '',
    anthropicBase: (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
    // Ưu tiên Gemini (có gói miễn phí) khi đặt GEMINI_API_KEY. AI_MODEL để trống thì dùng model mặc định của nhà cung cấp.
    geminiKey: env.GEMINI_API_KEY || '',
    geminiBase: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
    aiModel: env.AI_MODEL || '',
    aiDailyLimit: Number(env.AI_DAILY_LIMIT) || 60,
    vapidSubject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    vapidPublic: env.VAPID_PUBLIC_KEY || '',
    vapidPrivate: env.VAPID_PRIVATE_KEY || '',
    cronSecret: env.CRON_SECRET || '',
    dispatchBatch: Number(env.DISPATCH_BATCH) || 50,
    dispatchBudgetMs: Number(env.DISPATCH_TIME_BUDGET_MS) || 8000,
  };
  return Object.assign(cfg, overrides);
}

module.exports = { loadConfig };
