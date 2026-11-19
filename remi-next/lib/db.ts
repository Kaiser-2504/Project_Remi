// lib/db.ts — kết nối Supabase Postgres cho môi trường serverless (Người 1 / D1)
//
// Dùng driver postgres.js. Với Vercel (hàm serverless, kết nối ngắn hạn) PHẢI nối qua
// Transaction pooler của Supabase (cổng 6543) và TẮT prepared statements, vì chế độ
// transaction không hỗ trợ chúng. Chuỗi kết nối để trong biến môi trường DATABASE_URL.
//
//   DATABASE_URL="postgres://postgres.<ref>:<mật-khẩu>@aws-<vùng>.pooler.supabase.com:6543/postgres"
//
// Migration (chạy từ máy/CI, không phải từ hàm) dùng kết nối TRỰC TIẾP cổng 5432 — xem remi-db/db/migrate.mjs.
//
// Kết nối được tạo LƯỜI (lần đầu có câu lệnh): `next build` nạp mọi route để thu thập thông tin, lúc đó
// có thể chưa có DATABASE_URL, nên không được ném lỗi khi chỉ import file này.
import postgres from 'postgres';

export type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;

function getClient(): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL');
  // prepare:false là bắt buộc với pooler cổng 6543. Giữ pool nhỏ vì mỗi instance là một tiến trình.
  client = postgres(url, {
    prepare: false,
    max: Number(process.env.DB_POOL_MAX ?? 1),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return client;
}

// `sql` dùng như client postgres.js bình thường: sql`...`, sql.begin(...), sql.json(...).
export const sql: Sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_target, _this, args) => (getClient() as any)(...args),
  get: (_target, prop) => (getClient() as any)[prop],
}) as Sql;
