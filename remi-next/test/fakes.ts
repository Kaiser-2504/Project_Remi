import { ApiError } from '../lib/errors.ts';
import type { DataStore, RequireUser } from '../lib/ports.ts';
import type { Reminder } from '../lib/schemas.ts';

export const silent = { error() {}, warn() {} };

/** requireUser giả: Authorization: Bearer <id> là người dùng <id>; thiếu header x-remi ở yêu cầu ghi thì 403. */
export const requireUser: RequireUser = async (req) => {
  if (req.method !== 'GET' && req.headers.get('x-remi') !== '1') throw new ApiError(403, 'csrf', 'Yêu cầu bị từ chối.');
  const h = req.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) throw new ApiError(401, 'unauthorized', 'Bạn cần đăng nhập.');
  const id = h.slice(7);
  return { id, email: `${id}@example.com`, name: id };
};

export function memoryStore() {
  const states = new Map<string, { version: number; state: unknown; updatedAt: number }>();
  const reminders = new Map<string, Reminder[]>();
  const subs = new Map<string, { userId: string; keys: unknown; ua: string }>();
  const usage = new Map<string, number>();
  const calls = { refund: 0 };
  const store: DataStore = {
    async getState(u) { return states.get(u) ?? null; },
    async putState(u, base, state, schedule) {
      const cur = states.get(u);
      const v = cur ? cur.version : 0;
      if (base !== v) return { conflict: true, version: v, state: cur ? cur.state : null };
      states.set(u, { version: v + 1, state, updatedAt: Date.now() });
      if (schedule) reminders.set(u, schedule);
      return { conflict: false, version: v + 1 };
    },
    async upsertSubscription(u, sub, ua) { subs.set(sub.endpoint, { userId: u, keys: sub.keys, ua }); },
    async deleteSubscription(u, endpoint) { if (subs.get(endpoint)?.userId === u) subs.delete(endpoint); },
    async takeAiQuota(u, day, limit) {
      const k = u + day; const n = usage.get(k) ?? 0;
      if (n >= limit) return false;
      usage.set(k, n + 1); return true;
    },
    async refundAiQuota(u, day) { calls.refund++; const k = u + day; usage.set(k, Math.max(0, (usage.get(k) ?? 0) - 1)); },
  };
  return { store, states, reminders, subs, usage, calls };
}

export const req = (method: string, body?: unknown, user = 'u1', extra: Record<string, string> = {}) =>
  new Request('http://x/api', {
    method,
    headers: { 'content-type': 'application/json', 'x-remi': '1', ...(user ? { authorization: `Bearer ${user}` } : {}), ...extra },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
