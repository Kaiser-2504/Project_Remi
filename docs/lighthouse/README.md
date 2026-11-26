# Lighthouse các màn chính (mục 4a)

Đo bằng Lighthouse CLI, chế độ **Navigation**, giả lập **điện thoại**, trên bản đang chạy `https://project-remi.vercel.app`, ngày 26/11/2026.

| Màn | URL đo | Performance | Accessibility | Best practices | SEO | Report |
|---|---|---|---|---|---|---|
| Trang chủ (Hôm nay) | `/` | 76 | 100 | 96 | 100 | [trang-chu.html](trang-chu.html) |
| Lịch tháng | `/lich` | 98 | 95 | 100 | 100 | [lich.html](lich.html) |
| Thống kê | `/thong-ke` | 99 | 95 | 100 | 100 | [thong-ke.html](thong-ke.html) |
| Bếp | `/?tab=kitchen` | _(chờ đo)_ | | | | `bep.html` |
| Thói quen | `/?tab=habits` | _(chờ đo)_ | | | | `thoi-quen.html` |

Mở report: tải file `.html` về rồi mở bằng trình duyệt.

## Ghi chú

- Bếp và Thói quen là tab trong trang chính, không có đường dẫn riêng (`/bep`, `/thoi-quen` trả về 404). Từ bản này, app mở thẳng tab qua tham số `?tab=` (`today`, `cal`, `soon`, `habits`, `kitchen`, `stats`), nên đo được từng màn.
- `/lich` và `/thong-ke` đo khi chưa đăng nhập, nên đây là màn mời đăng nhập. Muốn đo màn có dữ liệu: đăng nhập trong Chrome, dùng Lighthouse trong DevTools và bỏ chọn **Clear storage**.

## Việc cần sửa theo report trang chủ

| Chỉ số | Giá trị | Gợi ý của Lighthouse |
|---|---|---|
| LCP | 5.9 s (điểm thấp) | Phần tử lớn nhất hiện muộn |
| Tài nguyên chặn hiển thị | tiết kiệm ~870 ms | Nạp CSS/script không chặn (`defer`, preload) |
| JavaScript không dùng | ~101 KiB | Tách hoặc nạp sau các phần không cần ngay |
| FCP / TBT / CLS | 2.2 s / 70 ms / 0 | Đạt |

## Đo lại

```bash
mkdir -p ~/Desktop/lighthouse && cd ~/Desktop/lighthouse && \
BASE="https://project-remi.vercel.app" && \
for page in "trang-chu:/" "lich:/lich" "thong-ke:/thong-ke" "bep:/?tab=kitchen" "thoi-quen:/?tab=habits"; do
  name="${page%%:*}"; route="${page#*:}"
  npx -y lighthouse "$BASE$route" --form-factor=mobile \
    --output html --output-path "./$name.html" --chrome-flags="--headless=new" --quiet
done && open .
```

Không đặt tên biến là `path` trong zsh, vì nó ghi đè `PATH`.
