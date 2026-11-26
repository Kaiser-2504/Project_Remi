# Theo dõi hành vi và ghi lỗi (mục 4b)

| Công cụ | Dùng để | Code |
|---|---|---|
| **Google Analytics 4** | Đếm lượt xem, người dùng, màn nào được dùng nhiều (sự kiện `tab_view`) | `web/js/monitor.js` |
| **Sentry** | Gom lỗi ở trình duyệt và máy chủ về một chỗ, có stack trace, môi trường, phiên bản | `web/js/monitor.js`, `lib/monitor.js` |

Không dùng gói `@sentry/nextjs`: cả hai phía gửi lỗi thẳng qua envelope API của Sentry nên không thêm thư viện và giữ được CSP chặt (không cho script nội tuyến).

## Dữ liệu được gửi

- GA: lượt xem trang, sự kiện `tab_view` kèm tên tab. IP được ẩn (`anonymize_ip`).
- Sentry: tên lỗi, thông báo lỗi, stack trace, đường dẫn trang (không có query), trình duyệt.
- **Không gửi** email, tên người dùng, nội dung việc hay câu nói.

## Cài đặt

1. **GA4:** analytics.google.com → tạo property *Remi* → Data stream *Web* với tên miền Vercel → lấy **Measurement ID** (`G-...`).
2. **Sentry:** sentry.io → tạo project *Browser JavaScript* tên `remi` → Settings → Client Keys → lấy **DSN**.
3. Vercel → Project → Settings → Environment Variables, thêm:

   | Biến | Giá trị |
   |---|---|
   | `NEXT_PUBLIC_GA_ID` | `G-...` |
   | `NEXT_PUBLIC_SENTRY_DSN` | DSN |
   | `SENTRY_DSN` | cùng DSN |

4. Redeploy. Mã GA và DSN được ghi vào `public/js/monitor-config.js` lúc build.

## Kiểm tra

- **GA:** mở trang, bấm qua các tab → GA → Reports → Realtime thấy người dùng và sự kiện `tab_view`.
- **Sentry, giao diện:** mở `https://<tên-miền>/?sentry-test=1` → Sentry → Issues có *lỗi thử (giao diện)*.
- **Sentry, máy chủ:** `SENTRY_DSN=... npm run sentry:test` → có *lỗi thử (máy chủ)*. Lỗi 500 thật của API và lỗi cron cũng tự gửi lên.
- Test tự động: `npm test` (file `lib/test/monitor.test.js`).

## Bằng chứng

Lưu ảnh chụp vào `docs/theo-doi/`:

| Ảnh | Nội dung |
|---|---|
| `ga-realtime.png` | GA Realtime có người dùng và sự kiện `tab_view` |
| `sentry-issues.png` | Sentry Issues có lỗi thử từ giao diện và máy chủ |
| `sentry-chi-tiet.png` | Chi tiết một lỗi: stack trace, môi trường, trình duyệt |
