// db/run-sql.mjs — chạy một file .sql qua Node (không cần psql, chạy được trên Windows).
//   node --env-file-if-exists=.env db/run-sql.mjs db/verify-rls.sql
// Dùng DATABASE_URL_DIRECT (cổng 5432). Bỏ qua các dòng lệnh riêng của psql (bắt đầu bằng \).
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
const url = process.env.DATABASE_URL_DIRECT;
if (!file) { console.error('Cách dùng: node db/run-sql.mjs <file.sql>'); process.exit(1); }
if (!url) { console.error('Thiếu DATABASE_URL_DIRECT (hãy điền trong file .env).'); process.exit(1); }
if (url.includes(':6543')) { console.error('Cần cổng 5432, không phải 6543 (pooler giao dịch).'); process.exit(1); }

const text = (await readFile(file, 'utf8'))
  .split(/\r?\n/)
  .map((l) => (l.startsWith('\\echo') ? `do $$ begin raise notice ${"'"}${l.replace(/^\\echo\s*/, '').replace(/^'|'$/g, '').replace(/'/g, "''")}${"'"}; end $$;` : l))
  .filter((l) => !l.startsWith('\\'))
  .join('\n');

const sql = postgres(url, { prepare: false, max: 1, onnotice: (n) => console.log(n.message) });
try {
  const res = await sql.unsafe(text).simple();
  const sets = Array.isArray(res) && Array.isArray(res[0]) ? res : [res];
  for (const rows of sets) if (rows.length) console.table(rows);
  console.log('Xong.');
} catch (e) {
  console.error('LỖI:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
