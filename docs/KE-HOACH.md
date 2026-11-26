# Kế hoạch dự án Remi (nhóm 2, Basic 2)

## Phạm vi

Remi là trợ lý nhắc việc và thói quen. Người dùng nói một câu tự nhiên, AI tạo nhắc hẹn, danh sách đi chợ hoặc thói quen.

**Trong phạm vi:** đăng ký/đăng nhập, nhập câu tự nhiên bằng AI, nhắc hẹn và thông báo đẩy, Lịch (tuần/ngày, kéo thả, .ics), Thói quen, Bếp (thực đơn tuần, tủ đồ, đi chợ), Thống kê và huy hiệu, đồng bộ nhiều thiết bị, PWA, responsive.

**Ngoài phạm vi (để sau):** chia sẻ gia đình (chức năng A trong bảng việc cũ), chụp ảnh thành danh sách, ứng dụng di động gốc.

**Công nghệ:** Next.js (Route Handler) trên Vercel, PostgreSQL (Supabase), JavaScript/TypeScript, CI trên GitHub Actions.

## Mốc thời gian

| Mốc | Nội dung | Hạn | Trạng thái |
|---|---|---|---|
| M1. Nền tảng | Khởi tạo dự án, quy trình, CI, bảng việc theo chức năng | 07/11/2026 | Xong |
| M2. Chức năng chính | Bếp (B), Thống kê và huy hiệu (C), Lịch nâng cao (D), Nhập nhanh (E) | 11/11/2026 | Xong |
| M3. Next.js + CSDL | Supabase + RLS, đăng nhập, API có Zod, chạy trên Vercel | 24/11/2026 | Xong (chấm thử 24/11: 3.75/10) |
| M4. Hoàn thiện theo chấm thử | Task 1–4 còn thiếu (xem bảng dưới) | 03/12/2026 | Đang làm (8/12 issue xong) |
| M5. Góp ý chéo và nộp bài | Task 5, video demo, dọn repo, nộp | 07/12/2026 | Chưa bắt đầu |

## Việc còn lại

Mỗi dòng là một issue trên GitHub (tạo bằng `scripts/github-setup.js`). Người phụ trách được thống nhất trong nhóm (xem [biên bản](team/bien-ban/2026-11-26-chot-ke-hoach-cuoi.md)) và ghi vào [PHAN-CONG.md](team/PHAN-CONG.md).

| Mã | Việc | Mục rubric | Mốc (hạn) | Issue | Người phụ trách | Trạng thái |
|---|---|---|---|---|---|---|
| T1 | Chốt phân vai, điền biên bản | 1a | M4 (03/12) | #21 | Nguyễn Quang Thông | Đang làm |
| T2 | Duyệt wireframe 5 màn, ghi góp ý | 1b | M4 (03/12) | #22 | cả nhóm, Nguyễn Quang Thông tổng hợp | Đang làm |
| T3 | Tạo milestone và issue, gán người | 1c, 1d | M4 (03/12) | #23 | Nguyễn Quang Thông (PR #36) | Xong |
| T4 | Bật bảo vệ nhánh `main`: cần 1 review, CI xanh | 1e | M4 (03/12) | #24 | Trương Quang Trung (chủ repo) | Chưa làm |
| T5 | Tích hợp Tailwind CSS | 2b | M4 (03/12) | #25 | Nguyễn Tất Thành (PR #49) | Chờ duyệt |
| T6 | Tách Lịch, Thống kê thành trang Next.js có route riêng, đọc CSDL | 2a, 3c | M4 (03/12) | #26 | Nguyễn Quang Thông (PR #39) | Xong |
| T7 | Thêm trang Giới thiệu / Liên hệ | 2a | M4 (03/12) | #27 | Nguyễn Quang Thông (PR #39) | Xong |
| T8 | Tách bảng riêng, cập nhật ERD, rà soát lược đồ | 3a | M4 (03/12) | #28 | Nguyễn Quang Thông (PR #40) | Xong, còn bảng rà soát |
| T9 | Đo Lighthouse các màn chính, lưu report, sửa theo gợi ý | 4a | M4 (03/12) | #29 | Trần Thị Thu Tuyết (PR #43, #45), Nguyễn Quang Thông (PR #46, #48) | Xong |
| T10 | Gắn Google Analytics và Sentry | 4b | M4 (03/12) | #30 | Nguyễn Quang Thông (PR #37), Trương Quang Trung (PR #47) | Xong |
| T11 | Góp ý UI/UX cho 2 nhóm khác | 5a | M5 (07/12) | #31 | cả nhóm | Chưa làm |
| T12 | Nhận góp ý, sửa và ghi lại quyết định | 5b | M5 (07/12) | #32 | cả nhóm | Chưa làm |
| T13 | Dọn repo, sửa README cho khớp Next.js + Supabase | — | M5 (07/12) | #33 | Nguyễn Quang Thông (PR #38) | Xong |
| T14 | Bảng test thủ công + ảnh 3 cỡ màn hình | 2c, 2d | M5 (07/12) | #34 | Trần Thị Thu Tuyết (PR #44) | Xong |
| T15 | Quay video demo | — | M5 (07/12) | #35 | cả nhóm, Trương Quang Trung dựng | Chưa làm |

## Theo dõi

- Bảng **GitHub Projects** (Kanban: Cần làm → Đang làm → Chờ duyệt → Xong), mỗi issue một thẻ.
- Họp mỗi tuần, biên bản ở [docs/team/bien-ban](team/bien-ban/).
- Quy trình commit và PR: xem [CONTRIBUTING.md](../CONTRIBUTING.md#quy-trình-mỗi-việc).
