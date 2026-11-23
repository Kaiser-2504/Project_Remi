// lib/db.ts — kết nối Supabase Postgres cho môi trường serverless (Người 1 / D1)
//
// Dùng driver postgres.js. Với Vercel (hàm serverless, kết nối ngắn hạn) PHẢI nối qua
// Transaction pooler của Supabase (cổng 6543) và TẮT prepared statements, vì chế độ
// transaction không hỗ trợ chúng. Chuỗi kết nối để trong biến môi trường DATABASE_URL.
//
//   DATABASE_URL="postgres://postgres.<ref>:<mật-khẩu>@aws-<vùng>.pooler.supabase.com:6543/postgres"
//
// Migration (chạy từ máy/CI, không phải từ hàm) dùng kết nối TRỰC TIẾP cổng 5432 — xem db/migrate.mjs.
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Thiếu DATABASE_URL');

// prepare:false là bắt buộc với pooler cổng 6543. Giữ pool nhỏ vì mỗi instance là một tiến trình.
export const sql = postgres(url, {
  prepare: false,
  max: Number(process.env.DB_POOL_MAX ?? 1),
  idle_timeout: 20,
  connect_timeout: 10,
  // Mẹo: dùng một kết nối cho mỗi lần gọi hàm; postgres.js tự quản vòng đời.
});

export type Sql = typeof sql;
