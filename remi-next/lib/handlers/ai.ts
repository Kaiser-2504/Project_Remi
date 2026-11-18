/** POST /api/ai/parse: hiểu một câu nói tiếng Việt, có giới hạn lượt mỗi ngày. */
import { ApiError, errorResponse, jsonResponse, type Logger } from '../errors.ts';
import { readJson } from '../api-kit.ts';
import { parseIntent, type AiConfig } from '../ai.ts';
import type { DataStore, RequireUser } from '../ports.ts';
import { AI_CODES, aiParseBody } from '../schemas.ts';

export function createAiHandlers({
  requireUser, store, cfg, fetchImpl, now = () => new Date(), log = console,
}: { requireUser: RequireUser; store: DataStore; cfg: AiConfig; fetchImpl?: typeof fetch; now?: () => Date; log?: Logger }) {
  return {
    async PARSE(req: Request): Promise<Response> {
      try {
        const user = await requireUser(req);
        const input = await readJson(req, aiParseBody, AI_CODES); // 400 trước khi tốn lượt hay gọi AI
        if (!cfg.apiKey) throw new ApiError(503, 'ai_disabled', 'Máy chủ chưa bật AI.');
        const day = now().toISOString().slice(0, 10);
        if (!(await store.takeAiQuota(user.id, day, cfg.dailyLimit))) {
          throw new ApiError(429, 'ai_limit', 'Hôm nay bạn đã dùng hết lượt AI, app sẽ dùng chế độ cơ bản.');
        }
        try {
          const data = await parseIntent(cfg, input, fetchImpl);
          return jsonResponse(200, { data });
        } catch (e) {
          // Lỗi do phía AI hay đường truyền thì không tính vào lượt của người dùng.
          if (e instanceof ApiError && (e.status === 502 || e.status === 503)) {
            await store.refundAiQuota(user.id, day).catch((x) => log.error('[api] không hoàn được lượt AI', x)); // lỗi hoàn lượt không được che lỗi gốc
          }
          throw e;
        }
      } catch (e) {
        return errorResponse(e, log);
      }
    },
  };
}
