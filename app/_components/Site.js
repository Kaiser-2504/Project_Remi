// Khung chung cho các trang Next.js: thanh trên có điều hướng, chân trang.
// Trang chính của app (/) vẫn là public/index.html.
import { cookies } from 'next/headers';
import pages from '../../lib/pages.js';
import auth from '../../lib/auth.js';
import { BTN, CARD_BOX, H1 } from './ui.js';

const LINKS = [
  { href: '/', label: 'Ứng dụng' },
  { href: '/lich', label: 'Lịch' },
  { href: '/thong-ke', label: 'Thống kê' },
  { href: '/gioi-thieu', label: 'Giới thiệu' },
  { href: '/lien-he', label: 'Liên hệ' },
];

const NAV_LINK = 'whitespace-nowrap rounded-xl px-3 py-2 font-medium text-muted no-underline hover:bg-line aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent-text max-sm:px-2.5 max-sm:py-1.5 max-sm:text-[15px]';

export function SiteNav({ active }) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-line bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-gutter py-2.5 backdrop-blur-md">
      <a className="flex items-center gap-2 text-[18px] text-ink no-underline" href="/">
        <img src="/icons/icon-192.png" alt="" width="32" height="32" />
        <b>Remi</b>
      </a>
      <nav className="flex max-w-full flex-wrap gap-1 sm:ml-auto" aria-label="Các trang">
        {LINKS.map((l) => (
          <a key={l.href} className={NAV_LINK} href={l.href} aria-current={l.href === active ? 'page' : undefined}>{l.label}</a>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-page flex-wrap justify-between gap-3 border-t border-line px-gutter pb-8 pt-[18px] text-[14px] text-muted">
      <span>Remi · Nhóm 2, lớp Web Design and Development (Basic 2)</span>
      <a href="/lien-he">Góp ý</a>
    </footer>
  );
}

export function Page({ active, children }) {
  return (
    <>
      <SiteNav active={active} />
      <main className="mx-auto max-w-page px-gutter pb-10 pt-6">{children}</main>
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
    <section className={`${CARD_BOX} mx-auto my-10 max-w-[520px] text-center`}>
      <h1 className={H1}>Cần đăng nhập</h1>
      <p className="my-4">Trang {what} đọc dữ liệu tài khoản của bạn. Hãy đăng nhập ở trang chính rồi quay lại.</p>
      <a className={BTN} href="/">Đăng nhập</a>
    </section>
  );
}
