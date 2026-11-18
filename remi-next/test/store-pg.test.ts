/**
 * Chạy store-pg.ts trên Postgres THẬT với schema của remi-next/standalone/schema.sql (có khóa ngoại tới users).
 * Bỏ qua nếu không đặt PG_TEST_URL, ví dụ:
 *   PG_TEST_URL="host=/tmp/pg port=5439 dbname=remitest"
 * (chỉ dùng cho kiểm thử cục bộ; xoá sạch bảng users và mọi bảng liên quan trong DB thử đó)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPgStore } from '../lib/store-pg.ts';
import { createSql } from './psql-sql.ts';

const cfg = process.env.PG_TEST_URL;
const t = cfg ? test : test.skip;
const kv = Object.fromEntries((cfg || '').split(/\s+/).filter(Boolean).map((p) => p.split('=')));
const conn = () => createSql({ host: kv.host, port: Number(kv.port), db: kv.dbname });
// Dọn bảng thử trước mỗi lần chạy để test lặp lại được. CHỈ trỏ PG_TEST_URL vào cơ sở dữ liệu thử, không bao giờ vào dữ liệu thật.
test.before(async () => {
  if (!cfg) return;
  const c = conn();
  await c.sql`TRUNCATE users CASCADE`; // kéo theo mọi bảng có khóa ngoại tới users (schema thật có ON DELETE CASCADE)
  const ids = ['u-a', 'u-r', 'u-r2', 'u-sqli', 'u-ai', 'u-ai2', 'u-floor', 'u-nobody', 'u-p', 'u-khac', ...Array.from({ length: 10 }, (_, i) => 'u-race' + i)];
  for (const id of ids) await c.sql`INSERT INTO users(id, email, name, pass, created_at) VALUES(${id}, ${id + '@test.local'}, ${id}, 'x', 1)`;
  c.close();
});
const rem = (key: string, at = 1000, extra = {}) => ({ key, at, title: 'T' + key, body: '', cond: '' as const, ...extra });

t('postgres: khóa lạc quan, bản cũ nhận xung đột kèm dữ liệu mới', async () => {
  const c = conn(); const s = createPgStore(c.sql);
  try {
    assert.equal(await s.getState('u-a'), null);
    assert.deepEqual(await s.putState('u-a', 0, { n: 1 }, null), { conflict: false, version: 1 });
    assert.deepEqual(await s.putState('u-a', 0, { n: 'cũ' }, null), { conflict: true, version: 1, state: { n: 1 } });
    assert.deepEqual(await s.putState('u-a', 1, { n: 2 }, null), { conflict: false, version: 2 });
    assert.deepEqual(await s.putState('u-a', 5, { n: 'xa' }, null), { conflict: true, version: 2, state: { n: 2 } });
    const row = await s.getState('u-a');
    assert.equal(row!.version, 2); assert.deepEqual(row!.state, { n: 2 }); assert.ok(row!.updatedAt > 1e12);
    assert.equal(await s.getState('u-khac'), null); // dữ liệu mỗi người tách biệt
  } finally { c.close(); }
});

t('postgres: hai kết nối ghi CÙNG LÚC với cùng baseVersion thì đúng một bên thắng', async () => {
  const c1 = conn(), c2 = conn();
  const s1 = createPgStore(c1.sql), s2 = createPgStore(c2.sql);
  try {
    for (let round = 0; round < 10; round++) {
      const u = 'u-race' + round;
      const [a, b] = await Promise.all([s1.putState(u, 0, { w: 'A' }, null), s2.putState(u, 0, { w: 'B' }, null)]);
      assert.equal([a, b].filter((r) => !r.conflict).length, 1, 'vòng ' + round);
      const loser = [a, b].find((r) => r.conflict) as any;
      assert.equal(loser.version, 1);
    }
  } finally { c1.close(); c2.close(); }
});

t('postgres: đồng bộ lịch nhắc thay thế danh sách, không đụng tới lời nhắc đã gửi, cùng giao dịch với state', async () => {
  const c = conn(); const s = createPgStore(c.sql);
  const rows = async (u: string) => c.sql`SELECT key, fire_at, title, sent FROM reminders WHERE user_id = ${u} ORDER BY key`;
  try {
    await s.putState('u-r', 0, {}, [rem('a'), rem('b'), rem('c')]);
    assert.deepEqual((await rows('u-r')).map((r) => r.key), ['a', 'b', 'c']);
    await c.sql`UPDATE reminders SET sent = 1 WHERE user_id = 'u-r' AND key = 'a'`;
    await s.putState('u-r', 1, {}, [rem('b', 2000, { title: 'Mới' }), rem('d')]); // bỏ a (đã gửi), c; sửa b; thêm d
    const after = await rows('u-r');
    assert.deepEqual(after.map((r) => r.key), ['a', 'b', 'd']); // a đã gửi nên giữ nguyên, c bị xoá
    assert.equal(Number(after[1].fire_at), 2000); assert.equal(after[1].title, 'Mới');
    assert.equal(after[0].sent, 1);
    await s.putState('u-r', 2, {}, [rem('a', 9999, { title: 'Sửa a đã gửi' })]); // không được ghi đè lời nhắc đã gửi
    assert.equal((await rows('u-r')).find((r) => r.key === 'a')!.title, 'Ta');
    await s.putState('u-r', 3, {}, []); // danh sách rỗng: xoá hết lời nhắc chưa gửi
    assert.deepEqual((await rows('u-r')).map((r) => r.key), ['a']);
    await s.putState('u-r', 4, {}, null); // null: không đụng tới lịch nhắc
    assert.equal((await rows('u-r')).length, 1);
    // xung đột thì lịch nhắc KHÔNG bị đổi
    const bad = await s.putState('u-r', 0, {}, [rem('zzz')]);
    assert.equal(bad.conflict, true);
    assert.ok(!(await rows('u-r')).some((r) => r.key === 'zzz'));
    // người khác có cùng key lịch nhắc không bị ảnh hưởng
    await s.putState('u-r2', 0, {}, [rem('a', 1, { title: 'của người khác' })]);
    assert.equal((await rows('u-r')).find((r) => r.key === 'a')!.title, 'Ta');
  } finally { c.close(); }
});

t('postgres: tiêu đề có dấu nháy, tiếng Việt và ký tự lạ lưu đúng (không bị chèn SQL)', async () => {
  const c = conn(); const s = createPgStore(c.sql);
  try {
    const title = "Họp 'nhóm'; DROP TABLE states;-- ☕";
    await s.putState('u-sqli', 0, { ghiChu: title }, [rem('k', 1, { title })]);
    assert.equal((await s.getState('u-sqli'))!.state && ((await s.getState('u-sqli'))!.state as any).ghiChu, title);
    assert.equal((await c.sql`SELECT title FROM reminders WHERE user_id = 'u-sqli'`)[0].title, title);
    assert.ok((await c.sql`SELECT count(*)::int AS n FROM states`)[0].n > 0); // bảng vẫn còn
  } finally { c.close(); }
});

t('postgres: bộ đếm AI chỉ tăng khi còn dưới giới hạn, hoàn lượt không xuống dưới 0, hai kết nối không vượt giới hạn', async () => {
  const c1 = conn(), c2 = conn();
  const s1 = createPgStore(c1.sql), s2 = createPgStore(c2.sql);
  try {
    assert.equal(await s1.takeAiQuota('u-ai', '2026-11-04', 2), true);
    assert.equal(await s1.takeAiQuota('u-ai', '2026-11-04', 2), true);
    assert.equal(await s1.takeAiQuota('u-ai', '2026-11-04', 2), false);
    assert.equal(await s1.takeAiQuota('u-ai', '2026-11-05', 2), true); // ngày mới
    await s1.refundAiQuota('u-ai', '2026-11-04');
    assert.equal(await s1.takeAiQuota('u-ai', '2026-11-04', 2), true);
    await s1.takeAiQuota('u-floor', '2026-11-04', 5);
    await s1.refundAiQuota('u-floor', '2026-11-04');
    await s1.refundAiQuota('u-floor', '2026-11-04'); // hoàn thừa không được xuống dưới 0
    assert.equal((await c1.sql`SELECT count FROM ai_usage WHERE user_id = 'u-floor'`)[0].count, 0);
    await s1.refundAiQuota('u-nobody', '2026-11-04');
    assert.equal((await c1.sql`SELECT count FROM ai_usage WHERE user_id = 'u-nobody'`).length, 0);
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? s1 : s2).takeAiQuota('u-ai2', '2026-11-04', 3)));
    assert.equal(results.filter(Boolean).length, 3);
  } finally { c1.close(); c2.close(); }
});

t('postgres: đăng ký thiết bị: cùng endpoint thì cập nhật, huỷ chỉ huỷ của chính mình', async () => {
  const c = conn(); const s = createPgStore(c.sql);
  const n = async () => (await c.sql`SELECT count(*)::int AS n FROM push_subs WHERE endpoint = 'https://push.example/e1'`)[0].n;
  try {
    const sub = { endpoint: 'https://push.example/e1', keys: { p256dh: 'p1', auth: 'a1' } };
    await s.upsertSubscription('u-p', sub, "UA 'lạ'");
    await s.upsertSubscription('u-p', { ...sub, keys: { p256dh: 'p2', auth: 'a2' } }, 'UA2');
    assert.equal(await n(), 1);
    assert.equal((await c.sql`SELECT p256dh FROM push_subs WHERE endpoint = 'https://push.example/e1'`)[0].p256dh, 'p2');
    await s.deleteSubscription('u-khac', sub.endpoint);
    assert.equal(await n(), 1);
    await s.deleteSubscription('u-p', sub.endpoint);
    assert.equal(await n(), 0);
  } finally { c.close(); }
});
