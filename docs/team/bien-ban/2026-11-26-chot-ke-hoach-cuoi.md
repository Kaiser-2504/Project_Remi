# Biên bản nhóm 2: Chốt phân vai và kế hoạch giai đoạn cuối

- **Người ghi biên bản:** Nguyễn Quang Thông

Nhóm thống nhất qua tin nhắn trong nhóm chat. Biên bản này tổng hợp lại các điểm đã chốt.

## Nội dung

1. Đọc kết quả chấm thử (3.75/10), thống nhất các phần cần lấy lại điểm.
2. Chốt bảng [PHAN-CONG.md](../PHAN-CONG.md): họ tên, mã SV, người phụ trách từng phần.
3. Chốt [kế hoạch](../../KE-HOACH.md): milestone, hạn, issue cho từng việc.
4. Chốt cách phối hợp trên GitHub.

## Thời hạn đã thống nhất

| Mốc | Nội dung | Hạn | Issue |
|---|---|---|---|
| M4. Hoàn thiện theo chấm thử | Task 1–4 còn thiếu: wireframe, bảo vệ nhánh, Tailwind, trang Next.js, tách bảng CSDL, Lighthouse, GA và Sentry | 03/12/2026 | #21–#30 |
| M5. Góp ý chéo và nộp bài | Góp ý cho 2 nhóm khác, nhận góp ý và sửa, bảng test, dọn repo, video demo | 07/12/2026 | #31–#35 |

Ai phụ trách phần nào: người đó nhận issue và mở PR tương ứng trên GitHub. Chi tiết ở [PHAN-CONG.md](../PHAN-CONG.md#trách-nhiệm-theo-phần-của-rubric).

## Cách phối hợp đã thống nhất

| # | Quy định | Lý do |
|---|---|---|
| 1 | Mỗi việc là một issue trên GitHub, gắn milestone M4 hoặc M5 | Theo dõi được tiến độ và ai làm gì |
| 2 | Mỗi việc làm trên nhánh riêng `<mã việc>-<mô tả>`, ví dụ `T9-lighthouse-du-5-man` | Không sửa thẳng vào `main` |
| 3 | Commit ghi số issue, ví dụ `(#29)`; PR ghi `Closes #n` | Nối commit và PR với issue |
| 4 | PR cần ít nhất 1 thành viên khác duyệt (Approve) rồi mới gộp; CI phải xanh | Kiểm tra chéo trước khi vào `main` |
| 5 | Trao đổi hằng ngày qua nhóm chat; việc bị chậm thì báo trong issue tương ứng | Ai cũng thấy tình trạng việc |
| 6 | Góp ý cho nhóm khác và nhận góp ý đều làm bằng issue trên GitHub (#31, #32) | Có bằng chứng cho Task 5 |

## Việc cần làm tiếp

| Việc | Issue | Hạn |
|---|---|---|
| Bật bảo vệ nhánh `main`: cần 1 review, CI xanh | #24 | 03/12/2026 |
| Duyệt wireframe 5 màn, ghi góp ý vào issue | #22 | 03/12/2026 |
| Góp ý UI/UX cho 2 nhóm khác | #31 | 07/12/2026 |
| Nhận góp ý, sửa và ghi lại quyết định | #32 | 07/12/2026 |
| Quay video demo | #35 | 07/12/2026 |
