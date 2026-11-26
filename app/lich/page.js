// /lich?thang=YYYY-MM — lịch tháng đọc từ CSDL (bảng remi.states) của người dùng đang đăng nhập.
import pages from '../../lib/pages.js';
import { Page, currentUser, NeedLogin } from '../_components/Site.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Lịch tháng · Remi', description: 'Xem việc và ghi chú của cả tháng.' };

export default async function LichPage({ searchParams }) {
  const sp = await searchParams;
  const { user, repo } = await currentUser();
  if (!user) return <Page active="/lich"><NeedLogin what="Lịch" /></Page>;

  const today = pages.todayVN();
  const state = await pages.loadState(repo, user.id);
  const cal = pages.calendarMonth(state, pages.parseMonth(sp?.thang, today), today);

  return (
    <Page active="/lich">
      <div className="page-head">
        <div>
          <h1>{cal.title}</h1>
          <p className="muted">{user.name}, tháng này có {cal.total} việc, đã xong {cal.done}.</p>
        </div>
        <div className="month-nav">
          <a className="btn ghost" href={`/lich?thang=${cal.prev}`} aria-label="Tháng trước">‹ Trước</a>
          <a className="btn ghost" href="/lich">Tháng này</a>
          <a className="btn ghost" href={`/lich?thang=${cal.next}`} aria-label="Tháng sau">Sau ›</a>
        </div>
      </div>

      <div className="month" role="table" aria-label={cal.title}>
        <div className="month-row head" role="row">
          {cal.weekdays.map((w) => <span key={w} role="columnheader">{w}</span>)}
        </div>
        {cal.weeks.map((week, i) => (
          <div className="month-row" role="row" key={i}>
            {week.map((d) => (
              <div key={d.key} role="cell" className={'day' + (d.inMonth ? '' : ' out') + (d.isToday ? ' today' : '')}>
                <span className="num">{d.day}</span>
                {d.tasks.slice(0, 3).map((t, j) => (
                  <span key={j} className={'ev' + (t.done ? ' done' : '') + (t.projected ? ' rep' : '')} title={t.title}>
                    {t.time} {t.emoji} {t.title}
                  </span>
                ))}
                {d.tasks.length > 3 && <span className="more">+{d.tasks.length - 3} việc</span>}
                {d.note && <span className="note" title={d.note}>📝 {d.note}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Điện thoại: ô lịch quá hẹp, liệt kê việc theo ngày bên dưới */}
      <section className="agenda" aria-label="Việc trong tháng">
        {cal.weeks.flat().filter((d) => d.inMonth && (d.tasks.length || d.note)).map((d) => (
          <div key={d.key}>
            <h2>{d.isToday ? 'Hôm nay, ' : ''}{pages.WD[new Date(d.key + 'T00:00:00').getDay()]} {d.day}/{d.key.slice(5, 7)}</h2>
            <ul>
              {d.tasks.map((t, j) => <li key={j} className={t.done ? 'muted' : ''}><time>{t.time}</time><span>{t.emoji} {t.title}</span></li>)}
              {d.note && <li><time>📝</time><span>{d.note}</span></li>}
            </ul>
          </div>
        ))}
      </section>

      <p className="muted small">Việc in nghiêng là việc lặp lại. Thêm hoặc sửa việc ở <a href="/">trang chính</a>.</p>
    </Page>
  );
}
