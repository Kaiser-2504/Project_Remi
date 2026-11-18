/**
 * Schema Zod cho MỌI payload của API (Người 4, D5).
 * Một nguồn sự thật: máy chủ kiểm tra bằng các schema này, docs/API.md mô tả lại cùng quy tắc.
 */
import { z } from 'zod';

export const MAX_STATE_BYTES = 1_000_000;
export const MAX_REMINDERS = 500;
export const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] as const;
const NOW_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- tài khoản (Người 3 dùng lại) ---------- */
export const registerBody = z.object({
  email: z.string().trim().toLowerCase().max(200).regex(EMAIL_RE),
  name: z.string().trim().min(1).max(20),
  password: z.string().min(8).max(200),
});
export const loginBody = z.object({
  email: z.string().trim().toLowerCase().max(200),
  password: z.string().max(200),
});
export const deleteMeBody = z.object({ password: z.string().max(200) });

/* ---------- đồng bộ dữ liệu và lịch nhắc ---------- */
export const reminderSchema = z.object({
  key: z.string().min(1).max(160),
  at: z.number().finite().positive(),
  title: z.string().min(1).max(160),
  body: z.string().max(240).optional(),
  cond: z.union([z.literal(''), z.literal('asleep')]).optional(),
});
export type Reminder = { key: string; at: number; title: string; body: string; cond: '' | 'asleep' };

/** Chuẩn hoá về dạng lưu DB: làm tròn giờ, điền giá trị mặc định. */
export function normalizeReminder(r: z.infer<typeof reminderSchema>): Reminder {
  return { key: r.key, at: Math.round(r.at), title: r.title, body: r.body ?? '', cond: r.cond ?? '' };
}

export const putStateBody = z.object({
  baseVersion: z.number().int().min(0),
  state: z.record(z.string(), z.unknown()), // object thuần, không nhận mảng hay null
  schedule: z.array(reminderSchema).max(MAX_REMINDERS).optional(),
});

/* ---------- thông báo đẩy ---------- */
export const pushSubscribeBody = z.object({
  subscription: z.object({
    endpoint: z.string().max(1000).startsWith('https://'),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(200) }),
  }),
});
export const pushUnsubscribeBody = z.object({ endpoint: z.string().max(1000) });

/* ---------- AI ---------- */
export const aiParseBody = z.object({
  text: z.string().trim().min(1).max(300),
  now: z.string().regex(NOW_RE),
  weekday: z.enum(WEEKDAYS),
});
export type AiParseInput = z.infer<typeof aiParseBody>;

const str = (max: number) => z.string().max(max);
/**
 * Kết quả AI trả về. Chặt ở chỗ người dùng sẽ thấy hoặc app sẽ tin (intent, giờ, lặp),
 * lỏng ở chỗ trang trí (mẹo, emoji) để một chữ thừa không làm hỏng cả câu trả lời.
 */
export const aiResultSchema = z.object({
  intent: z.enum(['task', 'habit']).catch('task'),
  title: str(120).min(1),
  emoji: str(16).catch(''),
  when: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable().catch(null),
  repeat: z.enum(['none', 'daily', 'weekly']).catch('none'),
  leadMinutes: z.number().int().min(0).max(1440).catch(0),
  shopping: z.boolean().catch(false),
  servings: z.number().int().min(1).max(50).catch(4),
  assumption: str(80).catch(''),
  summary: str(300).catch(''),
  checklist: z
    .array(z.object({ item: str(80), qty: str(40).catch('') }))
    .max(20)
    .catch([]),
  tips: z.array(str(120)).max(4).catch([]),
  habit: z
    .object({
      recurring: z.boolean().catch(false),
      times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(24).catch([]),
      days: z.array(z.number().int().min(0).max(6)).max(7).catch([0, 1, 2, 3, 4, 5, 6]),
      spread: z.unknown().catch(null),
      ml: z.number().min(0).max(20000).nullable().catch(null),
    })
    .nullable()
    .catch(null),
});
export type AiResult = z.infer<typeof aiResultSchema>;

/* ---------- ánh xạ lỗi Zod sang mã lỗi trong docs/API.md ---------- */
export type CodeMap = Record<string, string>;
export const STATE_CODES: CodeMap = { baseVersion: 'bad_version', state: 'bad_state', schedule: 'bad_schedule' };
export const PUSH_CODES: CodeMap = { subscription: 'bad_subscription', endpoint: 'bad_endpoint' };
export const AI_CODES: CodeMap = { text: 'bad_text', now: 'bad_now', weekday: 'bad_weekday' };
