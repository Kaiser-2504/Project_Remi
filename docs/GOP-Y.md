# Góp ý chéo giữa các nhóm (Task 5)

## 5a. Góp ý đã gửi cho nhóm khác

Theo dõi ở issue [#31](https://github.com/Kaiser-2504/Project_Remi/issues/31). Mỗi góp ý là một issue trên repo của nhóm được góp ý, gồm ưu điểm, vấn đề và đề xuất.

| Nhóm | Repo | Issue góp ý | Người đăng | Ngày | Nội dung chính |
|---|---|---|---|---|---|
| CaRảnh | [letuanlocc/basic_web](https://github.com/letuanlocc/basic_web) | [#77](https://github.com/letuanlocc/basic_web/issues/77) | @quangthong3005-ai | 26/11/2026 | Bản Next.js phụ thuộc bản triển khai thứ hai; các trang đều `'use client'`; thiếu trang Giới thiệu/Liên hệ; hai giao diện song song; chưa có video demo |
| NutriVN | [Tl4826/Myproject](https://github.com/Tl4826/Myproject) | [#42](https://github.com/Tl4826/Myproject/issues/42) | @quangthong3005-ai | 26/11/2026 | README chưa khớp code (Next.js, API đăng nhập); CSDL MySQL và nhật ký lưu `localStorage`; bảng `meals` thiếu `user_id`; thiếu trang Giới thiệu/Liên hệ; backend nằm ở nhánh chưa gộp |

### Bảng 5b: Tiếp nhận và xử lý góp ý UI/UX từ nhóm bạn (Issue #55)

| STT | Nội dung góp ý từ nhóm bạn | Quyết định | Lý do / Hướng xử lý | Tình trạng |
| :-: | :--- | :---: | :--- | :---: |
| 1 | Thêm nút ẩn/hiện mật khẩu và gợi ý độ dài "Tối thiểu 8 ký tự" tại trang Đăng ký. | **Làm ngay** | Tránh người dùng gõ sai mật khẩu trên điện thoại khi không có ô nhập lại. | Đã hoàn thành (PR #58) |
| 2 | Bổ sung placeholder gợi ý vào ô nhập trang chủ; đổi nút "Thêm" rõ nghĩa. | **Làm ngay** | Giúp người dùng mới hiểu rõ công dụng tạo việc nhanh bằng AI; đổi nút thành "Tạo việc →". | Đã hoàn thành (PR #58) |
| 3 | Trùng lặp nhận thức giữa nút "Hẹn lịch" và tab "Lịch". | **Làm ngay** | Tránh nhầm lẫn giữa hành động nhanh (Action) và màn hình xem (View); đổi thành "Đặt lịch hẹn". | Đã hoàn thành (PR #58) |
| 4 | Thanh điều hướng 6 tab bị chật; icon "Lịch" và "Sắp tới" bị trùng biểu tượng. | **Làm ngay** | Đổi icon tab "Sắp tới" sang hình đồng hồ (Clock) để phân biệt rõ ràng trên màn hình nhỏ. | Đã hoàn thành (PR #58) |
| 5 | Thanh trượt Ngủ/Thức khó thao tác khi ngái ngủ; hướng kéo khó nhận biết. | **Backlog** | Cần thiết kế lại cơ chế chạm 1-tap kết hợp thông báo Toast; chuyển sang đợt cập nhật tính năng sau. | Đang chờ |
| 6 | Tích hợp dữ liệu giờ ngủ/thức dậy vào tab Lịch để xem và chỉnh sửa lại. | **Backlog** | Cần cập nhật schema lưu trữ và truy vấn timeline sự kiện; chuyển sang đợt cập nhật sau. | Đang chờ |
