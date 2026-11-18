/**
 * Lỗi của API (Người 4, D5).
 *
 * Hai loại lỗi, xử lý khác nhau:
 *  - Lỗi DỰ ĐOÁN ĐƯỢC (ApiError): người dùng gửi sai, hết lượt, chưa đăng nhập...
 *    Trả đúng mã 4xx/503 ghi trong docs/API.md, kèm thông báo thân thiện.
 *  - Lỗi BẤT NGỜ (mọi thứ còn lại: DB sập, bug...): ghi chi tiết ở máy chủ,
 *    trả 500 với thông báo chung và một requestId để tra log. Không bao giờ lộ
 *    stack, câu SQL hay khóa API cho trình duyệt.
 */

export class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  headers: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.headers = headers;
  }
}

export interface Logger {
  error: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

/** Biến mọi lỗi ném ra từ handler thành Response, theo hai loại ở trên. */
export function errorResponse(err: unknown, log: Logger = console): Response {
  if (err instanceof ApiError) {
    return jsonResponse(err.status, { error: err.code, message: err.message, ...err.extra }, err.headers);
  }
  const requestId = newRequestId();
  log.error('[api] lỗi bất ngờ', requestId, err);
  return jsonResponse(500, {
    error: 'server_error',
    message: 'Máy chủ gặp lỗi, thử lại sau.',
    requestId,
  });
}
