// /lien-he — form góp ý. Kiểm tra dữ liệu ở trình duyệt (/js/lien-he.js) và ở máy chủ (POST /api/contact),
// lời nhắn lưu vào bảng remi.contact_messages.
import { Page } from '../_components/Site.js';
import { BTN, CARD, GRID2, H1, LI, LIST } from '../_components/ui.js';

// middleware.js đặt CSP có nonce; nonce chỉ gắn được khi trang dựng theo từng yêu cầu. Dựng tĩnh thì script bị chặn và trang trắng.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Liên hệ · Remi', description: 'Gửi góp ý, báo lỗi hoặc đề nghị hợp tác cho nhóm làm Remi.' };

const FIELD = 'mb-3.5 flex flex-col gap-1';
const LABEL = 'text-[14px] font-semibold';
const INPUT = 'min-h-11 rounded-xl border border-line bg-bg px-3 py-2.5 aria-[invalid=true]:border-bad';
const ERR = 'min-h-[1em] text-[13px] text-bad';

export default function LienHePage() {
  return (
    <Page active="/lien-he">
      <div className={GRID2}>
        <section>
          <h1 className={H1}>Liên hệ</h1>
          <p className="my-4 text-muted">Bạn thấy chỗ nào khó dùng, gặp lỗi hay có ý tưởng hay? Nhắn cho nhóm, mọi lời nhắn đều được đọc.</p>
          <ul className={LIST}>
            <li className={LI}><b>Mã nguồn:</b> <a className="break-words" href="https://github.com/Kaiser-2504/Project_Remi">github.com/Kaiser-2504/Project_Remi</a></li>
            <li className={LI}><b>Báo lỗi nhanh:</b> mở issue trên GitHub</li>
          </ul>
        </section>

        <form className={CARD} id="contact-form" noValidate>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="c-name">Tên của bạn</label>
            <input className={INPUT} id="c-name" name="name" autoComplete="name" maxLength={60} required aria-describedby="e-name" />
            <small className={ERR} id="e-name" role="alert"></small>
          </div>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="c-email">Email</label>
            <input className={INPUT} id="c-email" name="email" type="email" autoComplete="email" maxLength={200} required aria-describedby="e-email" />
            <small className={ERR} id="e-email" role="alert"></small>
          </div>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="c-topic">Chủ đề</label>
            <select className={INPUT} id="c-topic" name="topic" defaultValue="gop-y" aria-describedby="e-topic">
              <option value="gop-y">Góp ý giao diện, trải nghiệm</option>
              <option value="loi">Báo lỗi</option>
              <option value="hop-tac">Hợp tác</option>
              <option value="khac">Khác</option>
            </select>
            <small className={ERR} id="e-topic" role="alert"></small>
          </div>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="c-message">Nội dung</label>
            <textarea className={INPUT} id="c-message" name="message" rows={6} minLength={10} maxLength={2000} required aria-describedby="e-message c-count" />
            <small className="text-[13px] text-muted" id="c-count">0 / 2000</small>
            <small className={ERR} id="e-message" role="alert"></small>
          </div>
          <button className={BTN} type="submit">Gửi lời nhắn</button>
          <p className="form-status" id="c-status" role="status" aria-live="polite"></p>
        </form>
      </div>
      <script src="/js/lien-he.js" defer></script>
    </Page>
  );
}
