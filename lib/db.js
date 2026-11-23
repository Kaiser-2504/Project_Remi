'use strict';
/**
 * Kết nối Supabase Postgres cho môi trường serverless (Vercel).
 *
 * - DATABASE_URL PHẢI là Transaction pooler của Supabase (cổng 6543) và tắt prepared statements
 *   (prepare:false), vì chế độ transaction của pooler không hỗ trợ chúng.
 * - Tạo kết nối LƯỜI ở lần dùng đầu tiên, không phải lúc nạp module, để `next build` chạy được
 *   khi chưa có biến môi trường.
 * - Giữ pool nhỏ (mỗi instance hàm là một tiến trình riêng).
 * - Migration KHÔNG đi qua đây: dùng kết nối trực tiếp (xem db/migrate.mjs).
 */
let client = null;

function getSql() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL (chuỗi Transaction pooler của Supabase, cổng 6543).');
  const postgres = require('postgres');
  client = postgres(url, {
    prepare: false,
    max: Number(process.env.DB_POOL_MAX || 1),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return client;
}

/** Đóng kết nối (dùng trong test). */
async function closeSql() {
  if (client) { const c = client; client = null; await c.end({ timeout: 5 }); }
}

module.exports = { getSql, closeSql };
