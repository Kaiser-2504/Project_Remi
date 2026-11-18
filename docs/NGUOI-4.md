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
| `remi-next/lib/wire.ts` | Nối với `lib/db.ts` (Người 1) và `lib/auth.ts` (Người 3): **chỉ file này** có giả định tên import |
| `remi-next/app/api/{state,push/subscribe,push/key,ai/parse}/route.ts` | Route Next.js mỏng, thay cho phần khung 501 của Người 2 |
| `remi-next/standalone/{server.ts,auth-lite.ts,schema.sql}` | **Bản chạy độc lập** (xem bên dưới): server Node mỏng + đăng nhập tối giản + schema, để chạy test hợp đồng trên Postgres thật mà không cần phần của người khác |
| `remi-next/test/*.test.ts` | Test đơn vị, test Postgres thật, và chạy nguyên bộ test hợp đồng với bản độc lập |

## Chạy độc lập (không cần Người 1, 2, 3, 5)

Muốn có "test hợp đồng xanh với DB thật" ngay mà không chờ ai:

```
npm install postgres                                          # một lần, thư viện kết nối Postgres
psql "$DATABASE_URL" -f remi-next/standalone/schema.sql       # tạo bảng (chạy lại được)
DATABASE_URL=postgres://... npm run api:standalone            # server tại http://127.0.0.1:4000
BACKEND_URL=http://127.0.0.1:4000 npm run test:contract       # ở cửa sổ khác
```

`DATABASE_URL` có thể là Postgres cài trong máy, Docker (`docker run -e POSTGRES_PASSWORD=x -p 5432:5432 postgres:16`) hoặc một dự án Supabase **dev**. Đừng trỏ vào cơ sở dữ liệu có dữ liệu thật: test tạo và xoá người dùng thử.
Các biến tuỳ chọn: `PORT`, `HOST`, `ANTHROPIC_API_KEY`, `AI_DAILY_LIMIT`, `VAPID_PUBLIC_KEY`, `ALLOW_REGISTRATION=0`, `COOKIE_SECURE`, `TRUST_PROXY=1`, `REGISTER_LIMIT`.

`standalone/auth-lite.ts` là đăng nhập **tối giản chỉ để chạy độc lập** (scrypt, phiên 30 ngày lưu băm SHA-256, giới hạn đăng ký và đăng nhập trong bộ nhớ), không phải phần của Người 3.
Khi nhóm ghép xong: xoá `remi-next/standalone/`, trỏ `lib/wire.ts` vào `lib/db.ts` và `lib/auth.ts` thật, rồi chạy lại đúng lệnh `test:contract` với `BACKEND_URL` là địa chỉ preview.

## Chạy test

```
npm run test:contract                         # tự bật server Node cũ, không cần cấu hình
BACKEND_URL=https://<preview>.vercel.app npm run test:contract   # với bản đang triển khai và DB thật
npm run test:next                             # test của remi-next (cần có thư viện zod)
PG_TEST_URL="host=localhost port=5432 dbname=remitest" npm run test:next   # thêm test Postgres thật và bản độc lập
```

- `test:next` cần Node ≥ 22.18 (chạy trực tiếp file `.ts`) và gói `zod`: chạy `npm install zod` ở thư mục gốc hoặc trong `remi-next/`.
- `PG_TEST_URL` trỏ tới cơ sở dữ liệu **thử** đã có bảng của `standalone/schema.sql`. Test sẽ **xoá sạch bảng `users` và mọi bảng liên quan** trong cơ sở dữ liệu đó. Không bao giờ trỏ vào dữ liệu thật. Cần có `psql` trong máy (test dùng nó thay cho `postgres.js`).
- Contract test tạo vài người dùng ngẫu nhiên mỗi lần chạy (dưới 10 lần đăng ký) và xoá khi xong. Đăng ký bị giới hạn theo IP, nên chạy liên tiếp quá nhiều lần trong một giờ sẽ gặp `429`; khởi động lại server độc lập để đặt lại bộ đếm.

## Những giả định cần xác nhận với nhóm

1. **Tên bảng và cột** (Người 1): `store-pg.ts` giả định schema chuyển 1-1 từ `server/db.js`:
   `states(user_id, version int, data jsonb, updated_at bigint)`, `reminders(user_id, key, fire_at bigint, title, body, cond, sent int)` khóa chính `(user_id, key)`,
   `push_subs(id, user_id, endpoint UNIQUE, p256dh, auth, ua, created_at)`, `ai_usage(user_id, day, count)` khóa chính `(user_id, day)`.
   Khác thì sửa các câu SQL trong `store-pg.ts`, test Postgres sẽ báo ngay.
2. **Tên import** (Người 1, 3): `wire.ts` import `sql` từ `@/lib/db` (client postgres.js) và `requireUser` từ `@/lib/auth`
   (nhận `Request`, trả `{ id, email, name }` hoặc ném `ApiError` 401/403). Khác tên thì sửa hai dòng đó.
3. **`allowImportingTsExtensions`** (Người 2): các import tương đối dùng đuôi `.ts` để Node chạy test trực tiếp. Cần bật `"allowImportingTsExtensions": true` trong `remi-next/tsconfig.json` (Next.js đã đặt `noEmit`).
4. **Trùng với phần của người khác**: Người 2 có thể đã viết `json()`, `fail()`, `readJson(zod)`; Người 3 có thể đã viết schema cho `register`/`login`. Hai file `errors.ts`/`api-kit.ts` và `registerBody`/`loginBody` trong `schemas.ts` là bản của Người 4; nếu trùng thì thống nhất một bản, các handler chỉ cần đổi import.
5. **Cron gửi push** (Người 5) đọc `reminders` và `push_subs`; hợp đồng của phần đó không nằm ở đây.
6. Chưa có `POST /api/push/test` trong bản Next.js (bản cũ có). Thêm sau nếu nhóm cần.

## Đã kiểm chứng và chưa kiểm chứng

Đã chạy: 24 test đơn vị (schema, AI, handler); 6 test `store-pg.ts` trên Postgres 16 thật có khóa ngoại (kể cả hai kết nối ghi cùng lúc, lời nhắc đã gửi không bị ghi đè, bộ đếm AI không vượt giới hạn khi chạy song song);
nguyên bộ test hợp đồng (22 đạt, 1 bỏ qua vì chưa có khóa AI) với server Node cũ **và** với bản độc lập trên Postgres thật; 1 test cho đăng nhập tối giản (phiên hết hạn, băm mật khẩu và token, giới hạn); `tsc --strict` sạch.
Đã thử cố tình làm hỏng khoảng 20 chỗ (khóa lạc quan, hoàn lượt AI, đồng bộ lịch nhắc, quyền sở hữu thiết bị, hết hạn phiên, chống CSRF, email trùng, xoá tài khoản...): test đều đỏ. Một số chỗ không gây ra được từ ngoài, như lỗi 500 bất ngờ, được kiểm ở test handler.

**Chưa kiểm chứng:** chạy trong Next.js thật (chưa có `remi-next/`), qua thư viện `postgres.js` thật (test dùng bộ chuyển đổi `psql`; đường `postgres.js` của bản độc lập và của `store-pg.ts` chưa chạy lần nào), với Supabase pooler, trên Vercel preview, và bản Zod 4 (đã viết theo phần chung của Zod 3 và 4 nhưng chỉ chạy với 3.25 và 3.23).
Khi bạn chạy `npm run api:standalone` lần đầu với `postgres` thật, đó là lần đầu mã đi qua thư viện đó; nếu có lỗi thì nhiều khả năng ở cách truyền mảng và JSON vào câu lệnh trong `store-pg.ts`.
