'use strict';
/**
 * Lớp truy cập dữ liệu của Remi trên Supabase Postgres.
 *
 * - Mọi truy vấn dùng tagged template của postgres.js: THAM SỐ HOÁ, không ghép chuỗi
 *   (an toàn trước SQL injection).
 * - Dùng TÊN BẢNG ĐẦY ĐỦ "remi.<bảng>" vì pooler ở chế độ transaction không giữ search_path.
 * - Tham số có ép kiểu rõ (::bigint, ::uuid[]...) vì với prepare:false kiểu tham số do máy chủ suy ra.
 * - Các hàm khớp "hợp đồng repo" mà lib/api.js và lib/dispatch.js dùng (và test dùng bản giả cùng hình dạng).
 */
const { getSql } = require('./db');

/* ---------------- tiện ích ---------------- */
async function ping() {
  const sql = getSql();
  const r = await sql`select 1 as ok`;
  return r[0].ok === 1;
}

/* ---------------- người dùng ---------------- */
/** Ném lỗi có code 'email_taken' nếu email đã có (không phân biệt hoa thường). */
async function createUser({ email, name, passHash }) {
  const sql = getSql();
  try {
    const rows = await sql`
      insert into remi.users (email, name, pw_hash) values (${email}, ${name}, ${passHash})
      returning id, email, name`;
    return rows[0];
  } catch (e) {
    if (e && e.code === '23505') throw Object.assign(new Error('email_taken'), { code: 'email_taken' });
    throw e;
  }
}

async function getUserByEmail(email) {
  const sql = getSql();
  const rows = await sql`
    select id, email, name, pw_hash as pass from remi.users where lower(email) = lower(${email}) limit 1`;
  return rows[0] || null;
}

async function getUserPass(userId) {
  const sql = getSql();
  const rows = await sql`select pw_hash from remi.users where id = ${userId}::uuid`;
  return rows[0] ? rows[0].pw_hash : null;
}

async function deleteUser(userId) {
  const sql = getSql();
  await sql`delete from remi.users where id = ${userId}::uuid`; // cascade: phiên, trạng thái, thiết bị, lời nhắc, lượt AI
}

/* ---------------- phiên ---------------- */
async function createSession(userId, tokenHash, expiresAtMs, ua) {
  const sql = getSql();
  await sql`
    insert into remi.sessions (token_hash, user_id, expires_at, ua)
    values (${tokenHash}, ${userId}::uuid, to_timestamp(${expiresAtMs}::bigint / 1000.0), ${ua || null})`;
}

/** Trả người dùng của phiên, hoặc null nếu phiên không có/đã hết hạn. */
async function getSessionUser(tokenHash) {
  const sql = getSql();
  const rows = await sql`
    select u.id, u.email, u.name
    from remi.sessions s join remi.users u on u.id = s.user_id
    where s.token_hash = ${tokenHash} and s.expires_at > now() limit 1`;
  return rows[0] || null;
}

async function deleteSession(tokenHash) {
  const sql = getSql();
  await sql`delete from remi.sessions where token_hash = ${tokenHash}`;
}

/* ---------------- dữ liệu người dùng + khoá lạc quan ---------------- */
async function getState(userId) {
  const sql = getSql();
  const rows = await sql`
    select version, data, (extract(epoch from updated_at) * 1000)::float8 as updated_at
    from remi.states where user_id = ${userId}::uuid limit 1`;
  if (!rows[0]) return null;
  return { version: rows[0].version, data: rows[0].data, updatedAt: Math.round(rows[0].updated_at) };
}

/**
 * Ghi trạng thái nếu baseVersion khớp phiên bản hiện tại (0 = chưa có), cùng lịch nhắc, trong MỘT giao dịch.
 * Trả { ok:true, version } hoặc { ok:false, version, state } khi xung đột (API trả 409 kèm bản mới nhất).
 */
async function saveState(userId, baseVersion, data, schedule) {
  const sql = getSql();
  return sql.begin(async (tx) => {
    let rows;
    if (baseVersion === 0) {
      rows = await tx`
        insert into remi.states (user_id, version, data) values (${userId}::uuid, 1, ${tx.json(data)})
        on conflict (user_id) do nothing returning version`;
    } else {
      rows = await tx`
        update remi.states set data = ${tx.json(data)}, version = version + 1, updated_at = now()
        where user_id = ${userId}::uuid and version = ${baseVersion}::int returning version`;
    }
    if (!rows[0]) {
      const cur = await tx`select version, data from remi.states where user_id = ${userId}::uuid`;
      return { ok: false, version: cur[0] ? cur[0].version : 0, state: cur[0] ? cur[0].data : null };
    }
    if (schedule) await applySchedule(tx, userId, schedule);
    return { ok: true, version: rows[0].version };
  });
}

/**
 * Thay trọn bộ lời nhắc sắp tới của một người: upsert danh sách mới, rồi xoá những dòng CHƯA GỬI
 * không còn trong danh sách. Dòng đã gửi được giữ. Đổi giờ (at) thì sent_at về null để nhắc lại;
 * giữ nguyên giờ thì giữ sent_at (không nhắc lại lời nhắc đã gửi).
 */
async function applySchedule(tx, userId, schedule) {
  const byKey = new Map();
  for (const r of schedule) byKey.set(r.key, r); // trùng key: bản sau thắng (Postgres không cho upsert một dòng hai lần)
  const list = [...byKey.values()];
  if (list.length) {
    const rows = list.map((r) => ({
      user_id: userId, key: r.key, at: new Date(r.at), title: r.title, body: r.body || '', cond: r.cond || '',
    }));
    await tx`
      insert into remi.reminders ${tx(rows, 'user_id', 'key', 'at', 'title', 'body', 'cond')}
      on conflict (user_id, key) do update set
        at = excluded.at, title = excluded.title, body = excluded.body, cond = excluded.cond,
        sent_at = case when remi.reminders.at is distinct from excluded.at then null else remi.reminders.sent_at end`;
  }
  const keys = list.map((r) => r.key);
  await tx`
    delete from remi.reminders
    where user_id = ${userId}::uuid and sent_at is null and key not like 'z:%' and key <> all(${tx.array(keys)}::text[])`;
}

/**
 * Nhắc lại: sao chép lời nhắc gốc thành bản "z:<key>" sau `minutes` phút.
 * Trả {at: mili giây} hoặc null nếu không còn lời nhắc gốc.
 */
async function snoozeReminder(userId, key, minutes) {
  const sql = getSql();
  const rows = await sql`
    insert into remi.reminders (user_id, key, at, title, body, cond)
    select user_id, ${'z:' + key}, now() + make_interval(mins => ${minutes}::int), title, body, ''
    from remi.reminders where user_id = ${userId}::uuid and key = ${key}
    on conflict (user_id, key) do update set at = excluded.at, sent_at = null
    returning (extract(epoch from at) * 1000)::float8 as at`;
  return rows.length ? { at: rows[0].at } : null;
}

/* ---------------- thông báo đẩy ---------------- */
async function upsertPushSub({ userId, endpoint, p256dh, auth, ua }) {
  const sql = getSql();
  await sql`
    insert into remi.push_subs (user_id, endpoint, p256dh, auth, ua)
    values (${userId}::uuid, ${endpoint}, ${p256dh}, ${auth}, ${ua || null})
    on conflict (endpoint) do update set
      user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua`;
}

async function deletePushSub(endpoint) {
  const sql = getSql();
  await sql`delete from remi.push_subs where endpoint = ${endpoint}`;
}

async function deletePushSubForUser(userId, endpoint) {
  const sql = getSql();
  await sql`delete from remi.push_subs where user_id = ${userId}::uuid and endpoint = ${endpoint}`;
}

async function listSubsForUsers(userIds) {
  if (!userIds.length) return [];
  const sql = getSql();
  return sql`
    select user_id, endpoint, p256dh, auth from remi.push_subs
    where user_id = any(${sql.array(userIds)}::uuid[])`;
}

/* ---------------- lời nhắc đến hạn ---------------- */
/**
 * Nhận NGUYÊN TỬ các lời nhắc đến hạn (trong cửa sổ 30 phút) và đánh dấu đã gửi.
 * FOR UPDATE SKIP LOCKED: hai lần gọi chồng nhau không bao giờ nhận trùng một dòng.
 */
async function claimDueReminders(limit) {
  const sql = getSql();
  return sql`
    with due as (
      select id from remi.reminders
      where sent_at is null and at <= now() and at > now() - interval '30 minutes'
      order by at limit ${limit}::int for update skip locked
    )
    update remi.reminders r set sent_at = now() from due where r.id = due.id
    returning r.id, r.user_id, r.key, r.title, r.body, r.cond, r.at`;
}

/** Những người đang ngủ (state.sleep.awake === false), cho lời nhắc có điều kiện 'asleep'. */
async function usersAsleep(userIds) {
  if (!userIds.length) return [];
  const sql = getSql();
  const rows = await sql`
    select user_id from remi.states
    where user_id = any(${sql.array(userIds)}::uuid[]) and data -> 'sleep' -> 'awake' = 'false'::jsonb`;
  return rows.map((r) => r.user_id);
}

/** Lời nhắc "kẹt": quá hạn hơn 5 phút mà chưa gửi, vẫn trong cửa sổ 30 phút (để giám sát). */
async function countStuckReminders() {
  const sql = getSql();
  const rows = await sql`
    select count(*)::int as n from remi.reminders
    where sent_at is null and at < now() - interval '5 minutes' and at > now() - interval '30 minutes'`;
  return rows[0].n;
}

/* ---------------- giới hạn ---------------- */
/** Tăng bộ đếm lượt AI nguyên tử, không vượt `limit`. */
async function bumpAiUsage(userId, day, limit) {
  const sql = getSql();
  const rows = await sql`
    with up as (
      insert into remi.ai_usage (user_id, day, count) values (${userId}::uuid, ${day}::date, 1)
      on conflict (user_id, day) do update set count = remi.ai_usage.count + 1
      where remi.ai_usage.count < ${limit}::int
      returning count
    )
    select count from up`;
  return { ok: rows.length > 0, count: rows[0] ? rows[0].count : null };
}

/** Giới hạn tần suất theo cửa sổ: cho phép tối đa `max` lần trong `windowSec` giây cho mỗi key. */
async function hitRateLimit(key, windowSec, max) {
  const sql = getSql();
  const rows = await sql`
    with up as (
      insert into remi.rate_limits (key, window_start, count) values (${key}, now(), 1)
      on conflict (key) do update set
        window_start = case when remi.rate_limits.window_start < now() - (${windowSec}::int * interval '1 second')
                            then now() else remi.rate_limits.window_start end,
        count = case when remi.rate_limits.window_start < now() - (${windowSec}::int * interval '1 second')
                     then 1 else remi.rate_limits.count + 1 end
      returning count
    )
    select count from up`;
  const count = rows[0].count;
  return { ok: count <= max, count };
}

async function clearRateLimit(key) {
  const sql = getSql();
  await sql`delete from remi.rate_limits where key = ${key}`;
}

/** Dọn dữ liệu cũ (hàm SQL remi.housekeeping, cũng được pg_cron gọi hằng đêm). */
async function housekeeping() {
  const sql = getSql();
  const rows = await sql`select remi.housekeeping() as r`;
  return rows[0].r;
}

module.exports = {
  ping, createUser, getUserByEmail, getUserPass, deleteUser,
  createSession, getSessionUser, deleteSession,
  getState, saveState,
  upsertPushSub, deletePushSub, deletePushSubForUser, listSubsForUsers,
  claimDueReminders, snoozeReminder, usersAsleep, countStuckReminders,
  bumpAiUsage, hitRateLimit, clearRateLimit, housekeeping,
};
