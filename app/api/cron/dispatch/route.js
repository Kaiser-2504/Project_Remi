// Được pg_cron (Supabase) gọi mỗi phút bằng POST, có header Authorization: Bearer <CRON_SECRET>.
import rt from '../../../../lib/runtime.js';
import cron from '../../../../lib/cron.js';

export const runtime = 'nodejs'; // gói web-push cần Node, không chạy ở Edge
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const handle = (req) => cron.handleDispatch(req, rt);
export { handle as GET, handle as POST };
