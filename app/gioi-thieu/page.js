// /gioi-thieu — giới thiệu Remi, tính năng, công nghệ và nhóm làm.
import { Page } from '../_components/Site.js';
import { BTN, CARD, GRID2, H1, H2, LI, LIST, MUTED } from '../_components/ui.js';

// middleware.js đặt CSP có nonce; nonce chỉ gắn được khi trang dựng theo từng yêu cầu. Dựng tĩnh thì script bị chặn và trang trắng.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Giới thiệu · Remi', description: 'Remi là trợ lý nhắc việc và thói quen: nói một câu, AI tạo nhắc hẹn, danh sách đi chợ, thói quen.' };

const FEATURES = [
  ['🗣️', 'Nói một câu là xong', 'Gõ hoặc nói "mai 7h đi chợ mua thịt", AI tách thành việc có giờ, nhắc trước và danh sách cần mua.'],
  ['💧', 'Thói quen thông minh', 'Chia lượng nước theo giờ thức dậy, lặp theo thứ trong tuần, theo dõi chuỗi ngày.'],
  ['📅', 'Lịch tuần và tháng', 'Kéo thả việc, cảnh báo trùng giờ, xuất lịch .ics sang Google Calendar.'],
  ['🍳', 'Bếp', 'Thực đơn 7 ngày, gộp danh sách đi chợ đã trừ đồ trong tủ, nhắc đồ sắp hết hạn.'],
  ['📊', 'Thống kê và huy hiệu', 'Tỉ lệ hoàn thành, biểu đồ nước uống, huy hiệu khi giữ thói quen đều.'],
  ['🔔', 'Nhắc cả khi đóng app', 'Thông báo đẩy đúng giờ, đồng bộ nhiều thiết bị, dùng được khi mất mạng.'],
];

const TEAM = [
  ['Kaiser-2504', 'Trưởng nhóm · Bếp · CSDL Supabase · triển khai'],
  ['Thu Tuyết', 'Thống kê, chuỗi ngày, huy hiệu · khung Next.js'],
  ['vubui240932-cell', 'Lịch nâng cao · đăng nhập và bảo mật'],
  ['quangthong3005-ai', 'API, hợp đồng dữ liệu · theo dõi lỗi'],
  ['JohnGitHub', 'Nhập nhanh thông minh · AI'],
];

export default function GioiThieuPage() {
  return (
    <Page active="/gioi-thieu">
      <section className="max-w-[720px] pb-[18px] pt-9">
        <h1 className={H1}>Remi nhớ giúp bạn, để bạn sống nhẹ hơn</h1>
        <p className="my-[18px] text-[18px] text-muted">Trợ lý nhắc việc và thói quen cho cá nhân. Nói một câu tự nhiên, Remi hiểu và tạo nhắc hẹn, danh sách đi chợ, thói quen, rồi gọi đúng tên bạn khi đến giờ.</p>
        <a className={BTN} href="/">Dùng thử ngay</a>
      </section>

      <h2 className={H2}>Tính năng</h2>
      <div className="mb-2 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {FEATURES.map(([icon, title, text]) => (
          <section className={CARD} key={title}>
            <span className="text-[28px]" aria-hidden="true">{icon}</span>
            <h3 className="mb-1 mt-2 text-[16px] font-bold">{title}</h3>
            <p className="my-4 text-muted">{text}</p>
          </section>
        ))}
      </div>

      <div className={GRID2}>
        <section className={CARD}>
          <h2 className={H2}>Công nghệ</h2>
          <ul className={LIST}>
            <li className={LI}>Next.js (App Router, Route Handler) triển khai trên Vercel</li>
            <li className={LI}>Tailwind CSS cho giao diện các trang này</li>
            <li className={LI}>PostgreSQL trên Supabase, bật Row Level Security</li>
            <li className={LI}>PWA: cài lên màn hình chính, chạy khi mất mạng, Web Push</li>
            <li className={LI}>AI hiểu câu tiếng Việt (Gemini / Claude) chạy ở máy chủ</li>
            <li className={LI}>Google Analytics và Sentry để theo dõi và ghi lỗi</li>
          </ul>
        </section>
        <section className={CARD}>
          <h2 className={H2}>Nhóm thực hiện</h2>
          <ul>
            {TEAM.map(([who, role]) => <li key={who} className={`${LI} flex flex-col border-b border-line py-2`}><b>{who}</b><span className={MUTED}>{role}</span></li>)}
          </ul>
        </section>
      </div>
    </Page>
  );
}
