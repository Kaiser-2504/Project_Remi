// /thong-ke?n=7|30 — thống kê thói quen và việc, đọc từ CSDL của người dùng đang đăng nhập.
import pages from '../../lib/pages.js';
import { Page, currentUser, NeedLogin } from '../_components/Site.js';
import { ACTIONS, BTN, BTN_GHOST, CARD, GRID2, H1, H2, MUTED, PAGE_HEAD } from '../_components/ui.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Thống kê · Remi', description: 'Tỉ lệ hoàn thành thói quen, nước uống và huy hiệu.' };

const fmt = (n) => n.toLocaleString('vi-VN');

const KPI = 'flex flex-col rounded-[18px] border border-line bg-surface px-4 py-3.5';
const KPI_VALUE = 'text-[clamp(22px,3vw,28px)]';
const KPI_LABEL = 'text-[14px] text-muted';
// Biểu đồ là SVG do web/js/stats.js sinh ra (không gắn được class), nên tô bằng biến thể chọn phần tử con.
const CHART = '[&_.axis]:stroke-line [&_rect]:fill-ai [&_svg]:h-auto [&_svg]:w-full [&_text]:fill-muted [&_text]:text-[10px]';

export default async function ThongKePage({ searchParams }) {
  const sp = await searchParams;
  const { user, repo } = await currentUser();
  if (!user) return <Page active="/thong-ke"><NeedLogin what="Thống kê" /></Page>;

  const state = await pages.loadState(repo, user.id);
  const s = pages.statsSummary(state, Number(sp?.n) === 30 ? 30 : 7, pages.todayVN());
  const tasksPct = s.tasks.total ? Math.round((s.tasks.done / s.tasks.total) * 100) : 0;

  return (
    <Page active="/thong-ke">
      <div className={PAGE_HEAD}>
        <div>
          <h1 className={H1}>Thống kê</h1>
          <p className={MUTED}>{user.name}, đây là {s.days} ngày gần nhất của bạn.</p>
        </div>
        <div className={ACTIONS} role="group" aria-label="Khoảng thời gian">
          <a className={s.days === 7 ? BTN : BTN_GHOST} href="/thong-ke?n=7" aria-current={s.days === 7 ? 'page' : undefined}>7 ngày</a>
          <a className={s.days === 30 ? BTN : BTN_GHOST} href="/thong-ke?n=30" aria-current={s.days === 30 ? 'page' : undefined}>30 ngày</a>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 wide:grid-cols-4">
        <div className={KPI}><b className={KPI_VALUE}>{tasksPct}%</b><span className={KPI_LABEL}>việc hoàn thành ({s.tasks.done}/{s.tasks.total})</span></div>
        <div className={KPI}><b className={KPI_VALUE}>{s.bestStreak}</b><span className={KPI_LABEL}>ngày liên tiếp (chuỗi tốt nhất)</span></div>
        <div className={KPI}><b className={KPI_VALUE}>{fmt(s.water.total)} ml</b><span className={KPI_LABEL}>nước đã uống</span></div>
        <div className={KPI}><b className={KPI_VALUE}>{s.earned}/{s.badges.length}</b><span className={KPI_LABEL}>huy hiệu</span></div>
      </div>

      <div className={GRID2}>
        <section className={CARD}>
          <h2 className={H2}>Nước uống mỗi ngày</h2>
          {s.water.total ? <div className={CHART} dangerouslySetInnerHTML={{ __html: s.water.svg }} /> : <p className="my-4 text-muted">Chưa có dữ liệu nước uống.</p>}
        </section>
        <section className={CARD}>
          <h2 className={H2}>Số lần làm thói quen</h2>
          {s.acts.total ? <div className={CHART} dangerouslySetInnerHTML={{ __html: s.acts.svg }} /> : <p className="my-4 text-muted">Chưa có lần nào trong khoảng này.</p>}
        </section>
      </div>

      <section className={CARD}>
        <h2 className={H2}>Tỉ lệ hoàn thành từng thói quen</h2>
        {s.rates.length === 0 && <p className="my-4 text-muted">Tick vài thói quen ở trang chính, số liệu sẽ hiện ở đây.</p>}
        {s.rates.map((r) => (
          <div className="my-3" key={r.title}>
            <div className="flex justify-between"><span>{r.emoji} {r.title}</span><b>{r.pct}%</b></div>
            <div className="mb-1 mt-1.5 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={r.title}><i className="block h-full rounded-full bg-ok" style={{ width: r.pct + '%' }} /></div>
            <small className="text-[13px] text-muted">{r.done}/{r.total} ngày · chuỗi hiện tại {r.streak} · dài nhất {r.longest}</small>
          </div>
        ))}
      </section>

      <section className={CARD}>
        <h2 className={H2}>Huy hiệu</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
          {s.badges.map((b) => (
            <div key={b.id} className={`flex flex-col gap-0.5 rounded-2xl border border-line p-3 text-center ${b.earned ? '' : 'opacity-[.55] grayscale'}`}>
              <span className="text-[30px]" aria-hidden="true">{b.emoji}</span>
              <b>{b.name}</b>
              <small className="text-[13px]">{b.earned ? 'Đã mở khoá' : `${b.value}/${b.target}`}</small>
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
