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

Thay `TAI-KHOAN` và `TEN-REPO` bằng của bạn. Nên để repo ở chế độ riêng tư (private) cho tới khi chốt giấy phép (quyết định D-2) và rà soát bảo mật.

Trước khi đẩy, kiểm tra không có bí mật nào lọt vào: tệp `.env` và thư mục `data/` đã nằm trong `.gitignore`.

```
git status
```

## 2. Mời thành viên và bảo vệ nhánh main

1. Settings, Collaborators: mời 4 người còn lại.
2. Settings, Branches, Add branch ruleset (hoặc Add rule) cho `main`: bắt buộc pull request, ít nhất 1 người duyệt, bắt buộc các kiểm tra `test` và `docker` phải xanh.
3. Job `browser` đang để cho phép lỗi vì chưa từng chạy trên GitHub. Làm xong việc chung N3 rồi mới đưa nó vào danh sách bắt buộc.

## 3. Chốt người phụ trách và tạo issue

1. Họp ngắn chốt các quyết định ở đầu `docs/TASKS.md`, rồi điền tên mỗi thành viên vào bảng phân công.
2. Xem trước các lệnh sẽ chạy (chưa tạo gì cả):

```
node scripts/create-issues.js
```

3. Cài GitHub CLI, đăng nhập một lần, rồi tạo thật (chỉ chạy **một lần**, chạy lại sẽ tạo issue trùng):

```
gh auth login
node scripts/create-issues.js --run --repo TAI-KHOAN/TEN-REPO --assign A=ten-a,B=ten-b,C=ten-c,D=ten-d,E=ten-e
```

Script tạo nhãn theo chức năng và điểm, mỗi việc thành một issue có bối cảnh, việc cần làm và tiêu chí nghiệm thu dạng hộp tick. Việc của chức năng A đến E gán cho người phụ trách chức năng đó (`--assign A=...,E=...`). Các việc chung N0 đến N7 **không gán ai**, mang nhãn `track:chung`, ai xong phần mình thì nhận. Script này mới chạy thử ở chế độ in lệnh, **chưa chạy thật với GitHub**.

## 4. Theo dõi

Tạo một Project (bảng Kanban) trên GitHub, thêm các issue vào, chia cột Việc mới, Đang làm, Chờ duyệt, Xong. Mỗi người nên có tối đa 2 việc đang làm cùng lúc.

## 5. Khi bảng việc đổi

Sửa `docs/tasks.json`, chạy `npm run tasks:doc`, commit cả hai tệp. Test sẽ kiểm tra bảng vẫn cân bằng giữa 5 chức năng và mọi tệp được nhắc tới đều có thật.
