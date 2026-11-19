// lib/repo.ts — lớp truy cập dữ liệu của Remi (Người 1 / D1)
//
// Mọi truy vấn dùng tagged template của postgres.js -> THAM SỐ HOÁ, không ghép chuỗi,
// nên an toàn trước SQL injection (đúng nguyên tắc Module 4 của lab).
// Dùng TÊN BẢNG ĐẦY ĐỦ "remi.<bảng>" vì pooler ở chế độ transaction không giữ search_path.
import { sql } from './db';

// ---- Người dùng ---------------------------------------------------------
export async function createUser(email: string, pwHash: string): Promise<{ id: string; email: string }> {
  const rows = await sql<{ id: string; email: string }[]>`
    insert into remi.users (email, pw_hash) values (${email}, ${pwHash})
    returning id, email`;
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<{ id: string; email: string; pw_hash: string } | null> {
  const rows = await sql<{ id: string; email: string; pw_hash: string }[]>`
    select id, email, pw_hash from remi.users where lower(email) = lower(${email}) limit 1`;
  return rows[0] ?? null;
}

// ---- Phiên đăng nhập ----------------------------------------------------
export async function createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await sql`insert into remi.sessions (token_hash, user_id, expires_at)
            values (${tokenHash}, ${userId}, ${expiresAt})`;
}

// Trả null nếu phiên không tồn tại HOẶC đã hết hạn.
export async function getSession(tokenHash: string): Promise<{ user_id: string; expires_at: Date } | null> {
  const rows = await sql<{ user_id: string; expires_at: Date }[]>`
    select user_id, expires_at from remi.sessions
    where token_hash = ${tokenHash} and expires_at > now() limit 1`;
  return rows[0] ?? null;
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await sql`delete from remi.sessions where token_hash = ${tokenHash}`;
}

// ---- Trạng thái + khoá lạc quan ----------------------------------------
export async function getState(userId: string): Promise<{ version: number; data: unknown } | null> {
  const rows = await sql<{ version: number; data: unknown }[]>`
    select version, data from remi.states where user_id = ${userId} limit 1`;
  return rows[0] ?? null;
}

// baseVersion = phiên bản mà client đang giữ. Trả {version} mới nếu ghi được,
// trả null nếu XUNG ĐỘT (phiên bản đã đổi) -> tầng trên trả 409 kèm bản mới nhất.
export async function putState(userId: string, baseVersion: number, data: unknown): Promise<{ version: number } | null> {
  if (!baseVersion) {
    const rows = await sql<{ version: number }[]>`
      insert into remi.states (user_id, version, data) values (${userId}, 1, ${sql.json(data as object)})
      on conflict (user_id) do nothing
      returning version`;
    return rows[0] ?? null;   // null = đã có dòng -> xung đột
  }
  const rows = await sql<{ version: number }[]>`
    update remi.states set data = ${sql.json(data as object)}, version = version + 1, updated_at = now()
    where user_id = ${userId} and version = ${baseVersion}
    returning version`;
  return rows[0] ?? null;      // null = phiên bản lệch -> xung đột
}

// ---- Đăng ký nhận thông báo đẩy ----------------------------------------
export async function upsertPushSub(
  userId: string, sub: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  await sql`
    insert into remi.push_subs (user_id, endpoint, p256dh, auth)
    values (${userId}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth})
    on conflict (endpoint) do update set
      user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`;
}

export async function deletePushSub(endpoint: string): Promise<void> {
  await sql`delete from remi.push_subs where endpoint = ${endpoint}`;
}

export async function listSubsForUsers(
  userIds: string[],
): Promise<{ user_id: string; endpoint: string; p256dh: string; auth: string }[]> {
  if (userIds.length === 0) return [];
  return sql<{ user_id: string; endpoint: string; p256dh: string; auth: string }[]>`
    select user_id, endpoint, p256dh, auth from remi.push_subs
    where user_id = any(${sql.array(userIds)})`;
}

// ---- Lời nhắc -----------------------------------------------------------
type ReminderIn = { key: string; atMs: number; title: string; body?: string };

// Thay thế trọn bộ lời nhắc sắp tới của một người: upsert danh sách mới,
// rồi xoá những dòng CHƯA GỬI không còn trong danh sách. Dòng đã gửi được giữ.
// Đổi giờ (at) thì sent_at về null để nhắc lại; giữ giờ thì giữ nguyên sent_at.
export async function replaceReminders(userId: string, list: ReminderIn[]): Promise<void> {
  await sql.begin(async (tx) => {
    for (const r of list) {
      await tx`
        insert into remi.reminders (user_id, key, at, title, body)
        values (${userId}, ${r.key}, to_timestamp(${r.atMs} / 1000.0), ${r.title}, ${r.body ?? ''})
        on conflict (user_id, key) do update set
          at = excluded.at, title = excluded.title, body = excluded.body,
          sent_at = case when remi.reminders.at is distinct from excluded.at
                         then null else remi.reminders.sent_at end`;
    }
    const keys = list.map((r) => r.key);
    await tx`delete from remi.reminders
             where user_id = ${userId} and sent_at is null and key <> all(${sql.array(keys)})`;
  });
}

// Nhận NGUYÊN TỬ các lời nhắc đến hạn (trong cửa sổ 30 phút), đánh dấu đã gửi.
// FOR UPDATE SKIP LOCKED: hai lần gọi chồng nhau không bao giờ nhận trùng một dòng.
export async function claimDueReminders(
  limit: number,
): Promise<{ id: string; user_id: string; key: string; title: string; body: string; at: Date }[]> {
  return sql<{ id: string; user_id: string; key: string; title: string; body: string; at: Date }[]>`
    with due as (
      select id from remi.reminders
      where sent_at is null and at <= now() and at > now() - interval '30 minutes'
      order by at limit ${limit} for update skip locked
    )
    update remi.reminders r set sent_at = now() from due where r.id = due.id
    returning r.id, r.user_id, r.key, r.title, r.body, r.at`;
}

// Đếm lời nhắc "kẹt": quá hạn hơn 5 phút mà chưa gửi, vẫn trong cửa sổ 30 phút.
export async function countStuckReminders(): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from remi.reminders
    where sent_at is null and at < now() - interval '5 minutes' and at > now() - interval '30 minutes'`;
  return rows[0].n;
}

// ---- Bộ đếm lượt AI (nguyên tử, tôn trọng giới hạn) ---------------------
export async function bumpAiUsage(
  userId: string, day: string, limit: number,
): Promise<{ ok: boolean; count: number | null }> {
  const rows = await sql<{ count: number }[]>`
    with up as (
      insert into remi.ai_usage (user_id, day, count) values (${userId}, ${day}, 1)
      on conflict (user_id, day) do update set count = remi.ai_usage.count + 1
      where remi.ai_usage.count < ${limit}
      returning count
    )
    select count from up`;
  return { ok: rows.length > 0, count: rows[0]?.count ?? null };
}

// ---- Giới hạn tần suất theo cửa sổ trượt --------------------------------
export async function hitRateLimit(
  key: string, windowSec: number, max: number,
): Promise<{ ok: boolean; count: number }> {
  const rows = await sql<{ count: number }[]>`
    with up as (
      insert into remi.rate_limits (key, window_start, count) values (${key}, now(), 1)
      on conflict (key) do update set
        window_start = case when remi.rate_limits.window_start < now() - (${windowSec} * interval '1 second')
                            then now() else remi.rate_limits.window_start end,
        count = case when remi.rate_limits.window_start < now() - (${windowSec} * interval '1 second')
                     then 1 else remi.rate_limits.count + 1 end
      returning count
    )
    select count from up`;
  const count = rows[0].count;
  return { ok: count <= max, count };
}
