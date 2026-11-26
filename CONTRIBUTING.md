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

Kế hoạch và danh sách việc: [docs/KE-HOACH.md](docs/KE-HOACH.md). Phân vai: [docs/team/PHAN-CONG.md](docs/team/PHAN-CONG.md).

1. **Có issue trước khi làm.** Mỗi việc là một issue có người phụ trách và milestone. Chưa có thì tạo theo mẫu *Việc cần làm*.
2. Kéo thẻ sang *Đang làm* trên bảng GitHub Projects.
3. Tách nhánh từ `main`, đặt tên `<mã việc>-<mô tả ngắn>`, ví dụ `T5-tailwind`.
4. **Commit nhỏ, mỗi commit một ý**, theo Conventional Commits và ghi số issue:
   ```
   feat(lich): kéo thả việc sang ngày khác (#23)
   fix(bep): gộp nguyên liệu trùng tên (#24)
   docs(wireframe): thêm màn Thống kê (#2)
   ```
   Loại: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`.
5. Mở pull request theo mẫu. Tiêu đề cũng theo dạng trên, thân PR có dòng `Closes #23`. **CI kiểm tra hai điều này** (`.github/workflows/pr-check.yml`).
6. **Ít nhất một người khác duyệt** (nhánh `main` được bảo vệ). Người duyệt chạy thử thật phần giao diện và để lại nhận xét, không duyệt trong vài phút cho xong.
7. CI xanh và đã được duyệt thì gộp kiểu squash. Issue tự đóng nhờ `Closes #n`.

### Bật bảo vệ nhánh (trưởng nhóm làm một lần)

Settings → Branches → Add rule cho `main`: *Require a pull request before merging* (1 approval), *Require status checks to pass* (chọn CI và PR check), *Do not allow bypassing*.

### Tạo milestone và issue (làm một lần)

```bash
gh auth login
node scripts/github-setup.js          # xem trước
node scripts/github-setup.js --run    # tạo thật
```

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
