// CSP có nonce cho các trang Next.js. Next tự gắn nonce này vào các script nó chèn,
// nên vẫn giữ được script-src chặt (không cần 'unsafe-inline').
// Trang chính tĩnh (/index.html) và API dùng CSP cố định trong next.config.js.
import { NextResponse } from 'next/server';
import { pageCsp } from './lib/csp.js';

export function middleware(request) {
  const nonce = btoa(crypto.randomUUID());
  const csp = pageCsp(nonce, process.env.NODE_ENV !== 'production');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = { matcher: ['/lich', '/thong-ke', '/gioi-thieu', '/lien-he'] };
