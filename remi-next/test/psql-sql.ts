/**
 * Bộ chuyển đổi chỉ dùng cho TEST: cho store-pg.ts chạy trên Postgres thật qua tiến trình `psql`
 * khi chưa cài gói `postgres` (postgres.js). Mỗi lần gọi createSql() là một kết nối riêng, nên test
 * hai kết nối ghi cùng lúc kiểm tra được khóa lạc quan thật sự.
 */
import { spawn } from 'node:child_process';
import type { Sql } from '../lib/store-pg.ts';

const END = '@@END@@';
const lit = (v: any): string => {
  if (v && v.__json !== undefined) return `'${JSON.stringify(v.__json).replace(/'/g, "''")}'::jsonb`;
  if (v && v.__arr) return `ARRAY[${v.__arr.map(lit).join(',')}]::${v.__type}[]`;
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

export interface Conn { sql: Sql; close(): void }

export function createSql(opts: { host: string; port: number; db: string }): Conn {
  const p = spawn('psql', ['-h', opts.host, '-p', String(opts.port), '-U', 'postgres', '-d', opts.db, '-At', '-q', '-v', 'ON_ERROR_STOP=0'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  let err = '';
  let waiter: null | ((s: { out: string; err: string }) => void) = null;
  p.stdout.on('data', (d) => { buf += d; check(); });
  p.stderr.on('data', (d) => { err += d; check(); });
  function check() {
    const i = buf.indexOf(END);
    if (i >= 0 && waiter) {
      const out = buf.slice(0, i); buf = buf.slice(i + END.length + 1);
      const w = waiter; waiter = null; const e = err; err = ''; w({ out, err: e });
    }
  }
  let queue: Promise<any> = Promise.resolve();
  const run = (sqlText: string) => {
    const job = queue.then(() => new Promise<any[]>((resolve, reject) => {
      waiter = ({ out, err: e }) => {
        if (/ERROR/.test(e)) return reject(new Error(e.trim()));
        const t = out.trim();
        resolve(t ? JSON.parse(t) : []);
      };
      const returning = /\bRETURNING\b/i.test(sqlText);
      const isSelect = /^\s*(SELECT|WITH)\b/i.test(sqlText);
      const body = returning
        ? `WITH q AS (${sqlText.trim().replace(/;$/, '')}) SELECT coalesce(json_agg(q), '[]'::json) FROM q;`
        : isSelect ? `SELECT coalesce(json_agg(q), '[]'::json) FROM (${sqlText.trim().replace(/;$/, '')}) q;` : sqlText.trim().replace(/;?$/, ';');
      p.stdin.write(body + `\n\\echo ${END}\n`);
    }));
    queue = job.catch(() => undefined);
    return job;
  };
  const make = (): Sql => {
    const f: any = (strings: TemplateStringsArray, ...vals: any[]) =>
      run(strings.reduce((acc, s, i) => acc + s + (i < vals.length ? lit(vals[i]) : ''), ''));
    f.json = (v: unknown) => ({ __json: v });
    f.array = (values: any[], type = 'text') => ({ __arr: values, __type: type });
    f.begin = async (fn: (tx: Sql) => Promise<any>) => {
      await run('BEGIN');
      try { const r = await fn(f); await run('COMMIT'); return r; }
      catch (e) { await run('ROLLBACK').catch(() => undefined); throw e; }
    };
    return f;
  };
  return { sql: make(), close: () => p.stdin.end() };
}
