import { checkHealth } from '@/lib/health';
import { jsonResponse } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const result = await checkHealth(process.env.DATABASE_URL);
  return jsonResponse(result.status, result.body);
}
