/** GET/PUT /api/state: dữ liệu của người dùng, khóa lạc quan, kèm đồng bộ lịch nhắc. */
import { ApiError, errorResponse, jsonResponse, type Logger } from '../errors.ts';
import { readJson } from '../api-kit.ts';
import type { DataStore, RequireUser } from '../ports.ts';
import { MAX_STATE_BYTES, STATE_CODES, normalizeReminder, putStateBody } from '../schemas.ts';

export function createStateHandlers({ requireUser, store, log = console }: { requireUser: RequireUser; store: DataStore; log?: Logger }) {
  return {
    async GET(req: Request): Promise<Response> {
      try {
        const user = await requireUser(req);
        const row = await store.getState(user.id);
        if (!row) return jsonResponse(200, { version: 0, state: null });
        return jsonResponse(200, { version: row.version, state: row.state, updatedAt: row.updatedAt });
      } catch (e) {
        return errorResponse(e, log);
      }
    },

    async PUT(req: Request): Promise<Response> {
      try {
        const user = await requireUser(req);
        const body = await readJson(req, putStateBody, STATE_CODES);
        if (JSON.stringify(body.state).length > MAX_STATE_BYTES) throw new ApiError(413, 'too_large', 'Dữ liệu quá lớn.');
        const schedule = body.schedule ? body.schedule.map(normalizeReminder) : null;
        const r = await store.putState(user.id, body.baseVersion, body.state, schedule);
        if (r.conflict) {
          // Máy khách nhận bản mới nhất để tự gộp rồi gửi lại.
          throw new ApiError(409, 'conflict', 'Dữ liệu trên máy chủ mới hơn.', { version: r.version, state: r.state });
        }
        return jsonResponse(200, { version: r.version });
      } catch (e) {
        return errorResponse(e, log);
      }
    },
  };
}
