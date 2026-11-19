// db/migrate.mjs — chạy mọi file .sql trong db/migrations theo thứ tự tên.
// Dùng KẾT NỐI TRỰC TIẾP (cổng 5432), KHÔNG dùng pooler, vì migration cần
// một phiên ổn định. Chạy từ máy hoặc CI, KHÔNG chạy từ hàm serverless.
//
//   DATABASE_URL_DIRECT="postgres://postgres:<mật-khẩu>@db.<ref>.supabase.co:5432/postgres" \
//     node db/migrate.mjs
//
// Cần: npm i postgres
import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) { console.error('Thiếu DATABASE_URL_DIRECT'); process.exit(1); }
if (url.includes(':6543')) {
  console.error('DATABASE_URL_DIRECT đang trỏ cổng 6543 (pooler). Migration cần cổng 5432 (kết nối trực tiếp).');
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const sql = postgres(url, { prepare: false, max: 1, onnotice: (n) => console.log('  ', n.message) });

try {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    process.stdout.write(`-> ${f} ... `);
    await sql.file(join(dir, f));
    console.log('xong');
  }
  console.log('Migration hoàn tất.');
} catch (e) {
  console.error('Migration LỖI:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
