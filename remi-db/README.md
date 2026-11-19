# Remi DB — Vai trò Người 1 (lớp dữ liệu Supabase)

Gói này là phần việc của **Người 1 / D1**: schema, lớp truy cập dữ liệu, kiểm tra RLS và kiểm thử, cho Remi chạy trên Supabase Postgres và deploy lên Vercel.

Mọi câu SQL và logic trong gói đã được **chạy thật trên Postgres 16** và đạt (xem phần "Đã kiểm chứng" ở cuối).

## Trong gói có gì

```
remi-db/
├── db/
│   ├── migrations/001_init.sql   7 bảng trong schema remi, chỉ mục, bật RLS
│   ├── migrate.mjs               bộ chạy migration (dùng driver postgres)
│   ├── verify-rls.sql            báo lỗi nếu có bảng chưa bật RLS
│   └── smoke.sql                 kiểm thử nhanh bằng SQL thuần (dùng trong CI)
├── lib/
│   ├── db.ts                     kết nối postgres.js (pooler 6543, prepare:false)
│   └── repo.ts                   các hàm dữ liệu (tham số hoá, chống SQL injection)
├── test/repo.test.ts            kiểm thử tích hợp lớp TypeScript (cần DB thật)
├── .github/workflows/db-ci.yml  CI: dựng Postgres, migration + verify-rls + smoke
├── .env.example                 mẫu hai chuỗi kết nối
└── package.json
```

## Các hàm trong `lib/repo.ts` (giao diện chung cho cả nhóm)

| Hàm | Ai dùng |
|---|---|
| `createUser`, `getUserByEmail` | Người 3 (đăng ký, đăng nhập) |
| `createSession`, `getSession`, `deleteSession` | Người 3 (phiên) |
| `getState`, `putState` (khoá lạc quan, trả null khi 409) | Người 4 (đồng bộ) |
| `upsertPushSub`, `deletePushSub`, `listSubsForUsers` | Người 4, Người 5 |
| `replaceReminders`, `claimDueReminders`, `countStuckReminders` | Người 4, Người 5 (D4) |
| `bumpAiUsage` | Người 4 (giới hạn lượt AI) |
| `hitRateLimit` | Người 3 (giới hạn đăng nhập/đăng ký) |

Chữ ký cụ thể nằm trong `lib/repo.ts`. **Chốt lại các chữ ký này với nhóm trong buổi họp đầu** rồi mới để người khác gọi.

---

## PHẦN A — Việc bạn tự bấm trên Supabase

### A1. Tạo hai dự án
Tạo **hai** dự án Supabase: một tên `remi-dev` (để thử), một tên `remi-prod` (thật). Bản preview dùng `remi-dev` để không đụng dữ liệu thật. Đặt **vùng (region) là Singapore** để gần người dùng Việt Nam và gần vùng hàm của Vercel.

> Lưu ý: gói miễn phí giới hạn số dự án. Nếu không đủ cho hai dự án, tạm dùng một dự án và dùng hai schema, nhưng hai dự án tách biệt là sạch hơn.

### A2. Lấy hai chuỗi kết nối (cho mỗi dự án)
Trong dự án, bấm **Connect** ở thanh trên:
- **Direct connection** (cổng 5432): dùng cho **migration**. Chép vào `DATABASE_URL_DIRECT`.
- **Transaction pooler** (cổng 6543): dùng cho **ứng dụng**. Chép vào `DATABASE_URL`, thêm `?workaround=supabase-pooler.vercel` ở cuối.

Thay `<mật-khẩu>` bằng mật khẩu database của dự án (đặt lúc tạo; quên thì đặt lại trong Settings -> Database).

### A3. Không cần làm gì thêm với extension ở bước này
Migration của D1 chỉ cần `pgcrypto` (có sẵn). Hai extension `pg_cron`, `pg_net` là việc của Người 5 (D4), không thuộc D1.

---

## PHẦN B — Việc chạy bằng lệnh (bạn làm trên máy)

Cần cài **psql** (PostgreSQL client) và **Node 20+**.

### B1. Chuẩn bị
```
cp .env.example .env
```
Mở `.env`, điền `DATABASE_URL_DIRECT` và `DATABASE_URL` của dự án **remi-dev** trước.

### B2. Chạy migration (tạo bảng)
Cách 1 — bằng psql (không cần cài gì):
```
psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -f db/migrations/001_init.sql
```
Cách 2 — bằng Node (cần `npm i`):
```
npm install
export $(grep -v '^#' .env | xargs)   # nạp .env vào môi trường
npm run migrate
```
Migration an toàn khi chạy lại nhiều lần.

> Trên Supabase thật đã có sẵn vai trò `anon` và `authenticated`, nên câu `revoke ... from anon, authenticated` ở cuối migration chạy được. (Chỉ Postgres cục bộ mới phải tạo giả hai vai trò này — CI đã lo.)

### B3. Kiểm tra RLS đã bật
```
npm run verify:rls
```
Phải in `OK: mọi bảng trong schema remi đã bật RLS` và thoát 0. Nếu có bảng thiếu, nó báo tên bảng và thoát lỗi.

### B4. Chạy smoke test
```
npm run smoke
```
Phải in `SMOKE OK`. Bài này chạy trong một giao dịch rồi `rollback`, **không để lại dữ liệu**.

### B5. (Quan trọng) Kiểm tra anon KHÔNG đọc được dữ liệu
Đây là bằng chứng RLS có tác dụng với API công khai của Supabase. Chạy bằng **khóa anon** (Settings -> API -> `anon public`):
```
curl "https://<project-ref>.supabase.co/rest/v1/reminders" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```
Kết quả đúng là **lỗi hoặc rỗng** (schema `remi` không được PostgREST phơi ra, và RLS chặn). Nếu trả về dữ liệu, dừng lại và báo nhóm — có gì đó sai.

### B6. Lặp lại cho remi-prod
Đổi `.env` sang chuỗi kết nối của **remi-prod**, chạy lại B2 đến B5.

### B7. Chạy test lớp TypeScript (khi dự án Next.js đã có)
Trỏ vào một DB THỬ (remi-dev), không phải prod:
```
DATABASE_URL="$DATABASE_URL_DIRECT" npm run test:repo
```

---

## PHẦN C — Đưa vào dự án và Vercel

- Chép `lib/db.ts`, `lib/repo.ts` vào dự án Next.js (thư mục `lib/`). Chép `db/` vào gốc dự án. Gộp `.github/workflows/db-ci.yml` vào repo.
- Trên **Vercel -> Settings -> Environment Variables**, thêm `DATABASE_URL`:
  - Production = chuỗi pooler 6543 của **remi-prod**.
  - Preview = chuỗi pooler 6543 của **remi-dev**.
- **Không** đặt `DATABASE_URL_DIRECT` trên Vercel (migration không chạy từ hàm).
- Đưa gói lên bằng một nhánh và Pull Request, không đẩy thẳng vào `main`.

---

## Đã kiểm chứng (trên Postgres 16)

Mọi thứ dưới đây đã chạy thật và đạt:
- Migration chạy sạch và **idempotent** (chạy lại không lỗi).
- RLS bật trên cả 7 bảng; vai trò `anon` bị chặn khỏi schema `remi`.
- Email trùng khác hoa thường bị chặn.
- Khoá lạc quan: ghi đúng phiên bản thì lên version, ghi phiên bản cũ thì 0 dòng (409).
- Upsert lời nhắc: đổi giờ reset `sent_at`, giữ giờ thì giữ.
- Câu nhận lời nhắc chỉ lấy dòng đến hạn trong cửa sổ 30 phút.
- **4 tiến trình nhận lời nhắc song song: mỗi cái 50, tổng 200 khác nhau, 0 trùng, 0 sót** (bằng chứng "không gửi trùng").
- Bộ đếm AI chặn đúng khi đạt giới hạn; giới hạn tần suất reset khi hết cửa sổ.
- `verify-rls.sql` và `smoke.sql` đều **thoát lỗi khi cố tình phá**, nên là cổng gác thật.

## Chưa kiểm chứng
- Chưa chạy trên Supabase thật (mình không có tài khoản của bạn) — bạn làm Phần A, B.
- Hành vi bỏ qua RLS của vai trò `postgres` trên Supabase: đúng theo cách Postgres hoạt động (chủ bảng bỏ qua RLS khi không bật FORCE), nhưng hãy xác nhận bằng B5.
- Lược đồ bảng suy từ chức năng hiện có; đối chiếu tên cột với `server/db.js` của nhóm trước khi để Người 3, 4 gọi.
