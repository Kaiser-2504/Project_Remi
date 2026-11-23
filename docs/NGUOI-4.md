# Người 4: nghiệp vụ API và hợp đồng (D5)

Phần này gồm: Zod cho mọi payload, `GET/PUT /api/state` (khóa lạc quan), đăng ký thiết bị push, AI bằng TypeScript
(thời gian chờ, đếm lượt, 503/429), phân biệt lỗi dự đoán được và lỗi bất ngờ, và bộ test hợp đồng chạy với `BACKEND_URL`.

## Tệp mới

| Đường dẫn | Việc |
|---|---|
| `docs/API.md` | Hợp đồng API (nguồn sự thật). Lấy từ hành vi của server hiện có, **cả nhóm cần đọc và chốt** |
| `contract/api.contract.test.js` | Test hợp đồng, chỉ dùng `node:test`, chạy với `BACKEND_URL` hoặc tự bật server cũ |
| `remi-next/lib/schemas.ts` | Mọi schema Zod (tài khoản, state, lịch nhắc, push, AI vào/ra) và ánh xạ lỗi |
| `remi-next/lib/errors.ts` | `ApiError` (lỗi dự đoán được) và `errorResponse` (lỗi bất ngờ → 500 + `requestId`, chi tiết vào log) |
| `remi-next/lib/api-kit.ts` | `readJson(req, schema, codes)`: đọc body, kiểm tra Zod, ném 400/413 |
| `remi-next/lib/ai.ts` | Gọi Anthropic: timeout, phân loại lỗi, kiểm tra kết quả bằng Zod |
| `remi-next/lib/ports.ts` | Giao diện `DataStore`/`RequireUser` giữa phần API và phần dữ liệu, xác thực |
| `remi-next/lib/store-pg.ts` | `DataStore` trên Postgres: khóa lạc quan, đồng bộ lịch nhắc, đếm lượt AI, thiết bị push |
| `remi-next/lib/handlers/*.ts` | Handler thuần (`Request` → `Response`) cho state, push, AI |
| `remi-next/lib/db.ts` | Kết nối postgres.js (bản sao của `remi-db/lib/db.ts` để `@/lib/db` chạy trong `remi-next`, pooler 6543, `prepare: false`) |
| `remi-next/lib/wire.ts` | Nối `sql` (`lib/db.ts`) và `requireUser` (`lib/auth.ts` của Người 3) vào các handler |
| `remi-next/app/api/{state,push/subscribe,push/key,ai/parse}/route.ts` | Route Next.js mỏng, thay cho phần khung 501 của Người 2 |
| `remi-next/test/{schemas,ai,handlers,store-pg}.test.ts` | Test đơn vị và test `store-pg.ts` trên Postgres thật với schema của Người 1 |

## Chạy với cơ sở dữ liệu thật

```
cd remi-next && npm install
# tạo bảng một lần (kết nối TRỰC TIẾP cổng 5432, xem remi-db/.env.example)
psql "$DATABASE_URL_DIRECT" -f ../remi-db/db/migrations/001_init.sql -f ../remi-db/db/migrations/002_auth.sql
DATABASE_URL=<chuỗi pooler 6543> npm run dev          # http://localhost:3000
BACKEND_URL=http://localhost:3000 npm run test:contract   # ở cửa sổ khác, từ thư mục gốc
```

`DATABASE_URL` phải trỏ tới cơ sở dữ liệu **dev**: test hợp đồng tạo và xoá người dùng thử. Muốn thử trên bản đã deploy thì đặt `BACKEND_URL=https://<preview>.vercel.app`.
Bản chạy độc lập tạm trước đây (`remi-next/standalone/`) đã bỏ vì phần của Người 1, 2, 3 đã có trong `main`.

## Chạy test

```
npm run test:contract                         # tự bật server Node cũ, không cần cấu hình
BACKEND_URL=https://<preview>.vercel.app npm run test:contract   # với bản đang triển khai và DB thật
npm run test:next                             # test của remi-next (cần có thư viện zod)
PG_TEST_URL="host=localhost port=5432 dbname=remitest" npm run test:next   # thêm test store-pg.ts trên Postgres thật
```

- `test:next` cần Node ≥ 22.18 (chạy trực tiếp file `.ts`) và gói `zod`: chạy `npm install zod` ở thư mục gốc hoặc trong `remi-next/`.
- `PG_TEST_URL` trỏ tới cơ sở dữ liệu **thử** đã chạy `remi-db/db/migrations/*.sql` (schema `remi`; trên Postgres thường cần tạo trước hai vai trò rỗng `anon` và `authenticated`). Test sẽ **xoá sạch bảng `remi.users` và mọi bảng liên quan** trong cơ sở dữ liệu đó. Không bao giờ trỏ vào dữ liệu thật. Cần có `psql` trong máy (test dùng nó thay cho `postgres.js`).
- Contract test tạo vài người dùng ngẫu nhiên mỗi lần chạy (dưới 10 lần đăng ký) và xoá khi xong. Đăng ký bị giới hạn theo IP, nên chạy liên tiếp quá nhiều lần trong một giờ sẽ gặp `429`; đợi một giờ hoặc xoá các dòng `remi.rate_limits` trong DB dev.

## Những giả định cần xác nhận với nhóm

1. **Schema** (Người 1): `store-pg.ts` đã khớp `remi-db/db/migrations/001_init.sql` (schema `remi`, `states`, `reminders(at, sent_at)`, `push_subs`, `ai_usage(day date)`). Hai trường mà schema chưa có: `cond` của lời nhắc ("asleep") và `ua` của thiết bị push. Chúng được kiểm bằng Zod nhưng **chưa được lưu**; cần thì Người 1 thêm cột, rồi bổ sung vào `store-pg.ts`.
2. **Đồng bộ lịch nhắc** (Người 1, 5): lời nhắc đã gửi được giữ nguyên nếu giờ không đổi; đổi giờ thì ghi lại và được gửi lại (cùng quy tắc với `replaceReminders` của Người 1). Cần xác nhận đúng ý.
3. **`remi-next/lib/db.ts`** là bản sao của `remi-db/lib/db.ts` (hai gói tách rời). Nếu nhóm muốn một nguồn duy nhất thì gộp một trong hai.
4. **Trùng với phần của người khác**: Người 2 có thể đã viết `json()`, `fail()`, `readJson(zod)`; Người 3 có thể đã viết schema cho `register`/`login`. Hai file `errors.ts`/`api-kit.ts` và `registerBody`/`loginBody` trong `schemas.ts` là bản của Người 4; nếu trùng thì thống nhất một bản, các handler chỉ cần đổi import.
5. **Cron gửi push** (Người 5) đọc `reminders` và `push_subs`; hợp đồng của phần đó không nằm ở đây.
6. Chưa có `POST /api/push/test` trong bản Next.js (bản cũ có). Thêm sau nếu nhóm cần.

## Đã kiểm chứng và chưa kiểm chứng

Đã chạy: 24 test đơn vị (schema, AI, handler); 6 test `store-pg.ts` trên Postgres 16 thật với đúng migration `001_init.sql` + `002_auth.sql` của Người 1 (khóa lạc quan, hai kết nối ghi cùng lúc, lời nhắc đã gửi, đổi giờ gửi lại, bộ đếm AI song song, thiết bị push, chống chèn SQL).
Trước khi nối schema thật: bộ test hợp đồng (22 đạt, 1 bỏ qua vì chưa có khóa AI) đã chạy với server Node cũ và với bản độc lập trên Postgres thật; đã thử cố tình làm hỏng khoảng 20 chỗ và test đều đỏ.

**Chưa kiểm chứng:** `npm run build` và `npm run dev` của `remi-next` (môi trường của mình không cài được Next.js), bộ test hợp đồng chạy trên `next dev` với Supabase, thư viện `postgres.js` thật với `store-pg.ts` (test dùng bộ chuyển đổi `psql`), Supabase pooler, Vercel preview, và Zod 4 (mình chạy với 3.25).
Khi bạn chạy `npm run dev` rồi `test:contract` lần đầu, nếu có lỗi thì nhiều khả năng ở cách truyền JSON vào câu lệnh trong `store-pg.ts` hoặc ở khác biệt giữa route của Người 3 và hợp đồng `docs/API.md`.
