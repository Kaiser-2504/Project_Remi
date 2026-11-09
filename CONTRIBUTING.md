# Cùng làm Remi

## Bắt đầu

Cần Node.js 22.13 trở lên (`.nvmrc` ghi 22).

```
npm install
cp .env.example .env
npm start
```

Mở http://localhost:3000. Chưa có `ANTHROPIC_API_KEY` thì câu nói chưa được AI hiểu, nhưng các nút tạo nhanh vẫn dùng được.

## Kiểm thử

| Lệnh | Kiểm gì | Cần trình duyệt |
|---|---|---|
| `npm test` | Máy chủ, bộ tính định lượng, bộ hiểu câu, cấu hình repo | Không |
| `npm run test:e2e` | Đăng ký, AI, đồng bộ hai thiết bị, thông báo, đăng xuất | Có |
| `npm run test:responsive` | Bố cục ở 7 cỡ màn hình | Có |
| `npm run test:features` | Chia lượng nước, bộ chọn ngày giờ | Có |
| `npm run test:kitchen` | Tab Bếp (nhóm B): thực đơn tuần, đi chợ, tủ đồ, gợi ý món, đồng bộ hai máy | Có |
| `npm run test:mutation` | Kiểm thử đột biến cho `web/js/kitchen.js` (khoảng 1 phút) | Không |
| `npm run ml:eval` | Chất lượng bộ hiểu câu trên các câu viết tay | Không |

Ba bộ test trình duyệt dùng Chrome do puppeteer tải về. Có sẵn Chrome thì đặt `CHROME_PATH` trỏ tới nó.

## Quy trình mỗi việc

1. Nhận một issue đã được gán cho bạn trên GitHub (cả nhóm trao đổi và thống nhất phân công trước).
2. Tách nhánh từ `main`, đặt tên `<mã việc>-<mô tả ngắn>`, ví dụ `A1-quen-mat-khau`.
3. Commit nhỏ, thông điệp nói rõ làm gì và vì sao.
4. Mở pull request theo mẫu. **Đề xuất mặc định:** ít nhất một người khác duyệt, CI xanh mới gộp, gộp kiểu squash. Cả nhóm chốt lại quy ước này khi họp.
5. Người duyệt chạy thử thật phần giao diện, không chỉ đọc mã.

## Quy tắc

- **Mỗi thay đổi có test.** Việc không thể test tự động thì ghi cách kiểm tra bằng tay trong pull request.
- **Test phải đỏ khi mã sai.** Khi viết test, thử làm hỏng mã một chút và xem test có đỏ không. Nhiều lỗi của dự án này được bắt bằng cách đó.
- **Không đưa vào repo:** tệp `.env`, thư mục `data/`, khóa API, mật khẩu, dữ liệu người dùng thật, ảnh chụp có thông tin cá nhân.
- **Nói rõ điều chưa kiểm tra được.** Chưa thử trên điện thoại thật, chưa thử thông báo đẩy thật... thì ghi thẳng trong pull request.
- **Đụng giao diện thì xem ở hai cỡ:** điện thoại dọc (390px) và màn hình máy tính (1440px), cùng kiểu 320px nếu có bộ chọn hay danh sách mới.
- **Đụng thời gian thì test với đồng hồ cố định**, đừng viết test chỉ đúng vào một giờ nhất định trong ngày.

## Cấu trúc thư mục

| Thư mục | Nội dung |
|---|---|
| `server/` | Máy chủ Node (không thư viện ngoài, trừ web-push), API, đăng nhập, bộ gửi lời nhắc, AI |
| `web/` | Ứng dụng web (cài được như app): `js/app.js` là phần lớn logic, `sw.js` là service worker |
| `ml/` | Dữ liệu huấn luyện, bộ đo chất lượng, kịch bản tinh chỉnh model |
| `e2e/` | Các bộ test trình duyệt |
| `standalone/` | Bản HTML đơn chạy không cần máy chủ (ảnh chụp, xem README trong đó) |
| `docs/` | Hướng dẫn đưa lên GitHub |
| `scripts/` | Công cụ nhỏ: xuất biểu tượng, kiểm thử đột biến |

## Mẹo khi dùng terminal

Khi dán lệnh vào terminal macOS (zsh), **đừng dán kèm chữ chú thích sau dấu `#`**, zsh sẽ hiểu nhầm thành đối số của lệnh. Dán từng lệnh một.
