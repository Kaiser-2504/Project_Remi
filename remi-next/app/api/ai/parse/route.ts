import { aiHandlers } from '@/lib/wire';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // lớn hơn thời gian chờ AI (20 giây) để lỗi quá thời gian được trả về đúng cách
export const POST = aiHandlers.PARSE;
