// /gioi-thieu — giới thiệu Remi, tính năng, công nghệ và nhóm làm.
import { Page } from '../_components/Site.js';

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
      <section className="hero">
        <h1>Remi nhớ giúp bạn, để bạn sống nhẹ hơn</h1>
        <p>Trợ lý nhắc việc và thói quen cho cá nhân. Nói một câu tự nhiên, Remi hiểu và tạo nhắc hẹn, danh sách đi chợ, thói quen, rồi gọi đúng tên bạn khi đến giờ.</p>
        <a className="btn" href="/">Dùng thử ngay</a>
      </section>

      <h2>Tính năng</h2>
      <div className="features">
        {FEATURES.map(([icon, title, text]) => (
          <section className="card" key={title}>
            <span className="ficon" aria-hidden="true">{icon}</span>
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </section>
        ))}
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Công nghệ</h2>
          <ul className="list">
            <li>Next.js (App Router, Route Handler) triển khai trên Vercel</li>
            <li>PostgreSQL trên Supabase, bật Row Level Security</li>
            <li>PWA: cài lên màn hình chính, chạy khi mất mạng, Web Push</li>
            <li>AI hiểu câu tiếng Việt (Gemini / Claude) chạy ở máy chủ</li>
            <li>Google Analytics và Sentry để theo dõi và ghi lỗi</li>
          </ul>
        </section>
        <section className="card">
          <h2>Nhóm thực hiện</h2>
          <ul className="list team">
            {TEAM.map(([who, role]) => <li key={who}><b>{who}</b><span className="muted">{role}</span></li>)}
          </ul>
        </section>
      </div>
    </Page>
  );
}
