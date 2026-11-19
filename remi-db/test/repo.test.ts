// test/repo.test.ts — kiểm thử tích hợp lớp dữ liệu với Postgres THẬT.
// Chạy: DATABASE_URL="<kết nối tới DB thử>" node --import tsx --test test/repo.test.ts
// (hoặc dùng vitest). KHÔNG trỏ vào DB production.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../lib/db';
import * as repo from '../lib/repo';

async function freshUser(email: string) {
  await sql`delete from remi.users where lower(email) = lower(${email})`;
  return repo.createUser(email, 'hash');
}

test('tạo và tìm người dùng, email không phân biệt hoa thường', async () => {
  const u = await freshUser('Test1@x.vn');
  const found = await repo.getUserByEmail('test1@X.VN');
  assert.equal(found?.id, u.id);
});

test('phiên hết hạn trả null', async () => {
  const u = await freshUser('Test2@x.vn');
  await repo.createSession(u.id, 'tok-old', new Date(Date.now() - 1000));
  assert.equal(await repo.getSession('tok-old'), null);
  await repo.createSession(u.id, 'tok-new', new Date(Date.now() + 60000));
  assert.equal((await repo.getSession('tok-new'))?.user_id, u.id);
});

test('khoá lạc quan: base đúng lên version, base lệch trả null (409)', async () => {
  const u = await freshUser('Test3@x.vn');
  assert.equal((await repo.putState(u.id, 0, { a: 1 }))?.version, 1);
  assert.equal((await repo.putState(u.id, 1, { a: 2 }))?.version, 2);
  assert.equal(await repo.putState(u.id, 1, { a: 9 }), null); // base cũ -> xung đột
});

test('replaceReminders: đổi giờ reset sent_at, giữ giờ thì giữ, xoá dòng chưa gửi không còn', async () => {
  const u = await freshUser('Test4@x.vn');
  const at = Date.UTC(2026, 10, 18, 1, 0);
  await repo.replaceReminders(u.id, [{ key: 'k', atMs: at, title: 'a' }]);
  await sql`update remi.reminders set sent_at = now() where user_id = ${u.id} and key = 'k'`;
  await repo.replaceReminders(u.id, [{ key: 'k', atMs: at, title: 'a2' }]); // giữ giờ
  let row = (await sql`select sent_at from remi.reminders where user_id=${u.id} and key='k'`)[0];
  assert.ok(row.sent_at, 'giữ giờ phải giữ sent_at');
  await repo.replaceReminders(u.id, [{ key: 'k', atMs: at + 3600000, title: 'a3' }]); // đổi giờ
  row = (await sql`select sent_at from remi.reminders where user_id=${u.id} and key='k'`)[0];
  assert.equal(row.sent_at, null, 'đổi giờ phải reset sent_at');
});

test('claimDueReminders chỉ lấy dòng đến hạn trong cửa sổ', async () => {
  const u = await freshUser('Test5@x.vn');
  const now = Date.now();
  await repo.replaceReminders(u.id, [
    { key: 'due', atMs: now - 60000, title: 'a' },
    { key: 'future', atMs: now + 600000, title: 'b' },
    { key: 'stale', atMs: now - 40 * 60000, title: 'c' },
  ]);
  const got = await repo.claimDueReminders(50);
  const keys = got.filter((r) => r.user_id === u.id).map((r) => r.key);
  assert.deepEqual(keys, ['due']);
});

test('bumpAiUsage chặn khi đạt giới hạn', async () => {
  const u = await freshUser('Test6@x.vn');
  const day = new Date().toISOString().slice(0, 10);
  assert.equal((await repo.bumpAiUsage(u.id, day, 2)).ok, true);  // 1
  assert.equal((await repo.bumpAiUsage(u.id, day, 2)).ok, true);  // 2
  assert.equal((await repo.bumpAiUsage(u.id, day, 2)).ok, false); // bị chặn
});

test('hitRateLimit đếm trong cửa sổ, reset khi hết', async () => {
  const key = `test:${Date.now()}`;
  assert.equal((await repo.hitRateLimit(key, 60, 2)).ok, true);
  assert.equal((await repo.hitRateLimit(key, 60, 2)).ok, true);
  assert.equal((await repo.hitRateLimit(key, 60, 2)).ok, false);
  await sql`update remi.rate_limits set window_start = now() - interval '2 min' where key = ${key}`;
  assert.equal((await repo.hitRateLimit(key, 60, 2)).ok, true); // cửa sổ mới
});

test.after(async () => { await sql.end(); });
