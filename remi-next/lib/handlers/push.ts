/** Thiết bị nhận thông báo đẩy: khóa công khai, đăng ký, huỷ đăng ký. */
import { errorResponse, jsonResponse, type Logger } from '../errors.ts';
import { readJson } from '../api-kit.ts';
import type { DataStore, RequireUser } from '../ports.ts';
import { PUSH_CODES, pushSubscribeBody, pushUnsubscribeBody } from '../schemas.ts';

export function createPushHandlers({
  requireUser, store, vapidPublicKey, log = console,
}: { requireUser: RequireUser; store: DataStore; vapidPublicKey: string; log?: Logger }) {
  return {
    async KEY(req: Request): Promise<Response> {
      try {
        await requireUser(req);
        return jsonResponse(200, { enabled: !!vapidPublicKey, publicKey: vapidPublicKey || '' });
      } catch (e) {
        return errorResponse(e, log);
      }
    },

    async SUBSCRIBE(req: Request): Promise<Response> {
      try {
        const user = await requireUser(req);
        const { subscription } = await readJson(req, pushSubscribeBody, PUSH_CODES, 'bad_subscription');
        const ua = (req.headers.get('user-agent') || '').slice(0, 200);
        await store.upsertSubscription(user.id, subscription, ua); // đăng ký lại cùng endpoint thì cập nhật, không nhân đôi
        return jsonResponse(201, { ok: true });
      } catch (e) {
        return errorResponse(e, log);
      }
    },

    async UNSUBSCRIBE(req: Request): Promise<Response> {
      try {
        const user = await requireUser(req);
        const { endpoint } = await readJson(req, pushUnsubscribeBody, PUSH_CODES, 'bad_endpoint');
        await store.deleteSubscription(user.id, endpoint);
        return jsonResponse(200, { ok: true });
      } catch (e) {
        return errorResponse(e, log);
      }
    },
  };
}
