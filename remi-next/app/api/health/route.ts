import { jsonResponse } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): Response {
  // TODO: Khi lib/db.ts có mặt, dynamic import DB và chạy SELECT 1 tại đây.
  return jsonResponse(200, { ok: true });
}
