/**
 * Giao diện giữa phần API (Người 4) và phần dữ liệu (Người 1) / xác thực (Người 3).
 * Handler chỉ biết các hàm dưới đây, nên test được bằng đối tượng giả và đổi DB không đụng tới API.
 */
import type { Reminder } from './schemas.ts';

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
}

/** Người 3: ném ApiError 401 (chưa đăng nhập) hoặc 403 (thiếu X-Remi) nếu không hợp lệ. */
export type RequireUser = (req: Request) => Promise<AuthedUser>;

export type PutStateResult =
  | { conflict: false; version: number }
  | { conflict: true; version: number; state: unknown };

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface DataStore {
  getState(userId: string): Promise<{ version: number; state: unknown; updatedAt: number } | null>;
  /**
   * Ghi trạng thái nếu baseVersion khớp phiên bản hiện tại (khóa lạc quan), CÙNG MỘT giao dịch
   * với việc đồng bộ lịch nhắc (`schedule === null` nghĩa là không đụng tới lịch nhắc).
   */
  putState(userId: string, baseVersion: number, state: unknown, schedule: Reminder[] | null): Promise<PutStateResult>;
  upsertSubscription(userId: string, sub: PushSubscriptionInput, userAgent: string): Promise<void>;
  deleteSubscription(userId: string, endpoint: string): Promise<void>;
  /** Tăng bộ đếm AI trong ngày nếu chưa chạm `limit`. Trả false nếu đã hết lượt. */
  takeAiQuota(userId: string, day: string, limit: number): Promise<boolean>;
  /** Hoàn lại một lượt khi cuộc gọi AI thất bại vì lỗi phía máy chủ/AI (không phải lỗi người dùng). */
  refundAiQuota(userId: string, day: string): Promise<void>;
}
