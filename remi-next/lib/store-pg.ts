/**
 * DataStore trên Postgres/Supabase (Người 4 viết phần truy vấn của API; Người 1 sở hữu schema và lib/db.ts).
 *
 * Khớp schema thật remi-db/db/migrations/001_init.sql (mọi bảng nằm trong schema "remi"):
 *   remi.states(user_id uuid, version int, data jsonb, updated_at timestamptz)
 *   remi.reminders(user_id, key, at timestamptz, title, body, sent_at timestamptz)   duy nhất (user_id, key)
 *   remi.push_subs(id identity, user_id, endpoint UNIQUE, p256dh, auth, created_at)
 *   remi.ai_usage(user_id, day date, count int)                                      khóa chính (user_id, day)
 * Schema không có cột `cond` (lời nhắc "asleep") và `ua` (user agent): hai trường này được nhận và kiểm
 * ở lớp Zod nhưng chưa được lưu; cần thì Người 1 thêm cột rồi bổ sung vào đây.
 * `sql` là client postgres.js (lib/db.ts: pooler 6543, prepare:false).
 */
import type { DataStore } from './ports.ts';
import type { Reminder } from './schemas.ts';

/* Phần của postgres.js mà file này dùng, khai báo tối thiểu để test được bằng bộ chuyển đổi khác. */
export interface Sql {
  (strings: TemplateStringsArray, ...values: any[]): Promise<any[]>;
  begin<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  json(value: unknown): any;
}

export function createPgStore(sql: Sql): DataStore {
  return {
    async getState(userId) {
      const rows = await sql`SELECT version, data, (extract(epoch FROM updated_at) * 1000)::bigint AS updated_at
        FROM remi.states WHERE user_id = ${userId}`;
      if (!rows.length) return null;
      return { version: Number(rows[0].version), state: rows[0].data, updatedAt: Number(rows[0].updated_at) };
    },

    /**
     * Khóa lạc quan ngay trong câu lệnh: UPDATE ... WHERE version = baseVersion.
     * Hai máy ghi cùng lúc thì đúng một máy thắng, kể cả khi chạy trên nhiều hàm serverless song song.
     */
    async putState(userId, baseVersion, state, schedule) {
      return sql.begin(async (tx) => {
        let version: number | null = null;
        if (baseVersion === 0) {
          const r = await tx`INSERT INTO remi.states(user_id, version, data, updated_at)
            VALUES(${userId}, 1, ${tx.json(state as any)}, now()) ON CONFLICT (user_id) DO NOTHING RETURNING version`;
          if (r.length) version = 1;
        } else {
          const r = await tx`UPDATE remi.states SET version = version + 1, data = ${tx.json(state as any)}, updated_at = now()
            WHERE user_id = ${userId} AND version = ${baseVersion} RETURNING version`;
          if (r.length) version = Number(r[0].version);
        }
        if (version === null) {
          const cur = await tx`SELECT version, data FROM remi.states WHERE user_id = ${userId}`;
          return { conflict: true as const, version: cur.length ? Number(cur[0].version) : 0, state: cur.length ? cur[0].data : null };
        }
        if (schedule) await syncReminders(tx, userId, schedule);
        return { conflict: false as const, version };
      });
    },

    async upsertSubscription(userId, sub, _userAgent) {
      await sql`INSERT INTO remi.push_subs(user_id, endpoint, p256dh, auth)
        VALUES(${userId}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
        ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`;
    },

    async deleteSubscription(userId, endpoint) {
      await sql`DELETE FROM remi.push_subs WHERE user_id = ${userId} AND endpoint = ${endpoint}`;
    },

    /** Một câu lệnh duy nhất: chỉ tăng khi còn dưới giới hạn, không có khoảng hở giữa "đọc" và "ghi". */
    async takeAiQuota(userId, day, limit) {
      const r = await sql`INSERT INTO remi.ai_usage(user_id, day, count) VALUES(${userId}, ${day}::date, 1)
        ON CONFLICT (user_id, day) DO UPDATE SET count = remi.ai_usage.count + 1 WHERE remi.ai_usage.count < ${limit}
        RETURNING count`;
      return r.length > 0;
    },

    async refundAiQuota(userId, day) {
      await sql`UPDATE remi.ai_usage SET count = GREATEST(count - 1, 0) WHERE user_id = ${userId} AND day = ${day}::date`;
    },
  };
}

/**
 * Thay lịch nhắc chưa gửi của người dùng bằng danh sách mới, bằng hai câu lệnh (không lặp từng dòng).
 * Danh sách đi vào dưới dạng MỘT tham số JSON (`tx.json`), không dùng tham số kiểu mảng: postgres.js v4
 * đã bỏ `sql.array()` và cách truyền mảng thay đổi giữa các phiên bản, còn `sql.json` thì ổn định.
 */
async function syncReminders(tx: Sql, userId: string, list: Reminder[]) {
  const rows = list.map((r) => ({ key: r.key, at: r.at, title: r.title, body: r.body }));
  await tx`DELETE FROM remi.reminders WHERE user_id = ${userId} AND sent_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(${tx.json(rows)}::jsonb) AS x(key text) WHERE x.key = remi.reminders.key)`;
  if (!rows.length) return;
  // Lời nhắc đã gửi: cùng giờ thì giữ nguyên hoàn toàn; đổi giờ thì ghi lại và gửi lại (giống repo.ts của Người 1).
  await tx`INSERT INTO remi.reminders(user_id, key, at, title, body)
    SELECT ${userId}::uuid, x.key, to_timestamp(x.at / 1000.0), x.title, x.body
    FROM jsonb_to_recordset(${tx.json(rows)}::jsonb) AS x(key text, at bigint, title text, body text)
    ON CONFLICT (user_id, key) DO UPDATE SET
      at = excluded.at, title = excluded.title, body = excluded.body,
      sent_at = CASE WHEN remi.reminders.at IS DISTINCT FROM excluded.at THEN NULL ELSE remi.reminders.sent_at END
    WHERE remi.reminders.sent_at IS NULL OR remi.reminders.at IS DISTINCT FROM excluded.at`;
}
