// Khung chung cho các trang Next.js: thanh trên có điều hướng, chân trang.
// Trang chính của app (/) vẫn là public/index.html.
import { cookies } from 'next/headers';
import pages from '../../lib/pages.js';
import auth from '../../lib/auth.js';

const LINKS = [
  { href: '/', label: 'Ứng dụng' },
  { href: '/lich', label: 'Lịch' },
  { href: '/thong-ke', label: 'Thống kê' },
  { href: '/gioi-thieu', label: 'Giới thiệu' },
  { href: '/lien-he', label: 'Liên hệ' },
];

export function SiteNav({ active }) {
  return (
    <header className="site-top">
      <a className="site-brand" href="/">
        <img src="/icons/icon-192.png" alt="" width="32" height="32" />
        <b>Remi</b>
      </a>
      <nav aria-label="Các trang">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} aria-current={l.href === active ? 'page' : undefined}>{l.label}</a>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <span>Remi · Nhóm 2, lớp Web Design and Development (Basic 2)</span>
      <a href="/lien-he">Góp ý</a>
    </footer>
  );
}

export function Page({ active, children }) {
  return (
    <>
      <SiteNav active={active} />
      <main className="site-main">{children}</main>
      <SiteFooter />
      {/* Google Analytics + Sentry, cấu hình sinh lúc build (xem docs/THEO-DOI.md) */}
      <script src="/js/monitor-config.js" />
      <script src="/js/monitor.js" />
    </>
  );
}

/** Người dùng đang đăng nhập theo cookie phiên, hoặc null. Chỉ nạp kết nối CSDL khi có cookie. */
export async function currentUser() {
  const jar = await cookies();
  const token = jar.get(auth.COOKIE)?.value;
  if (!token) return { user: null, repo: null };
  const repo = (await import('../../lib/repo.js')).default;
  return { user: await pages.userFromCookie(repo, token), repo };
}

export function NeedLogin({ what }) {
  return (
    <section className="card center">
      <h1>Cần đăng nhập</h1>
      <p>Trang {what} đọc dữ liệu tài khoản của bạn. Hãy đăng nhập ở trang chính rồi quay lại.</p>
      <a className="btn" href="/">Đăng nhập</a>
    </section>
  );
}
