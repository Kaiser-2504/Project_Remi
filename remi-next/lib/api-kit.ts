/** Đọc body JSON và kiểm tra bằng Zod, ném ApiError 4xx có mã lỗi riêng cho từng trường. */
import { ApiError } from './errors.ts';
import type { CodeMap } from './schemas.ts';

const BODY_LIMIT = 2 * 1024 * 1024;

/** Chỉ cần phần `safeParse` của Zod (cùng dạng ở Zod 3 và 4), nên không phụ thuộc phiên bản Zod. */
export interface Schema<T> {
  safeParse(x: unknown): { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[] }> } };
}

export async function readJson<T>(
  req: Request,
  schema: Schema<T>,
  codes: CodeMap = {},
  fallbackCode = 'bad_request',
): Promise<T> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > BODY_LIMIT) throw new ApiError(413, 'too_large', 'Dữ liệu gửi lên quá lớn.');
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > BODY_LIMIT) throw new ApiError(413, 'too_large', 'Dữ liệu gửi lên quá lớn.');
    raw = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, 'bad_json', 'Dữ liệu không hợp lệ.');
  }
  const r = schema.safeParse(raw);
  if (r.success) return r.data;
  const field = String(r.error.issues[0]?.path[0] ?? '');
  throw new ApiError(400, codes[field] ?? fallbackCode, 'Dữ liệu không hợp lệ.', { field });
}
