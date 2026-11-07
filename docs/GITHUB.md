# Đưa Remi lên GitHub và chia việc

## 1. Tạo repo và đẩy mã

Trên GitHub tạo repo **trống** (không tick thêm README, .gitignore hay license, vì repo đã có sẵn). Rồi trong thư mục dự án:

```
git init
git add .
git commit -m "Khởi tạo dự án Remi"
git branch -M main
git remote add origin https://github.com/TAI-KHOAN/TEN-REPO.git
git push -u origin main
```

Thay `TAI-KHOAN` và `TEN-REPO` bằng của bạn. Nên để repo ở chế độ riêng tư (private) cho tới khi chốt giấy phép (hiện package.json ghi UNLICENSED, chưa có tệp LICENSE) và rà soát bảo mật.

Trước khi đẩy, kiểm tra không có bí mật nào lọt vào: tệp `.env` và thư mục `data/` đã nằm trong `.gitignore`.

```
git status
```

## 2. Mời thành viên và bảo vệ nhánh main

1. Settings, Collaborators: mời các thành viên còn lại.
2. Settings, Branches, Add branch ruleset (hoặc Add rule) cho `main`: bắt buộc pull request, ít nhất 1 người duyệt, bắt buộc các kiểm tra `test` và `docker` phải xanh.
3. Job `browser` đang để cho phép lỗi vì chưa từng chạy trên GitHub. Khi nó chạy xanh ổn định thì mới đưa vào danh sách bắt buộc.

## 3. Tạo issue và chia việc

Cả nhóm trao đổi xem cần làm gì và ai làm phần nào. Sau đó trên GitHub, tab Issues, bấm New issue, chọn mẫu **Việc cần làm** (có sẵn bối cảnh, việc cần làm, tiêu chí nghiệm thu), điền nội dung rồi gán người ở mục Assignees bên phải.

## 4. Theo dõi

Tạo một Project (bảng Kanban) trên GitHub, thêm các issue vào, chia cột Việc mới, Đang làm, Chờ duyệt, Xong. Mỗi người nên có tối đa 2 việc đang làm cùng lúc.
