// /lien-he — form góp ý. Kiểm tra dữ liệu ở trình duyệt (/js/lien-he.js) và ở máy chủ (POST /api/contact),
// lời nhắn lưu vào bảng remi.contact_messages.
import { Page } from '../_components/Site.js';

export const metadata = { title: 'Liên hệ · Remi', description: 'Gửi góp ý, báo lỗi hoặc đề nghị hợp tác cho nhóm làm Remi.' };

export default function LienHePage() {
  return (
    <Page active="/lien-he">
      <div className="grid2 contact">
        <section>
          <h1>Liên hệ</h1>
          <p className="muted">Bạn thấy chỗ nào khó dùng, gặp lỗi hay có ý tưởng hay? Nhắn cho nhóm, mọi lời nhắn đều được đọc.</p>
          <ul className="list">
            <li><b>Mã nguồn:</b> <a href="https://github.com/Kaiser-2504/Project_Remi">github.com/Kaiser-2504/Project_Remi</a></li>
            <li><b>Báo lỗi nhanh:</b> mở issue trên GitHub</li>
          </ul>
        </section>

        <form className="card form" id="contact-form" noValidate>
          <div className="field">
            <label htmlFor="c-name">Tên của bạn</label>
            <input id="c-name" name="name" autoComplete="name" maxLength={60} required aria-describedby="e-name" />
            <small className="err" id="e-name" role="alert"></small>
          </div>
          <div className="field">
            <label htmlFor="c-email">Email</label>
            <input id="c-email" name="email" type="email" autoComplete="email" maxLength={200} required aria-describedby="e-email" />
            <small className="err" id="e-email" role="alert"></small>
          </div>
          <div className="field">
            <label htmlFor="c-topic">Chủ đề</label>
            <select id="c-topic" name="topic" defaultValue="gop-y" aria-describedby="e-topic">
              <option value="gop-y">Góp ý giao diện, trải nghiệm</option>
              <option value="loi">Báo lỗi</option>
              <option value="hop-tac">Hợp tác</option>
              <option value="khac">Khác</option>
            </select>
            <small className="err" id="e-topic" role="alert"></small>
          </div>
          <div className="field">
            <label htmlFor="c-message">Nội dung</label>
            <textarea id="c-message" name="message" rows={6} minLength={10} maxLength={2000} required aria-describedby="e-message c-count" />
            <small className="muted" id="c-count">0 / 2000</small>
            <small className="err" id="e-message" role="alert"></small>
          </div>
          <button className="btn" type="submit">Gửi lời nhắn</button>
          <p className="form-status" id="c-status" role="status" aria-live="polite"></p>
        </form>
      </div>
      <script src="/js/lien-he.js" defer></script>
    </Page>
  );
}
