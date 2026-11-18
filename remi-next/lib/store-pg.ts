/**
 * DataStore trên Postgres/Supabase (Người 4 viết phần truy vấn của API; Người 1 sở hữu schema và lib/db.ts).
 *
 * GIẢ ĐỊNH về schema (chuyển 1-1 từ server/db.js sang Postgres, Người 1 cần xác nhận):
 *   states(user_id, version int, data jsonb, updated_at bigint)
 *   reminders(user_id, key, fire_at bigint, title, body, cond, sent int)   khóa chính (user_id, key)
 *   push_subs(id, user_id, endpoint UNIQUE, p256dh, auth, ua, created_at bigint)
 *   ai_usage(user_id, day text, count int)                                   khóa chính (user_id, day)
 * `sql` là client postgres.js (lib/db.ts: pooler 6543, prepare:false).
 */
import { randomUUID } from 'node:crypto';
import type { DataStore } from './ports.ts';
import type { Reminder } from './schemas.ts';

/* Phần của postgres.js mà file này dùng, khai báo tối thiểu để test được bằng bộ chuyển đổi khác. */
export interface Sql {
  (strings: TemplateStringsArray, ...values: any[]): Promise<any[]>;
  begin<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  json(value: unknown): any;
  array(values: any[], type?: string): any;
}

export function createPgStore(sql: Sql): DataStore {
  return {
    async getState(userId) {
      const rows = await sql`SELECT version, data, updated_at FROM states WHERE user_id = ${userId}`;
      if (!rows.length) return null;
      return { version: Number(rows[0].version), state: rows[0].data, updatedAt: Number(rows[0].updated_at) };
    },

    /**
     * Khóa lạc quan ngay trong câu lệnh: UPDATE ... WHERE version = baseVersion.
     * Hai máy ghi cùng lúc thì đúng một máy thắng, kể cả khi chạy trên nhiều hàm serverless song song.
     */
    async putState(userId, baseVersion, state, schedule) {
      return sql.begin(async (tx) => {
        const now = Date.now();
        let version: number | null = null;
        if (baseVersion === 0) {
          const r = await tx`INSERT INTO states(user_id, version, data, updated_at)
            VALUES(${userId}, 1, ${tx.json(state as any)}, ${now}) ON CONFLICT (user_id) DO NOTHING RETURNING version`;
          if (r.length) version = 1;
        } else {
          const r = await tx`UPDATE states SET version = version + 1, data = ${tx.json(state as any)}, updated_at = ${now}
            WHERE user_id = ${userId} AND version = ${baseVersion} RETURNING version`;
          if (r.length) version = Number(r[0].version);
        }
        if (version === null) {
          const cur = await tx`SELECT version, data FROM states WHERE user_id = ${userId}`;
          return { conflict: true as const, version: cur.length ? Number(cur[0].version) : 0, state: cur.length ? cur[0].data : null };
        }
        if (schedule) await syncReminders(tx, userId, schedule);
        return { conflict: false as const, version };
      });
    },

    async upsertSubscription(userId, sub, userAgent) {
      await sql`INSERT INTO push_subs(id, user_id, endpoint, p256dh, auth, ua, created_at)
        VALUES(${randomUUID()}, ${userId}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${userAgent}, ${Date.now()})
        ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua`;
    },

    async deleteSubscription(userId, endpoint) {
      await sql`DELETE FROM push_subs WHERE user_id = ${userId} AND endpoint = ${endpoint}`;
    },

    /** Một câu lệnh duy nhất: chỉ tăng khi còn dưới giới hạn, không có khoảng hở giữa "đọc" và "ghi". */
    async takeAiQuota(userId, day, limit) {
      const r = await sql`INSERT INTO ai_usage(user_id, day, count) VALUES(${userId}, ${day}, 1)
        ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1 WHERE ai_usage.count < ${limit}
        RETURNING count`;
      return r.length > 0;
    },

    async refundAiQuota(userId, day) {
      await sql`UPDATE ai_usage SET count = GREATEST(count - 1, 0) WHERE user_id = ${userId} AND day = ${day}`;
    },
  };
}

/** Thay lịch nhắc chưa gửi của người dùng bằng danh sách mới, bằng hai câu lệnh (không lặp từng dòng). */
async function syncReminders(tx: Sql, userId: string, list: Reminder[]) {
  const keys = list.map((r) => r.key);
  await tx`DELETE FROM reminders WHERE user_id = ${userId} AND sent = 0 AND NOT (key = ANY(${tx.array(keys, 'text')}))`;
  if (!list.length) return;
  await tx`INSERT INTO reminders(user_id, key, fire_at, title, body, cond, sent)
    SELECT ${userId}, x.k, x.a, x.t, x.b, x.c, 0
    FROM unnest(${tx.array(keys, 'text')}, ${tx.array(list.map((r) => r.at), 'bigint')}, ${tx.array(list.map((r) => r.title), 'text')},
                ${tx.array(list.map((r) => r.body), 'text')}, ${tx.array(list.map((r) => r.cond), 'text')}) AS x(k, a, t, b, c)
    ON CONFLICT (user_id, key) DO UPDATE SET fire_at = excluded.fire_at, title = excluded.title, body = excluded.body, cond = excluded.cond
    WHERE reminders.sent = 0`;
}
