/**
 * Bản chạy ĐỘC LẬP của phần API Người 4: một server Node mỏng nối các handler (state, push, AI) với Postgres
 * thật và bộ đăng nhập tối giản, để chạy được test hợp đồng mà không cần Next.js hay phần của người khác.
 *
 *   psql "$DATABASE_URL" -f remi-next/standalone/schema.sql
 *   npm install postgres                                    (một lần)
 *   DATABASE_URL=postgres://... PORT=4000 node remi-next/standalone/server.ts
 *   BACKEND_URL=http://localhost:4000 npm run test:contract
 *
 * Khi nhóm ghép xong, bỏ thư mục standalone/ này; các handler dùng lại nguyên cho Next.js qua lib/wire.ts.
 */
import { createServer as createHttpServer, type IncomingMessage, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { aiConfigFromEnv } from '../lib/ai.ts';
import { errorResponse, jsonResponse, type Logger } from '../lib/errors.ts';
import { createAiHandlers } from '../lib/handlers/ai.ts';
import { createPushHandlers } from '../lib/handlers/push.ts';
import { createStateHandlers } from '../lib/handlers/state.ts';
import { createPgStore, type Sql } from '../lib/store-pg.ts';
import { createAuthLite } from './auth-lite.ts';

type Handler = (req: Request) => Promise<Response>;
const BODY_LIMIT = 3 * 1024 * 1024;

export function createApiServer({
  sql, env = process.env, log = console, fetchImpl,
}: { sql: Sql; env?: Record<string, string | undefined>; log?: Logger; fetchImpl?: typeof fetch }) {
  const store = createPgStore(sql);
  const auth = createAuthLite({
    sql, log,
    secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : env.NODE_ENV === 'production',
    allowRegistration: env.ALLOW_REGISTRATION !== '0',
    trustProxy: env.TRUST_PROXY === '1',
    registerLimit: Number(env.REGISTER_LIMIT) || 10,
  });
  const { requireUser } = auth;
  const state = createStateHandlers({ requireUser, store, log });
  const push = createPushHandlers({ requireUser, store, vapidPublicKey: env.VAPID_PUBLIC_KEY || '', log });
  const ai = createAiHandlers({ requireUser, store, cfg: aiConfigFromEnv(env), fetchImpl, log });

  const routes: Record<string, Handler> = {
    'GET /api/health': async () => { await sql`SELECT 1`; return jsonResponse(200, { ok: true }); },
    'POST /api/auth/register': auth.handlers.register,
    'POST /api/auth/login': auth.handlers.login,
    'POST /api/auth/logout': auth.handlers.logout,
    'GET /api/me': auth.handlers.me,
    'DELETE /api/me': auth.handlers.deleteMe,
    'GET /api/state': state.GET,
    'PUT /api/state': state.PUT,
    'GET /api/push/key': push.KEY,
    'POST /api/push/subscribe': push.SUBSCRIBE,
    'DELETE /api/push/subscribe': push.UNSUBSCRIBE,
    'POST /api/ai/parse': ai.PARSE,
  };

  async function toRequest(req: IncomingMessage): Promise<Request | 'too_large'> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > BODY_LIMIT) return 'too_large';
      chunks.push(c as Buffer);
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && size > 0;
    return new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
      method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined,
    });
  }

  const server: Server = createHttpServer(async (nodeReq, nodeRes) => {
    let res: Response;
    try {
      const r = await toRequest(nodeReq);
      if (r === 'too_large') {
        res = jsonResponse(413, { error: 'too_large', message: 'Dữ liệu gửi lên quá lớn.' });
      } else {
        const handler = routes[`${r.method} ${new URL(r.url).pathname}`];
        res = handler ? await handler(r) : jsonResponse(404, { error: 'not_found', message: 'Không tìm thấy.' });
      }
    } catch (e) {
      res = errorResponse(e, log);
    }
    const out: Record<string, string> = { 'x-content-type-options': 'nosniff' };
    res.headers.forEach((v, k) => { out[k] = v; });
    nodeRes.writeHead(res.status, out);
    nodeRes.end(Buffer.from(await res.arrayBuffer()));
  });

  return {
    server,
    listen: (port = 0, host = '127.0.0.1') => new Promise<{ port: number }>((resolve) => server.listen(port, host, () => resolve(server.address() as { port: number }))),
    close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
}

/* Chạy trực tiếp: node remi-next/standalone/server.ts */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('Thiếu DATABASE_URL (chuỗi kết nối Postgres).'); process.exit(1); }
  // @ts-ignore: gói `postgres` cài riêng (npm install postgres), không có trong môi trường kiểm thử của Claude
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 5, prepare: false }) as unknown as Sql;
  const app = createApiServer({ sql });
  const addr = await app.listen(Number(process.env.PORT) || 4000, process.env.HOST || '127.0.0.1');
  console.log(`Remi API (độc lập) chạy tại http://localhost:${addr.port}`);
  if (!process.env.ANTHROPIC_API_KEY) console.log('[ai] Chưa có ANTHROPIC_API_KEY: /api/ai/parse trả 503 ai_disabled.');
  const stop = () => app.close().then(() => (sql as any).end?.()).then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
