/**
 * Chạy store-pg.ts trên Postgres THẬT với schema của Người 1 (remi-db/db/migrations/001_init.sql, schema "remi", có khóa ngoại tới remi.users).
 * Bỏ qua nếu không đặt PG_TEST_URL, ví dụ:
 *   PG_TEST_URL="host=/tmp/pg port=5439 dbname=remitest"
 * (chỉ dùng cho kiểm thử cục bộ; xoá sạch bảng users và mọi bảng liên quan trong DB thử đó)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPgStore } from '../lib/store-pg.ts';
import { createSql } from './psql-sql.ts';

// Id người dùng thật là uuid: sinh ổn định từ tên để test đọc được.
const U = (name: string) => createHash('md5').update(name).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
const cfg = process.env.PG_TEST_URL;
const t = cfg ? test : test.skip;
const kv = Object.fromEntries((cfg || '').split(/\s+/).filter(Boolean).map((p) => p.split('=')));
const conn = () => createSql({ host: kv.host, port: Number(kv.port), db: kv.dbname });
// Dọn bảng thử trước mỗi lần chạy để test lặp lại được. CHỈ trỏ PG_TEST_URL vào cơ sở dữ liệu thử, không bao giờ vào dữ liệu thật.
test.before(async () => {
  if (!cfg) return;
  const c = conn();
  await c.sql`TRUNCATE remi.users CASCADE`; // kéo theo mọi bảng có khóa ngoại tới users (schema thật có ON DELETE CASCADE)
  const ids = ['u-a', 'u-r', 'u-r2', 'u-sqli', 'u-ai', 'u-ai2', 'u-floor', 'u-nobody', 'u-p', 'u-khac', ...Array.from({ length: 10 }, (_, i) => 'u-race' + i)];
  for (const id of ids) await c.sql`INSERT INTO remi.users(id, email, pw_hash) VALUES(${U(id)}, ${id + '@test.local'}, 'x')`;
  c.close();
});
const rem = (key: string, at = 1000, extra = {}) => ({ key, at, title: 'T' + key, body: '', cond: '' as const, ...extra });

t('postgres: khóa lạc quan, bản cũ nhận xung đột kèm dữ liệu mới', async () => {
  const c = conn(); const s = createPgStore(c.sql);
  try {
    assert.equal(await s.getState(U('u-a')), null);
    assert.deepEqual(await s.putState(U('u-a'), 0, { n: 1 }, null), { conflict: false, version: 1 });
    assert.deepEqual(await s.putState(U('u-a'), 0, { n: 'cũ' }, null), { conflict: true, version: 1, state: { n: 1 } });
    assert.deepEqual(await s.putState(U('u-a'), 1, { n: 2 }, null), { conflict: false, version: 2 });
    assert.deepEqual(await s.putState(U('u-a'), 5, { n: 'xa' }, null), { conflict: true, version: 2, state: { n: 2 } });
    const row = await s.getState(U('u-a'));
    assert.equal(row!.version, 2); assert.deepEqual(row!.state, { n: 2 }); assert.ok(row!.updatedAt > 1e12);
    assert.equal(await s.getState(U('u-khac')), null); // dữ liệu mỗi người tách biệt
  } finally { c.close(); }
});

t('postgres: hai kết nối ghi CÙNG LÚC với cùng baseVersion thì đúng một bên thắng', async () => {
  const c1 = conn(), c2 = conn();
  const s1 = createPgStore(c1.sql), s2 = createPgStore(c2.sql);
  try {
    for (let round = 0; round < 10; round++) {
      const u = U('u-race' + round);
      const [a, b] = await Promise.all([s1.putState(u, 0, { w: 'A' }, null), s2.putState(u, 0, { w: 'B' }, null)]);
      assert.equal([a, b].filter((r) => !r.conflict).length, 1, 'vòng ' + round);
      const loser = [a, b].find((r) => r.conflict) as any;
      assert.equal(loser.version, 1);
    }
  } finally { c1.close(); c2.close(); }
});

t('postgres: đồng bộ lịch nhắc thay thế danh sách, không đụng tới lời nhắc đã gửi, cùng giao dịch với state', async () => {
  const c = conn(); const s = createPgStore(c.sql);
  const rows = async (u: string) => c.sql`SELECT key, (extract(epoch FROM at) * 1000)::bigint AS fire_at, title, (sent_at IS NOT NULL)::int AS sent FROM remi.reminders WHERE user_id = ${u} ORDER BY key`;
  try {
    await s.putState(U('u-r'), 0, {}, [rem('a'), rem('b'), rem('c')]);
    assert.deepEqual((await rows(U('u-r'))).map((r) => r.key), ['a', 'b', 'c']);
    await c.sql`UPDATE remi.reminders SET sent_at = now() WHERE user_id = ${U('u-r')} AND key = 'a'`;
    await s.putState(U('u-r'), 1, {}, [rem('b', 2000, { title: 'Mới' }), rem('d')]); // bỏ a (đã gửi), c; sửa b; thêm d
    const after = await rows(U('u-r'));
    assert.deepEqual(after.map((r) => r.key), ['a', 'b', 'd']); // a đã gửi nên giữ nguyên, c bị xoá
    assert.equal(Number(after[1].fire_at), 2000); assert.equal(after[1].title, 'Mới');
    assert.equal(after[0].sent, 1);
    await s.putState(U('u-r'), 2, {}, [rem('a', 1000, { title: 'Sửa a đã gửi' })]); // cùng giờ: không được ghi đè lời nhắc đã gửi
    assert.equal((await rows(U('u-r'))).find((r) => r.key === 'a')!.title, 'Ta');
    assert.equal((await rows(U('u-r'))).find((r) => r.key === 'a')!.sent, 1);
    await s.putState(U('u-r'), 3, {}, [rem('a', 9999, { title: 'Đổi giờ' })]); // đổi giờ: ghi lại và được gửi lại
    const moved = (await rows(U('u-r'))).find((r) => r.key === 'a')!;
    assert.equal(moved.title, 'Đổi giờ'); assert.equal(Number(moved.fire_at), 9999); assert.equal(moved.sent, 0);
    await c.sql`UPDATE remi.reminders SET sent_at = now() WHERE user_id = ${U('u-r')} AND key = 'a'`;
    await s.putState(U('u-r'), 4, {}, []); // danh sách rỗng: xoá hết lời nhắc chưa gửi
    assert.deepEqual((await rows(U('u-r'))).map((r) => r.key), ['a']);
    await s.putState(U('u-r'), 5, {}, null); // null: không đụng tới lịch nhắc
    assert.equal((await rows(U('u-r'))).length, 1);
    // xung đột thì lịch nhắc KHÔNG bị đổi
    const bad = await s.putState(U('u-r'), 0, {}, [rem('zzz')]);
    assert.equal(bad.conflict, true);
    assert.ok(!(await rows(U('u-r'))).some((r) => r.key === 'zzz'));
    // người khác có cùng key lịch nhắc không bị ảnh hưởng
    await s.putState(U('u-r2'), 0, {}, [rem('a', 1, { title: 'của người khác' })]);
    assert.equal((await rows(U('u-r'))).find((r) => r.key === 'a')!.title, 'Đổi giờ');
  } finally { c.close(); }
});

t('postgres: tiêu đề có dấu nháy, tiếng Việt và ký tự lạ lưu đúng (không bị chèn SQL)', async () => {
  const c = conn(); const s = createPgStore(c.sql);
  try {
    const title = "Họp 'nhóm'; DROP TABLE remi.states;-- ☕";
    await s.putState(U('u-sqli'), 0, { ghiChu: title }, [rem('k', 1, { title })]);
    assert.equal((await s.getState(U('u-sqli')))!.state && ((await s.getState(U('u-sqli')))!.state as any).ghiChu, title);
    assert.equal((await c.sql`SELECT title FROM remi.reminders WHERE user_id = ${U('u-sqli')}`)[0].title, title);
    assert.ok((await c.sql`SELECT count(*)::int AS n FROM remi.states`)[0].n > 0); // bảng vẫn còn
  } finally { c.close(); }
});

t('postgres: bộ đếm AI chỉ tăng khi còn dưới giới hạn, hoàn lượt không xuống dưới 0, hai kết nối không vượt giới hạn', async () => {
  const c1 = conn(), c2 = conn();
  const s1 = createPgStore(c1.sql), s2 = createPgStore(c2.sql);
  try {
    assert.equal(await s1.takeAiQuota(U('u-ai'), '2026-11-04', 2), true);
    assert.equal(await s1.takeAiQuota(U('u-ai'), '2026-11-04', 2), true);
    assert.equal(await s1.takeAiQuota(U('u-ai'), '2026-11-04', 2), false);
    assert.equal(await s1.takeAiQuota(U('u-ai'), '2026-11-05', 2), true); // ngày mới
    await s1.refundAiQuota(U('u-ai'), '2026-11-04');
    assert.equal(await s1.takeAiQuota(U('u-ai'), '2026-11-04', 2), true);
    await s1.takeAiQuota(U('u-floor'), '2026-11-04', 5);
    await s1.refundAiQuota(U('u-floor'), '2026-11-04');
    await s1.refundAiQuota(U('u-floor'), '2026-11-04'); // hoàn thừa không được xuống dưới 0
    assert.equal((await c1.sql`SELECT count FROM remi.ai_usage WHERE user_id = ${U('u-floor')}`)[0].count, 0);
    await s1.refundAiQuota(U('u-nobody'), '2026-11-04');
    assert.equal((await c1.sql`SELECT count FROM remi.ai_usage WHERE user_id = ${U('u-nobody')}`).length, 0);
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? s1 : s2).takeAiQuota(U('u-ai2'), '2026-11-04', 3)));
    assert.equal(results.filter(Boolean).length, 3);
  } finally { c1.close(); c2.close(); }
});

t('postgres: đăng ký thiết bị: cùng endpoint thì cập nhật, huỷ chỉ huỷ của chính mình', async () => {
  const c = conn(); const s = createPgStore(c.sql);
  const n = async () => (await c.sql`SELECT count(*)::int AS n FROM remi.push_subs WHERE endpoint = 'https://push.example/e1'`)[0].n;
  try {
    const sub = { endpoint: 'https://push.example/e1', keys: { p256dh: 'p1', auth: 'a1' } };
    await s.upsertSubscription(U('u-p'), sub, "UA 'lạ'");
    await s.upsertSubscription(U('u-p'), { ...sub, keys: { p256dh: 'p2', auth: 'a2' } }, 'UA2');
    assert.equal(await n(), 1);
    assert.equal((await c.sql`SELECT p256dh FROM remi.push_subs WHERE endpoint = 'https://push.example/e1'`)[0].p256dh, 'p2');
    await s.deleteSubscription(U('u-khac'), sub.endpoint);
    assert.equal(await n(), 1);
    await s.deleteSubscription(U('u-p'), sub.endpoint);
    assert.equal(await n(), 0);
  } finally { c.close(); }
});
