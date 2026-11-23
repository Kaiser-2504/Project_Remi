// Mọi đường dẫn /api/* (trừ /api/cron/dispatch có file riêng) do một bộ định tuyến trong lib/api.js xử lý.
import rt from '../../../lib/runtime.js';

export const runtime = 'nodejs'; // cần crypto.scrypt và gói postgres
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // AI có thể mất vài giây

const handle = (req) => rt.api(req);
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
