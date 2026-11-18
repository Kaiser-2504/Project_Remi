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
    f.begin = async (fn: (tx: Sql) => Promise<any>) => {
      await run('BEGIN');
      try { const r = await fn(f); await run('COMMIT'); return r; }
      catch (e) { await run('ROLLBACK').catch(() => undefined); throw e; }
    };
    return f;
  };
  return { sql: make(), close: () => p.stdin.end() };
}

/**
 * Nhóm kết nối: mỗi câu lệnh lẻ dùng một kết nối rảnh, còn `begin` giữ nguyên một kết nối từ BEGIN tới COMMIT,
 * nên nhiều yêu cầu đến cùng lúc không trộn lẫn giao dịch (giống `postgres.js`). Chỉ dùng để kiểm thử.
 */
export function createPool(opts: { host: string; port: number; db: string }, size = 6): Conn {
  const conns = Array.from({ length: size }, () => createSql(opts));
  const idle = [...conns];
  const waiting: Array<(c: Conn) => void> = [];
  const acquire = () => new Promise<Conn>((res) => (idle.length ? res(idle.pop()!) : waiting.push(res)));
  const release = (c: Conn) => { const w = waiting.shift(); if (w) w(c); else idle.push(c); };
  const make = (pinned?: Conn): Sql => {
    const f: any = async (strings: TemplateStringsArray, ...vals: any[]) => {
      if (pinned) return pinned.sql(strings, ...vals);
      const c = await acquire();
      try { return await c.sql(strings, ...vals); } finally { release(c); }
    };
    f.json = (v: unknown) => ({ __json: v });
    f.begin = async (fn: (tx: Sql) => Promise<any>) => {
      const c = await acquire();
      try { return await c.sql.begin(fn); } finally { release(c); }
    };
    return f;
  };
  return { sql: make(), close: () => conns.forEach((c) => c.close()) };
}
