import { pushHandlers } from '@/lib/wire';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = pushHandlers.SUBSCRIBE;
export const DELETE = pushHandlers.UNSUBSCRIBE;
