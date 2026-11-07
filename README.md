# Remi

Trợ lý nhắc việc và thói quen cho cá nhân: nói một câu tự nhiên, AI hiểu và tạo nhắc hẹn, danh sách đi chợ, thói quen uống nước chia giờ theo lúc bạn thức dậy, gọi dậy buổi sáng, và gọi đúng tên bạn ("Xíu ơi, đến giờ uống nước rồi nè!").

Đây là bản full stack đầu tiên: **một ứng dụng web cài được (PWA)** cùng **máy chủ Node.js**. Không cần framework hay bước build, chạy bằng một lệnh.

## Chạy thử trong 2 phút

Cần Node.js **22.13 trở lên**.

```bash
npm install            # chỉ để cài web-push (thông báo đẩy)
cp .env.example .env   # rồi điền ANTHROPIC_API_KEY nếu muốn có AI
npm start              # mở http://localhost:3000
```

**Mọi người dùng đều dùng AI** để hiểu câu nói, không còn chế độ cơ bản. Vì vậy cần `ANTHROPIC_API_KEY` trong `.env`:

- Chạy thử ở máy cá nhân mà chưa có khóa: app vẫn mở, câu nói chưa được hiểu, chỉ các nút tạo nhanh (Đặt nhắc hẹn, Hẹn lịch, Thêm thói quen) dùng được.
- Chạy `NODE_ENV=production` (Docker) mà thiếu khóa: máy chủ **từ chối khởi động** và báo lý do.

Không chạy `npm install` thì mọi thứ vẫn chạy, chỉ riêng thông báo đẩy bị tắt.

## Tính năng chính

- Nói hoặc gõ một câu, AI tạo nhắc hẹn, việc đi chợ, thói quen. Lời nhắc gọi đúng tên bạn.
- **Chia lượng nước uống**: "uống 1 lít nước chia làm 4 lần từ 1h-5h" thành 4 lần 250 ml, nhắc đúng từng mốc.
- **Chọn ngày giờ bằng nút bấm**: ngày nhanh, giờ có nút + và −, giờ chọn nhanh, nhắc trước, lặp lại.
- Danh sách đi chợ có gợi ý, tìm kiếm, định lượng chỉnh bằng nút và co giãn theo số người ăn.
- Thanh ngủ và thức dậy, gọi dậy buổi sáng, thói quen theo ngày trong tuần, Lịch có ghi chú.
- Đồng bộ nhiều thiết bị, thông báo đẩy, cài như app, chạy tốt từ điện thoại tới máy tính.

## Kiểm thử

```bash
npm test               # bài test cho máy chủ và bộ tính định lượng, không cần mạng
npm run test:e2e       # trình duyệt thật + máy chủ thật + "Anthropic" giả (cần puppeteer)
```

`npm run test:features` kiểm chia lượng nước và bộ chọn ngày giờ, kèm việc dữ liệu và lịch nhắc có lên máy chủ đúng không.

`npm run test:responsive` kiểm bố cục ở 7 cỡ màn hình (320px đến 1440px, cả xoay ngang): không tràn ngang, đúng kiểu điều hướng và số cột, cửa sổ chi tiết nằm đúng chỗ.

`npm run test:e2e` đi qua: đăng ký, AI tạo việc đi chợ, đồng bộ sang thiết bị thứ hai, sửa ngoại tuyến rồi gộp, xoá lan truyền, máy chủ đẩy thông báo đúng giờ, đăng xuất xoá dữ liệu trên máy.

## Giao diện thích ứng theo màn hình

Cùng một trang tự đổi bố cục theo chiều rộng và chiều cao màn hình (`web/css/app.css`, phần cuối file):

| Màn hình | Điều hướng | Bố cục | Cửa sổ chi tiết |
|---|---|---|---|
| Điện thoại dọc (dưới 640px) | Thanh dưới | Một cột | Trượt từ đáy lên |
| Máy tính bảng dọc (640 đến 959px) | Thanh dưới | Một cột rộng, thói quen chia hai cột | Hiện giữa màn hình |
| Máy tính bảng ngang, laptop nhỏ, điện thoại xoay ngang | Thanh bên hẹp (biểu tượng) | Hai cột: việc bên trái, tạo nhanh và thói quen bên phải | Hiện giữa màn hình |
| Từ 1280px | Thanh bên đầy đủ có chữ | Hai cột rộng (cột phụ 380px, từ 1700px là 420px) | Hiện giữa màn hình |

Thêm: Lịch hiện tháng bên trái và chi tiết ngày bên phải, việc sắp tới xếp lưới theo ngày, hiệu ứng khi rê chuột, phím **/** để về Hôm nay và gõ nhanh, phím **Esc** để đóng cửa sổ.

## Kiến trúc

```
Trình duyệt / app cài trên màn hình chính
 ├─ web/js/app.js   giao diện, logic nhắc việc, lưu cục bộ (chạy được khi mất mạng)
 ├─ web/js/api.js   gọi API
 └─ web/sw.js       mở app khi mất mạng + nhận thông báo đẩy
          │  HTTPS, cookie phiên
Máy chủ Node.js (không cần thư viện ngoài, trừ web-push)
 ├─ server/routes.js     API
 ├─ server/auth.js       mật khẩu (scrypt), phiên, giới hạn thử
 ├─ server/ai.js         gọi Anthropic, khóa API chỉ nằm ở đây
 ├─ server/scheduler.js  quét lời nhắc đến hạn, gửi thông báo đẩy
 ├─ server/push.js       khóa VAPID + gửi Web Push
 └─ SQLite (node:sqlite) một file, cả dữ liệu lẫn lịch nhắc
```

### Dữ liệu và đồng bộ

- App lưu dữ liệu ngay trên máy (localStorage) nên dùng được khi mất mạng.
- Mỗi người có **một tài liệu JSON** trên máy chủ (bảng `states`) kèm số phiên bản.
- Khi lưu, app đẩy lên bằng `PUT /api/state` kèm `baseVersion`. Máy chủ từ chối (409) nếu phiên bản đã đổi, app tự **gộp** hai bản rồi đẩy lại.
- Gộp theo từng mục: mỗi việc, thói quen, ghi chú ngày có dấu thời gian `u`; bản mới hơn thắng. Xoá được ghi bằng "bia mộ" để việc đã xoá không sống lại từ thiết bị khác.
- Hạn chế đã biết: gộp theo mục, chưa theo từng trường. Hai máy sửa **cùng một việc** cùng lúc thì bản sửa sau thắng.

### Thông báo khi app đóng

App tính sẵn lịch nhắc 48 giờ tới (nhắc trước, đúng giờ, giờ uống nước, gọi dậy) và gửi kèm khi lưu. Máy chủ giữ lịch trong bảng `reminders` và đẩy đúng giờ qua Web Push.

- Gọi dậy chỉ được gửi nếu lúc đó máy chủ thấy bạn vẫn đang ở trạng thái "ngủ".
- Nhắc trễ hơn 30 phút (ví dụ máy chủ vừa khởi động lại) bị bỏ, tránh dội thông báo cũ.
- Mỗi lời nhắc đánh dấu "đã gửi" **trước** khi gửi: thà lỡ một thông báo còn hơn gửi trùng.
- App đang mở: thông báo hiện ngay trong app, không báo hai lần.

### AI

`POST /api/ai/parse` nhận câu của người dùng, ghép với prompt nằm trên máy chủ rồi gọi Anthropic. Mặc định dùng `claude-haiku-5-5` (đổi bằng `AI_MODEL`). Mỗi người tối đa `AI_DAILY_LIMIT` lượt mỗi ngày để chặn chi phí phát sinh.

Khi AI lỗi, hết lượt hoặc mất mạng, app báo rõ nguyên nhân và **giữ nguyên câu đã gõ** để thử lại; các nút tạo nhanh vẫn dùng được. Không có bộ đoán thay thế, nên không bao giờ tạo ra một việc sai âm thầm.

### Đi chợ và định lượng

- AI gợi ý nguyên liệu kèm định lượng dạng số + đơn vị ("500 g", "3 củ") và số người ăn.
- Mỗi món trong danh sách có nút **−** và **+** đi theo bước hợp lý: gam theo 10 hoặc 50, kg và lít theo 0,25 hoặc 0,5, muỗng theo 0,5, còn củ, quả, gói theo 1. Không bao giờ giảm xuống 0. Gõ tay vẫn được.
- **Số người ăn** co giãn mọi định lượng theo tỉ lệ rồi làm tròn gọn: gam và ml tròn đến 5 hoặc 10, kg và lít tròn đến 0,25, còn củ, quả, gói, hộp tròn số nguyên (không bao giờ ra "1,5 gói").
- Remi nhớ danh sách và số người của từng món; lần sau nấu lại món đó, định lượng tự co giãn theo số người mới.
- Logic nằm ở `web/js/qty.js`, có test riêng.

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| POST | `/api/auth/register` | Đăng ký `{email, name, password}` |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |
| GET / DELETE | `/api/me` | Xem tài khoản / xoá tài khoản (cần mật khẩu) |
| GET / PUT | `/api/state` | Đọc / ghi dữ liệu, PUT kèm `baseVersion` và `schedule` |
| GET | `/api/push/key` | Khóa công khai VAPID |
| POST / DELETE | `/api/push/subscribe` | Đăng ký / huỷ thiết bị nhận thông báo |
| POST | `/api/push/test` | Gửi thông báo thử cho chính mình |
| POST | `/api/ai/parse` | AI hiểu câu nói |
| GET | `/api/health` | Kiểm tra sống |

Mọi yêu cầu ghi cần header `X-Remi: 1` (chống CSRF); app tự thêm.

## Bảo mật

- Mật khẩu băm bằng scrypt có muối; không lưu dạng chữ thường.
- Phiên: cookie `HttpOnly`, `SameSite=Lax`, thêm `Secure` khi chạy production; token chỉ lưu dạng băm trong DB.
- Đăng nhập sai quá 10 lần/15 phút bị chặn; trả thông báo chung nên không lộ email nào có tài khoản.
- Tiêu đề bảo mật: CSP chỉ cho script cùng nguồn, `nosniff`, HSTS khi production.
- Khóa Anthropic không bao giờ gửi xuống trình duyệt (có test kiểm tra).
- File tĩnh chặn thoát thư mục (path traversal) và có test.
- Xoá tài khoản xoá luôn dữ liệu, phiên, thiết bị.

Việc **nên làm trước khi mở cho người ngoài**: đặt sau HTTPS, đặt `TRUST_PROXY=1` nếu có proxy, sao lưu file `data/remi.sqlite`, thêm xác minh email và quên mật khẩu (hiện chưa có), cân nhắc đặt `ALLOW_REGISTRATION=0` khi chỉ dùng cho gia đình.

## Triển khai

**Docker** (khuyên dùng):

```bash
cp .env.example .env     # điền khóa, đặt TRUST_PROXY=1 khi có HTTPS phía trước
docker compose up -d --build
```

Dữ liệu nằm trong volume `remi-data`. Thông báo đẩy và cài app lên màn hình chính **bắt buộc HTTPS** (trừ `localhost`). Fly.io, Render, Railway, hay một VPS có Caddy đều dùng được: chỉ cần chạy container, gắn một ổ đĩa vào `/data`, và đặt các biến trong `.env.example`.

Chỉ chạy **một bản sao** của máy chủ vì dữ liệu nằm trong một file SQLite và bộ giới hạn thử đăng nhập nằm trong bộ nhớ. Dùng cho vài trăm người là đủ.

## AI chạy trên máy (dữ liệu không rời máy)

Thư mục `ml/` chứa nền tảng để thay AI đám mây bằng AI chạy ngay trên điện thoại: bộ hiểu câu theo luật, bộ sinh dữ liệu huấn luyện, bộ đo chất lượng và kịch bản tinh chỉnh model nhỏ. **Chưa nối vào giao diện** và chưa có model tự huấn luyện. Xem `ml/README.md`.

## Lên điện thoại thật

- **iPhone**: mở trang bằng Safari, chọn "Thêm vào Màn hình chính" rồi bật thông báo trong app (iOS 16.4 trở lên, thông báo đẩy chỉ hoạt động khi đã thêm vào Màn hình chính).
- **Android**: Chrome sẽ gợi ý cài app, thông báo đẩy hoạt động ngay.
- **Lên App Store / Google Play**: bọc bằng [Capacitor](https://capacitorjs.com) (dùng nguyên `web/`), thay Web Push bằng thông báo đẩy gốc (APNs/FCM). Máy chủ đã tách lịch nhắc nên chỉ cần thêm một bộ gửi trong `server/push.js`.

Biểu tượng nằm ở `web/icons/`; xuất lại PNG từ SVG bằng `npm run icons`.

## Làm việc nhóm

Hướng dẫn đẩy lên GitHub ở `docs/GITHUB.md`, quy ước làm việc ở `CONTRIBUTING.md`. Việc cần làm và ai làm gì do nhóm trao đổi rồi tạo issue và gán trên GitHub. Bản HTML đơn chạy không cần máy chủ nằm ở `standalone/`.

## Đã kiểm tra và chưa kiểm tra

Đã chạy được trong môi trường phát triển: toàn bộ test máy chủ, bài test đầu-cuối trên Chromium, kiểm tra đột biến (cố tình làm hỏng kiểm tra CSRF, đánh dấu đã gửi, kiểm tra phiên bản thì test phải đỏ).

**Chưa kiểm tra** (môi trường phát triển không có mạng, khóa API hay thiết bị thật):
- Gọi Anthropic thật (test dùng máy chủ giả đúng định dạng API).
- Gửi Web Push thật qua gói `web-push` tới Chrome/Safari (test dùng bộ gửi giả; phần mã hoá và gửi do thư viện `web-push` đảm nhiệm).
- `docker build`, workflow GitHub Actions, triển khai trên HTTPS.
- Chạy trên iPhone/Android thật và hành vi thông báo khi bật Tiết kiệm pin.
- `package-lock.json` chưa có: chạy `npm install` một lần rồi commit file đó.

## Việc nên làm tiếp

1. Chạy thử trên điện thoại thật qua HTTPS, chỉnh độ tin cậy của thông báo và gọi dậy.
2. Quên mật khẩu và xác minh email (cần dịch vụ gửi email).
3. Nút hành động ngay trên thông báo: Xong, Nhắc lại sau 10 phút.
4. Chia sẻ việc và danh sách đi chợ với người thân.
5. Gộp theo từng trường nếu cần nhiều người sửa chung một việc.
