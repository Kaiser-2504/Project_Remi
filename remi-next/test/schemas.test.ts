import test from 'node:test';
import assert from 'node:assert/strict';
import { aiParseBody, aiResultSchema, putStateBody, pushSubscribeBody, registerBody, normalizeReminder, reminderSchema } from '../lib/schemas.ts';

test('putStateBody: baseVersion phải là số nguyên không âm, state phải là object', () => {
  assert.ok(putStateBody.safeParse({ baseVersion: 0, state: {} }).success);
  assert.ok(!putStateBody.safeParse({ baseVersion: -1, state: {} }).success);
  assert.ok(!putStateBody.safeParse({ baseVersion: 1.5, state: {} }).success);
  assert.ok(!putStateBody.safeParse({ baseVersion: '1', state: {} }).success);
  assert.ok(!putStateBody.safeParse({ baseVersion: 0, state: [] }).success);
  assert.ok(!putStateBody.safeParse({ baseVersion: 0, state: null }).success);
});

test('lịch nhắc: giới hạn độ dài, cond chỉ "" hoặc "asleep", giờ làm tròn', () => {
  const ok = { key: 'k', at: 1700000000000.7, title: 'T' };
  assert.ok(reminderSchema.safeParse(ok).success);
  assert.ok(!reminderSchema.safeParse({ ...ok, key: '' }).success);
  assert.ok(!reminderSchema.safeParse({ ...ok, key: 'x'.repeat(161) }).success);
  assert.ok(!reminderSchema.safeParse({ ...ok, at: 0 }).success);
  assert.ok(!reminderSchema.safeParse({ ...ok, at: Infinity }).success);
  assert.ok(!reminderSchema.safeParse({ ...ok, cond: 'awake' }).success);
  assert.ok(!reminderSchema.safeParse({ ...ok, body: 'x'.repeat(241) }).success);
  assert.deepEqual(normalizeReminder(reminderSchema.parse(ok)), { key: 'k', at: 1700000000001, title: 'T', body: '', cond: '' });
  assert.ok(!putStateBody.safeParse({ baseVersion: 0, state: {}, schedule: Array.from({ length: 501 }, (_, i) => ({ ...ok, key: 'k' + i })) }).success);
});

test('đăng ký push: endpoint phải https', () => {
  const keys = { p256dh: 'a', auth: 'b' };
  assert.ok(pushSubscribeBody.safeParse({ subscription: { endpoint: 'https://push.example/x', keys } }).success);
  assert.ok(!pushSubscribeBody.safeParse({ subscription: { endpoint: 'http://push.example/x', keys } }).success);
  assert.ok(!pushSubscribeBody.safeParse({ subscription: { endpoint: 'https://p/x', keys: { p256dh: '', auth: 'b' } } }).success);
});

test('AI input: độ dài chữ, định dạng giờ, thứ trong tuần', () => {
  const ok = { text: 'đi chợ', now: '2026-11-04T10:00', weekday: 'Thứ tư' };
  assert.ok(aiParseBody.safeParse(ok).success);
  assert.ok(!aiParseBody.safeParse({ ...ok, text: '   ' }).success);
  assert.ok(!aiParseBody.safeParse({ ...ok, text: 'x'.repeat(301) }).success);
  assert.ok(!aiParseBody.safeParse({ ...ok, now: 'hôm nay' }).success);
  assert.ok(!aiParseBody.safeParse({ ...ok, weekday: 'Monday' }).success);
});

test('AI output: giá trị lạ bị đưa về mặc định, thiếu tên việc thì bị từ chối', () => {
  const r = aiResultSchema.parse({ title: 'Đi chợ', intent: 'lạ', leadMinutes: 99999, repeat: 'yearly', shopping: 'yes', checklist: 'không phải mảng', extra: 'bỏ' });
  assert.equal(r.intent, 'task');
  assert.equal(r.leadMinutes, 0);
  assert.equal(r.repeat, 'none');
  assert.equal(r.shopping, false);
  assert.deepEqual(r.checklist, []);
  assert.ok(!('extra' in r));
  assert.ok(!aiResultSchema.safeParse({ intent: 'task' }).success);
  assert.ok(!aiResultSchema.safeParse({ title: '' }).success);
});

test('đăng ký tài khoản: email chuẩn hoá chữ thường, mật khẩu ≥ 8 ký tự, tên ≤ 20', () => {
  const r = registerBody.parse({ email: '  A@Example.COM ', name: ' Xíu ', password: '12345678' });
  assert.equal(r.email, 'a@example.com');
  assert.equal(r.name, 'Xíu');
  assert.ok(!registerBody.safeParse({ email: 'a@b.co', name: 'x', password: '1234567' }).success);
  assert.ok(!registerBody.safeParse({ email: 'a@b.co', name: 'x'.repeat(21), password: '12345678' }).success);
  assert.ok(!registerBody.safeParse({ email: "a'; DROP TABLE users;--", name: 'x', password: '12345678' }).success);
});
