# Các trang của Remi (mục 2a, 3c)

| Đường dẫn | Loại | Dữ liệu | Code |
|---|---|---|---|
| `/` | Ứng dụng chính (PWA, trang tĩnh) | `GET/PUT /api/state` | `web/` → `public/` |
| `/lich?thang=YYYY-MM` | Trang Next.js, render ở máy chủ | Đọc `remi.states` của người đang đăng nhập, dựng lịch tháng (việc, việc lặp, ghi chú ngày) | `app/lich/page.js`, `lib/pages.js` |
| `/thong-ke?n=7\|30` | Trang Next.js, render ở máy chủ | Đọc `remi.states`, tính tỉ lệ hoàn thành, nước uống, chuỗi ngày, huy hiệu | `app/thong-ke/page.js`, `lib/pages.js` |
| `/gioi-thieu` | Trang Next.js tĩnh | Không | `app/gioi-thieu/page.js` |
| `/lien-he` | Trang Next.js + form | Ghi vào bảng `remi.contact_messages` qua `POST /api/contact` | `app/lien-he/page.js`, `web/js/lien-he.js` |

## Luồng dữ liệu của trang động

```
Trình duyệt ── GET /lich?thang=2026-11 (cookie remi_session)
   │
Next.js (app/lich/page.js, chạy ở máy chủ)
   ├─ cookies() → lib/pages.userFromCookie → remi.sessions  (ai đang đăng nhập)
   ├─ lib/pages.loadState → remi.states                    (dữ liệu của người đó)
   └─ lib/pages.calendarMonth → HTML trả về trình duyệt
```

Chưa đăng nhập thì trang hiện lời mời đăng nhập, không đọc CSDL. Ngày tính theo giờ Việt Nam (máy chủ Vercel chạy UTC).

Công thức thống kê dùng chung `web/js/stats.js` với màn Thống kê trong app, nên số liệu hai nơi khớp nhau.

## Bảo mật

- Các trang Next.js dùng CSP có **nonce** (`middleware.js`, `lib/csp.js`): Next gắn nonce vào script của nó, không cần `unsafe-inline`.
- `POST /api/contact`: cần header `X-Remi` (chống CSRF), kiểm tra từng trường ở cả trình duyệt và máy chủ, giới hạn 5 lần mỗi giờ mỗi IP. Bảng `contact_messages` bật RLS như các bảng khác.

## Kiểm thử

- `npm test`: `lib/test/pages.test.js` (lịch, việc lặp, giờ Việt Nam, thống kê, đọc CSDL bằng repo giả) và `lib/test/api.test.js` (API liên hệ).
- Migration `db/migrations/003_contact.sql` chạy trong CI cùng kiểm tra RLS.
- Trang hiển thị ổn ở 390px và 1280px, không tràn ngang.
