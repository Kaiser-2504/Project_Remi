// /lich?thang=YYYY-MM — lịch tháng đọc từ CSDL (bảng remi.states) của người dùng đang đăng nhập.
import pages from '../../lib/pages.js';
import { Page, currentUser, NeedLogin } from '../_components/Site.js';
import { ACTIONS, BTN_GHOST, H1, MUTED, PAGE_HEAD } from '../_components/ui.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Lịch tháng · Remi', description: 'Xem việc và ghi chú của cả tháng.' };

// Sự kiện và ghi chú trong ô ngày; trên điện thoại ô quá hẹp nên chỉ còn vạch màu.
const CHIP = 'truncate rounded-md px-[5px] py-0.5 text-[12px] leading-[1.35] max-sm:h-1.5 max-sm:rounded-[3px] max-sm:p-0 max-sm:text-[0px]';
const AGENDA_ITEM = 'flex gap-2.5 border-b border-line py-2';

export default async function LichPage({ searchParams }) {
  const sp = await searchParams;
  const { user, repo } = await currentUser();
  if (!user) return <Page active="/lich"><NeedLogin what="Lịch" /></Page>;

  const today = pages.todayVN();
  const state = await pages.loadState(repo, user.id);
  const cal = pages.calendarMonth(state, pages.parseMonth(sp?.thang, today), today);

  return (
    <Page active="/lich">
      <div className={PAGE_HEAD}>
        <div>
          <h1 className={H1}>{cal.title}</h1>
          <p className={MUTED}>{user.name}, tháng này có {cal.total} việc, đã xong {cal.done}.</p>
        </div>
        <div className={ACTIONS}>
          <a className={BTN_GHOST} href={`/lich?thang=${cal.prev}`} aria-label="Tháng trước">‹ Trước</a>
          <a className={BTN_GHOST} href="/lich">Tháng này</a>
          <a className={BTN_GHOST} href={`/lich?thang=${cal.next}`} aria-label="Tháng sau">Sau ›</a>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-card" role="table" aria-label={cal.title}>
        <div className="grid grid-cols-7" role="row">
          {cal.weekdays.map((w) => <span key={w} role="columnheader" className="border-b border-line bg-bg px-1.5 py-2 text-center text-[13px] font-semibold text-muted">{w}</span>)}
        </div>
        {cal.weeks.map((week, i) => (
          <div className="grid grid-cols-7" role="row" key={i}>
            {week.map((d) => (
              <div key={d.key} role="cell" className={`flex min-h-24 min-w-0 flex-col gap-[3px] border-b border-r border-line p-1.5 last:border-r-0 max-sm:min-h-16 max-sm:p-1 ${d.inMonth ? '' : 'bg-bg text-muted'}`}>
                <span className={`text-[13px] font-semibold ${d.isToday ? 'inline-flex size-6 items-center justify-center rounded-full bg-accent text-white' : ''}`}>{d.day}</span>
                {d.tasks.slice(0, 3).map((t, j) => (
                  <span key={j} className={`${CHIP} bg-ai-soft text-ai-text ${t.done ? 'line-through opacity-[.65]' : ''} ${t.projected ? 'italic' : ''}`} title={t.title}>
                    {t.time} {t.emoji} {t.title}
                  </span>
                ))}
                {d.tasks.length > 3 && <span className="truncate rounded-md px-[5px] py-0.5 text-[12px] leading-[1.35] text-muted max-sm:p-0 max-sm:text-[10px]">+{d.tasks.length - 3} việc</span>}
                {d.note && <span className={`${CHIP} bg-accent-soft text-accent-text`} title={d.note}>📝 {d.note}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Điện thoại: ô lịch quá hẹp, liệt kê việc theo ngày bên dưới */}
      <section className="mt-4 sm:hidden" aria-label="Việc trong tháng">
        {cal.weeks.flat().filter((d) => d.inMonth && (d.tasks.length || d.note)).map((d) => (
          <div key={d.key}>
            <h2 className="mb-1.5 mt-3.5 text-[16px] font-bold">{d.isToday ? 'Hôm nay, ' : ''}{pages.WD[new Date(d.key + 'T00:00:00').getDay()]} {d.day}/{d.key.slice(5, 7)}</h2>
            <ul>
              {d.tasks.map((t, j) => <li key={j} className={`${AGENDA_ITEM} ${t.done ? MUTED : ''}`}><time className="min-w-11 text-muted">{t.time}</time><span>{t.emoji} {t.title}</span></li>)}
              {d.note && <li className={AGENDA_ITEM}><time className="min-w-11 text-muted">📝</time><span>{d.note}</span></li>}
            </ul>
          </div>
        ))}
      </section>

      <p className="my-3.5 text-[14px] text-muted">Việc in nghiêng là việc lặp lại. Thêm hoặc sửa việc ở <a href="/">trang chính</a>.</p>
    </Page>
  );
}
