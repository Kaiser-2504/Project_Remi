# Phân vai và trách nhiệm nhóm 2 (Basic 2)

Thống nhất qua trao đổi trong nhóm, tổng hợp ở [biên bản](bien-ban/2026-11-26-chot-ke-hoach-cuoi.md). Người ghi: Nguyễn Quang Thông.

## Thành viên và vai trò

| # | Họ tên | Mã SV | GitHub | Vai trò chính | Vai trò phụ |
|---|---|---|---|---|---|
| 1 | Trương Quang Trung | 24090030 | [@Kaiser-2504](https://github.com/Kaiser-2504) (commit tên *Kaiser* / *Quang Trung*) | **Trưởng nhóm**, quản lý repo, CI và triển khai (Vercel) | Chức năng B (Bếp), lớp dữ liệu Supabase (Người 1) |
| 2 | Trần Thị Thu Tuyết | 24090029 | [@tuyettran240929-cell](https://github.com/tuyettran240929-cell) (commit tên *Thu Tuyet*) | Chức năng C: Thống kê, chuỗi ngày, huy hiệu | Khung Next.js `remi-next` (Người 2) |
| 3 | Bùi Hoàng Vũ | 24090032 | [@vubui240932-cell](https://github.com/vubui240932-cell) | Chức năng D: Lịch nâng cao | Đăng nhập, phiên, CSRF (Người 3) |
| 4 | Nguyễn Quang Thông | 24090037 | [@quangthong3005-ai](https://github.com/quangthong3005-ai) | API và hợp đồng dữ liệu (Người 4, D5) | Duyệt và gộp PR |
| 5 | Nguyễn Tất Thành | 24090054 | [@spector-255006](https://github.com/spector-255006) (commit tên *JohnGitHub*) | Chức năng E: Nhập nhanh thông minh, AI | Gợi ý nhanh, thông báo trong app |

## Trách nhiệm theo phần của rubric

| Mục | Phụ trách chính | Hỗ trợ |
|---|---|---|
| 1. Kế hoạch, wireframe, ticket, quy trình GitHub | #1 | cả nhóm |
| 2. Giao diện, responsive, tương tác | #2, #3, #5 | #1 |
| 3. CSDL, API, trang động | #1, #4 | #3 |
| 4. Lighthouse, GA, Sentry | #2 (Lighthouse: PR #43, #45), #4 (đo đủ 5 màn: PR #46, #48; GA và Sentry: PR #37) | #1 (ảnh GA, Sentry: PR #47) |
| 5. Góp ý và nhận góp ý nhóm khác (#31, #32) | cả nhóm, mỗi người góp ý ít nhất 1 màn | #4 tổng hợp |
| Video demo (#35) | cả nhóm, mỗi người trình bày phần mình làm | #1 dựng video |

## Quy ước làm việc đã thống nhất

- Mỗi việc là một **issue** có người phụ trách và milestone.
- Nhánh: `<mã việc>-<mô tả>`, ví dụ `T1-wireframe`.
- Commit nhỏ, ghi số issue: `feat(lich): kéo thả việc (#23)`.
- PR ghi `Closes #n`, **ít nhất 1 người khác duyệt**, CI xanh mới gộp.
- Họp nhóm mỗi tuần, ghi biên bản vào `docs/team/bien-ban/`.

## Đã làm tới nay

| Thành viên | Phần đã làm | PR / commit tiêu biểu |
|---|---|---|
| #1 | Khởi tạo dự án, tab Bếp (B), kiểm thử đột biến, mô hình AI cơ bản, Supabase + RLS, chạy trên Vercel/Next.js | #2, #9, #15, #20 |
| #2 | Thống kê tuần/tháng (C2), huy hiệu (C3), chuỗi ngày, khung `remi-next` | #1, `remi-next` |
| #3 | Lịch nâng cao (timeline, kéo thả, trùng giờ, .ics), đăng nhập + CSRF, sửa bố cục | `feat(lich)`, `feat(auth)` |
| #4 | Zod, `/api/state`, push, AI TypeScript, contract test, sửa postgres v4 | #14 |
| #5 | Nhập nhanh thông minh (E), gợi ý nhanh, nút Xong / Nhắc lại sau 10 phút | `E_NhapNhanhThongMinh`, `Feat/AI` |
