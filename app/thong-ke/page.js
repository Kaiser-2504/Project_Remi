// /thong-ke?n=7|30 — thống kê thói quen và việc, đọc từ CSDL của người dùng đang đăng nhập.
import pages from '../../lib/pages.js';
import { Page, currentUser, NeedLogin } from '../_components/Site.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Thống kê · Remi', description: 'Tỉ lệ hoàn thành thói quen, nước uống và huy hiệu.' };

const fmt = (n) => n.toLocaleString('vi-VN');

export default async function ThongKePage({ searchParams }) {
  const sp = await searchParams;
  const { user, repo } = await currentUser();
  if (!user) return <Page active="/thong-ke"><NeedLogin what="Thống kê" /></Page>;

  const state = await pages.loadState(repo, user.id);
  const s = pages.statsSummary(state, Number(sp?.n) === 30 ? 30 : 7, pages.todayVN());
  const tasksPct = s.tasks.total ? Math.round((s.tasks.done / s.tasks.total) * 100) : 0;

  return (
    <Page active="/thong-ke">
      <div className="page-head">
        <div>
          <h1>Thống kê</h1>
          <p className="muted">{user.name}, đây là {s.days} ngày gần nhất của bạn.</p>
        </div>
        <div className="month-nav" role="group" aria-label="Khoảng thời gian">
          <a className={'btn ' + (s.days === 7 ? '' : 'ghost')} href="/thong-ke?n=7" aria-current={s.days === 7 ? 'page' : undefined}>7 ngày</a>
          <a className={'btn ' + (s.days === 30 ? '' : 'ghost')} href="/thong-ke?n=30" aria-current={s.days === 30 ? 'page' : undefined}>30 ngày</a>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><b>{tasksPct}%</b><span>việc hoàn thành ({s.tasks.done}/{s.tasks.total})</span></div>
        <div className="kpi"><b>{s.bestStreak}</b><span>ngày liên tiếp (chuỗi tốt nhất)</span></div>
        <div className="kpi"><b>{fmt(s.water.total)} ml</b><span>nước đã uống</span></div>
        <div className="kpi"><b>{s.earned}/{s.badges.length}</b><span>huy hiệu</span></div>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Nước uống mỗi ngày</h2>
          {s.water.total ? <div className="chartbox" dangerouslySetInnerHTML={{ __html: s.water.svg }} /> : <p className="muted">Chưa có dữ liệu nước uống.</p>}
        </section>
        <section className="card">
          <h2>Số lần làm thói quen</h2>
          {s.acts.total ? <div className="chartbox" dangerouslySetInnerHTML={{ __html: s.acts.svg }} /> : <p className="muted">Chưa có lần nào trong khoảng này.</p>}
        </section>
      </div>

      <section className="card">
        <h2>Tỉ lệ hoàn thành từng thói quen</h2>
        {s.rates.length === 0 && <p className="muted">Tick vài thói quen ở trang chính, số liệu sẽ hiện ở đây.</p>}
        {s.rates.map((r) => (
          <div className="prow" key={r.title}>
            <div className="ptop"><span>{r.emoji} {r.title}</span><b>{r.pct}%</b></div>
            <div className="pbar" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={r.title}><i style={{ width: r.pct + '%' }} /></div>
            <small className="muted">{r.done}/{r.total} ngày · chuỗi hiện tại {r.streak} · dài nhất {r.longest}</small>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Huy hiệu</h2>
        <div className="badges">
          {s.badges.map((b) => (
            <div key={b.id} className={'badge' + (b.earned ? '' : ' off')}>
              <span className="bi" aria-hidden="true">{b.emoji}</span>
              <b>{b.name}</b>
              <small>{b.earned ? 'Đã mở khoá' : `${b.value}/${b.target}`}</small>
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
