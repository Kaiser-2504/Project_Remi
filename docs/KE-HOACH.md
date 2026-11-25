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
| M4. Hoàn thiện theo chấm thử | Task 1–4 còn thiếu (xem bảng dưới) | 03/12/2026 | Đang làm |
| M5. Góp ý chéo và nộp bài | Task 5, video demo, dọn repo, nộp | 07/12/2026 | Chưa bắt đầu |

## Việc còn lại

Mỗi dòng là một issue trên GitHub (tạo bằng `scripts/github-setup.js`). Người phụ trách chốt trong buổi họp và ghi vào [PHAN-CONG.md](team/PHAN-CONG.md).

| Mã | Việc | Mục rubric | Mốc | Người phụ trách |
|---|---|---|---|---|
| T1 | Họp chốt phân vai, điền biên bản | 1a | M4 | #1 |
| T2 | Duyệt wireframe 5 màn, ghi góp ý | 1b | M4 | cả nhóm |
| T3 | Tạo milestone và issue, gán người | 1c, 1d | M4 | #1 |
| T4 | Bật bảo vệ nhánh `main`: cần 1 review, CI xanh | 1e | M4 | #1 |
| T5 | Tích hợp Tailwind CSS | 2b | M4 | |
| T6 | Tách Lịch, Thống kê thành trang Next.js có route riêng, đọc CSDL | 2a, 3c | M4 | |
| T7 | Thêm trang Giới thiệu / Liên hệ | 2a | M4 | |
| T8 | Tách bảng riêng cho việc, thói quen, thực đơn, tủ đồ; cập nhật ERD; rà soát lược đồ | 3a | M4 | |
| T9 | Đo Lighthouse các màn chính, lưu report, sửa theo gợi ý | 4a | M4 | |
| T10 | Gắn Google Analytics và Sentry | 4b | M4 | |
| T11 | Góp ý UI/UX cho 2 nhóm khác | 5a | M5 | |
| T12 | Nhận góp ý, sửa và ghi lại quyết định | 5b | M5 | |
| T13 | Dọn repo, sửa README cho khớp Next.js + Supabase | — | M5 | |
| T14 | Bảng test thủ công + ảnh 3 cỡ màn hình | 2c, 2d | M5 | |
| T15 | Quay video demo | — | M5 | |

## Theo dõi

- Bảng **GitHub Projects** (Kanban: Cần làm → Đang làm → Chờ duyệt → Xong), mỗi issue một thẻ.
- Họp mỗi tuần, biên bản ở [docs/team/bien-ban](team/bien-ban/).
- Quy trình commit và PR: xem [CONTRIBUTING.md](../CONTRIBUTING.md#quy-trình-mỗi-việc).
