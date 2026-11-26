# Wireframe Remi

Wireframe low-fi cho 5 màn chính, mỗi màn có 2 bản: **điện thoại** (dưới 640px, thanh điều hướng dưới) và **máy tính** (từ 1280px, thanh bên + cột phụ). Bản máy tính bảng nằm giữa hai bản này, xem bảng bố cục trong README gốc.

Số màu cam trên hình ứng với *Ghi chú hành vi* bên cạnh.

| Màn | Điện thoại | Máy tính | Đường dẫn trong app |
|---|---|---|---|
| Hôm nay | ![](hom-nay-mobile.svg) | ![](hom-nay-desktop.svg) | `/` |
| Lịch | ![](lich-mobile.svg) | ![](lich-desktop.svg) | `/lich` (trang Next.js) và `/?tab=cal` |
| Thói quen | ![](thoi-quen-mobile.svg) | ![](thoi-quen-desktop.svg) | `/?tab=habits` |
| Bếp | ![](bep-mobile.svg) | ![](bep-desktop.svg) | `/?tab=kitchen` |
| Thống kê | ![](thong-ke-mobile.svg) | ![](thong-ke-desktop.svg) | `/thong-ke` (trang Next.js) và `/?tab=stats` |

## Công cụ vẽ

Wireframe vẽ bằng mã: script Python `make_wireframes.py` sinh ra file SVG, không dùng Figma hay Adobe XD. Ưu điểm: sửa được qua PR như mã nguồn, xem lịch sử thay đổi trên GitHub. File gốc chính là script này.

## Sửa wireframe

Nội dung nằm trong `make_wireframes.py`, mỗi màn là một hàm. Sửa xong thì chạy:

```bash
python3 docs/wireframes/make_wireframes.py
```


## Lịch sử duyệt

Nhóm duyệt wireframe trên issue [#22](https://github.com/Kaiser-2504/Project_Remi/issues/22): mỗi thành viên comment góp ý cho màn mình phụ trách. Người tổng hợp (Nguyễn Quang Thông) chép kết quả vào bảng dưới, kèm link comment.

| Màn | Người góp ý | Góp ý | Xử lý | Link comment |
|---|---|---|---|---|
| Hôm nay | | | | |
| Lịch | | | | |
| Thói quen | | | | |
| Bếp | | | | |
| Thống kê | | | | |

## Khác biệt giữa wireframe và app hiện tại

| Màn | Wireframe | App hiện tại |
|---|---|---|
| Lịch | Xem theo tuần, có nút Tuần/Ngày | Có thêm chế độ Tháng (mặc định), và trang Next.js `/lich` hiển thị tháng |
| Thói quen, Bếp | Route dự kiến `/thoi-quen`, `/bep` | Là tab trong trang chính, mở thẳng bằng `/?tab=habits`, `/?tab=kitchen` |
| Thống kê | Một màn trong app | Có thêm trang Next.js `/thong-ke` đọc từ CSDL |
