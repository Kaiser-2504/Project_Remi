/**
 * Chạy NGUYÊN bộ test hợp đồng (contract/api.contract.test.js) với bản chạy độc lập trên Postgres thật.
 * Cần PG_TEST_URL (xem store-pg.test.ts) và các bảng của standalone/schema.sql. Bỏ qua nếu không có.
 * Chạy với --test-concurrency=1 vì dùng chung cơ sở dữ liệu thử với store-pg.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApiServer } from '../standalone/server.ts';
import { createPool } from './psql-sql.ts';

const cfg = process.env.PG_TEST_URL;
const kv = Object.fromEntries((cfg || '').split(/\s+/).filter(Boolean).map((p) => p.split('=')));
const t = cfg ? test : test.skip;

t('bản chạy độc lập trên Postgres thật đạt bộ test hợp đồng', async () => {
  const pool = createPool({ host: kv.host, port: Number(kv.port), db: kv.dbname });
  const app = createApiServer({ sql: pool.sql, env: {}, log: { error() {}, warn() {} } });
  const { port } = await app.listen(0);
  try {
    const file = fileURLToPath(new URL('../../contract/api.contract.test.js', import.meta.url));
    const out: string[] = [];
    const code = await new Promise<number>((resolve) => {
      const env: Record<string, string | undefined> = { ...process.env, BACKEND_URL: `http://127.0.0.1:${port}` };
      delete env.NODE_TEST_CONTEXT; // nếu không, node --test lồng nhau sẽ bị bỏ qua
      const p = spawn(process.execPath, ['--test', file], { env });
      p.stdout.on('data', (d) => out.push(String(d)));
      p.stderr.on('data', (d) => out.push(String(d)));
      p.on('close', (c) => resolve(c ?? 1));
    });
    assert.equal(code, 0, out.join('').split('\n').filter((l) => /not ok|✖|Error|expected|actual/.test(l)).slice(0, 30).join('\n'));
    assert.match(out.join(''), /# pass 2\d/);
  } finally { await app.close(); pool.close(); }
});
