/**
 * Nối các mảnh lại với nhau cho Next.js. ĐÂY LÀ FILE DUY NHẤT phụ thuộc vào phần của người khác:
 *   - `sql`          từ lib/db.ts       (Người 1: postgres.js, pooler 6543, prepare:false)
 *   - `requireUser`  từ lib/auth.ts     (Người 3: kiểm tra phiên + header X-Remi, ném ApiError 401/403)
 * Tên import dưới đây là GIẢ ĐỊNH theo kế hoạch; nếu tên thật khác thì chỉ sửa hai dòng import này.
 */
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { aiConfigFromEnv } from './ai.ts';
import { createAiHandlers } from './handlers/ai.ts';
import { createPushHandlers } from './handlers/push.ts';
import { createStateHandlers } from './handlers/state.ts';
import { createPgStore } from './store-pg.ts';

const store = createPgStore(sql as any);

export const stateHandlers = createStateHandlers({ requireUser, store });
export const pushHandlers = createPushHandlers({ requireUser, store, vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '' });
export const aiHandlers = createAiHandlers({ requireUser, store, cfg: aiConfigFromEnv() });
