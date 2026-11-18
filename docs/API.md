# Hợp đồng API của Remi

Tài liệu này là **hợp đồng chung**: bản Node cũ (`server/`) và bản Next.js (`remi-next/`) đều phải làm đúng như dưới đây.
Bộ test `contract/api.contract.test.js` kiểm tra từng dòng. Sửa hợp đồng thì sửa tài liệu này **và** test trong cùng một pull request.

Phần dữ liệu, thông báo đẩy và AI (D5) do Người 4 phụ trách. Phần tài khoản (Người 3) chỉ tóm tắt ở đây để test dùng được.

## Quy ước chung

- Mọi thân yêu cầu và phản hồi là JSON UTF-8. Thân yêu cầu tối đa 2 MB (quá thì `413 too_large`).
- Các endpoint cần đăng nhập nhận phiên qua cookie `HttpOnly`. Không có phiên: `401 unauthorized`.
- Yêu cầu **ghi** (POST, PUT, DELETE) phải có header `X-Remi: 1`, thiếu thì `403 csrf` (chống CSRF).
- Phản hồi thành công không có dạng chung. Phản hồi **lỗi** luôn có dạng:

```json
{ "error": "ma_loi", "message": "Câu thân thiện, hiển thị được cho người dùng." }
```

  Một số lỗi có thêm trường (ví dụ `409` kèm `version` và `state`, `500` kèm `requestId`).
- Lỗi **dự đoán được** (người dùng gửi sai, hết lượt, chưa đăng nhập) trả đúng mã 4xx hoặc 503 ghi bên dưới.
  Lỗi **bất ngờ** (DB sập, bug) luôn là `500 server_error` với thông báo chung và `requestId`; chi tiết chỉ ghi ở log máy chủ.
  Không bao giờ lộ stack, câu SQL, đường dẫn hay khóa API trong phản hồi.

### Bảng mã lỗi

| HTTP | `error` | Khi nào |
|---|---|---|
| 400 | `bad_json` | Thân yêu cầu không phải JSON |
| 400 | `bad_version` | `baseVersion` thiếu, không phải số nguyên hoặc âm |
| 400 | `bad_state` | `state` thiếu hoặc không phải object (mảng, chuỗi, null) |
| 400 | `bad_schedule` | `schedule` sai (quá 500 mục, key/title rỗng hoặc quá dài, `at` không phải số dương, `cond` lạ) |
| 400 | `bad_subscription` | Thông tin thiết bị push sai (endpoint không phải https, khóa thiếu hoặc quá dài) |
| 400 | `bad_endpoint` | Huỷ đăng ký thiếu `endpoint` (chỉ bản Next.js; bản cũ trả 200) |
| 400 | `bad_text`, `bad_now`, `bad_weekday` | Đầu vào của AI sai |
| 401 | `unauthorized` | Chưa đăng nhập hoặc phiên hết hạn |
| 403 | `csrf` | Yêu cầu ghi thiếu header `X-Remi: 1` |
| 404 | `not_found` | Không có endpoint này |
| 409 | `conflict` | Phiên bản dữ liệu cũ hơn máy chủ (xem `PUT /api/state`) |
| 413 | `too_large` | Dữ liệu quá lớn |
| 429 | `ai_limit` | **Người dùng** hết lượt AI trong ngày |
| 500 | `server_error` | Lỗi bất ngờ, có `requestId` để tra log |
| 502 | `ai_bad_output` | AI trả về dữ liệu không đọc được hoặc sai cấu trúc |
| 502 | `ai_upstream` | AI từ chối (4xx, ví dụ khóa cấu hình sai); chi tiết không gửi ra ngoài |
| 503 | `ai_disabled` | Máy chủ chưa cấu hình khóa AI |
| 503 | `ai_timeout` | AI trả lời quá thời gian chờ (mặc định 20 giây) |
| 503 | `ai_unavailable` | Không kết nối được AI hoặc AI lỗi 5xx |
| 503 | `ai_busy` | AI báo quá tải (429 phía AI). Có `Retry-After` |

Mỗi trường sai trả mã riêng (như bảng) để app hiển thị đúng chỗ. Ở bản Next.js, lỗi 400 còn có trường `field` cho biết trường đầu tiên sai.

## Sức khoẻ

`GET /api/health` (không cần đăng nhập) → `200 { "ok": true }`. Bản Next.js còn kiểm tra `SELECT 1` tới Supabase (Người 2).

## Tài khoản (Người 3)

| Endpoint | Thành công | Lỗi chính |
|---|---|---|
| `POST /api/auth/register` `{ email, name (1-20), password (8-200) }` | `201 { user }` + cookie phiên | `400 bad_email/bad_name/bad_password`, `409 email_taken`, `403 registration_closed`, `429 rate_limited` |
| `POST /api/auth/login` `{ email, password }` | `200 { user }` + cookie | `401 bad_credentials`, `429 rate_limited` |
| `POST /api/auth/logout` | `200 { ok }`, xoá cookie | |
| `GET /api/me` | `200 { user }` | `401` |
| `DELETE /api/me` `{ password }` | `200 { ok }`, xoá luôn dữ liệu, phiên, thiết bị | `401 bad_credentials` |

`user` = `{ id, email, name }`. Đăng ký bị giới hạn theo IP (mặc định 10 lần mỗi giờ), nên bộ contract test chỉ tạo 3 người dùng mỗi lần chạy.

## Dữ liệu: `/api/state`

Toàn bộ dữ liệu của một người dùng (việc, thói quen, ghi chú…) là **một tài liệu JSON có phiên bản**.

### `GET /api/state`

- Người mới: `200 { "version": 0, "state": null }`
- Đã có dữ liệu: `200 { "version": 3, "state": { ... }, "updatedAt": 1700000000000 }`

### `PUT /api/state`

```json
{
  "baseVersion": 3,
  "state": { "tasks": [], "habits": [] },
  "schedule": [{ "key": "task-1", "at": 1700000000000, "title": "Uống nước", "body": "", "cond": "" }]
}
```

- `baseVersion`: số nguyên ≥ 0, là phiên bản máy khách đã đọc lần cuối (người mới dùng `0`).
- `state`: object thuần (không nhận mảng, chuỗi, null). Tối đa 1.000.000 ký tự JSON, quá thì `413 too_large`.
- `schedule` (tuỳ chọn): danh sách lời nhắc app đã tính sẵn, tối đa 500 mục.
  - `key` 1-160 ký tự (duy nhất trong danh sách), `title` 1-160, `body` ≤ 240 (mặc định rỗng),
    `at` số dương (mili giây Unix, làm tròn), `cond` rỗng hoặc `"asleep"` (chỉ nhắc khi đang ngủ).
  - **Có `schedule`**: thay toàn bộ lời nhắc **chưa gửi** của người dùng bằng danh sách này (mục không còn trong danh sách thì bị xoá, mục có sẵn thì cập nhật). Lời nhắc **đã gửi** không bị sửa hay xoá.
  - **Không có `schedule`**: không đụng tới lời nhắc.
  - `schedule: []` xoá hết lời nhắc chưa gửi.
- Thành công: `200 { "version": 4 }` (luôn tăng đúng 1).

**Khóa lạc quan.** Nếu `baseVersion` khác phiên bản hiện tại trên máy chủ:
`409 { "error": "conflict", "message": "...", "version": 5, "state": { ... } }`. Không có gì được ghi (cả `state` lẫn `schedule`).
Máy khách dùng `version` và `state` trong lỗi để gộp rồi gửi lại với `baseVersion` mới.
Hai yêu cầu cùng `baseVersion` gửi đồng thời thì **đúng một** yêu cầu thắng. Ghi `state` và đồng bộ `schedule` nằm trong **cùng một giao dịch**: hoặc cả hai, hoặc không gì cả.

Dữ liệu mỗi người dùng tách biệt hoàn toàn.

## Thông báo đẩy: `/api/push`

| Endpoint | Thành công | Lỗi |
|---|---|---|
| `GET /api/push/key` | `200 { "enabled": true, "publicKey": "..." }` (`enabled: false` khi chưa cấu hình khóa VAPID) | `401` |
| `POST /api/push/subscribe` | `201 { "ok": true }` | `400 bad_subscription`, `401`, `403` |
| `DELETE /api/push/subscribe` `{ "endpoint": "..." }` | `200 { "ok": true }` (huỷ lại, hoặc huỷ thiết bị của người khác: vẫn `200`, không có tác dụng) | `400 bad_endpoint`, `401`, `403` |

`POST /api/push/subscribe` nhận `{ "subscription": { "endpoint": "https://...", "keys": { "p256dh": "...", "auth": "..." } } }`.
`endpoint` bắt buộc `https://`, tối đa 1000 ký tự; mỗi khóa tối đa 200 ký tự. Đăng ký lại cùng `endpoint` thì **cập nhật**, không tạo thêm bản ghi
(thiết bị chuyển sang người dùng đăng ký sau cùng). Việc gửi thông báo đúng giờ do cron (Người 5) đảm nhiệm, không nằm trong hợp đồng này.

## AI: `POST /api/ai/parse`

Đầu vào:

```json
{ "text": "vợ nhờ tôi đi chợ nấu cà ri lúc 7h", "now": "2026-11-04T10:00", "weekday": "Thứ tư" }
```

- `text`: 1-300 ký tự sau khi cắt khoảng trắng đầu cuối.
- `now`: `YYYY-MM-DDTHH:mm` (giờ địa phương của người dùng).
- `weekday`: một trong `Chủ nhật`, `Thứ hai`, `Thứ ba`, `Thứ tư`, `Thứ năm`, `Thứ sáu`, `Thứ bảy`.

Thứ tự kiểm tra: đăng nhập (401) → đầu vào (400, **không tốn lượt**) → khóa AI (503 `ai_disabled`) → lượt trong ngày (429 `ai_limit`) → gọi AI.

Thành công: `200 { "data": { ... } }`. `data` đã được máy chủ kiểm tra bằng Zod, luôn có dạng:

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `intent` | `"task"` hoặc `"habit"` | giá trị lạ thành `"task"` |
| `title` | chuỗi 1-120 | **bắt buộc**, thiếu thì `502 ai_bad_output` |
| `emoji` | chuỗi ≤ 16 | |
| `when` | `YYYY-MM-DDTHH:mm` hoặc `null` | |
| `repeat` | `none`, `daily`, `weekly` | mặc định `none` |
| `leadMinutes` | số nguyên 0-1440 | mặc định 0 |
| `shopping` | boolean | |
| `servings` | số nguyên 1-50 | mặc định 4 |
| `assumption`, `summary` | chuỗi | |
| `checklist` | mảng ≤ 20 `{ item, qty }` | |
| `tips` | mảng ≤ 4 chuỗi | |
| `habit` | `null` hoặc `{ recurring, times[], days[], spread, ml }` | |

**Lượt AI.** Mỗi người dùng có `AI_DAILY_LIMIT` lượt mỗi ngày (mặc định 60, tính theo ngày UTC). Hết lượt: `429 ai_limit`.
Lượt chỉ bị trừ khi gọi AI thật; nếu AI lỗi (502 hoặc 503) thì **lượt được hoàn lại**.
`429` chỉ dành cho việc người dùng hết lượt. AI quá tải (429 phía AI) hiện ra cho người dùng là `503 ai_busy` kèm `Retry-After`, để app không nhầm với hết lượt.

**Thời gian chờ.** Gọi AI tối đa `AI_TIMEOUT_MS` (mặc định 20.000 ms); quá thì `503 ai_timeout`.
Khóa AI chỉ nằm ở máy chủ, không bao giờ xuất hiện trong phản hồi.

## Biến môi trường liên quan

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `ANTHROPIC_API_KEY` | Khóa AI. Thiếu thì `/api/ai/parse` trả `503 ai_disabled` | trống |
| `ANTHROPIC_BASE_URL` | Địa chỉ API AI | `https://api.anthropic.com` |
| `AI_MODEL` | Model | `claude-haiku-5-5` |
| `AI_DAILY_LIMIT` | Lượt AI mỗi người mỗi ngày | 60 |
| `AI_TIMEOUT_MS` | Thời gian chờ AI | 20000 |
| `VAPID_PUBLIC_KEY` | Khóa công khai Web Push, trả qua `GET /api/push/key` | trống (`enabled: false`) |

Không biến nào ở trên được mang tiền tố `NEXT_PUBLIC_` (sẽ lộ ra trình duyệt).

## Khác biệt giữa bản Node cũ và bản Next.js

Contract test chỉ đòi những điều **cả hai bản cùng đúng**. Các khác biệt đã biết, bản cũ sẽ bị bỏ khi chuyển hẳn sang Next.js:

- Lỗi phía AI: bản cũ trả `502` cho mọi lỗi AI (`ai_unavailable`, `ai_upstream`, `ai_bad_output`); bản mới phân loại thành `503 ai_timeout/ai_unavailable/ai_busy` và `502 ai_upstream/ai_bad_output`. Test chấp nhận `502` hoặc `503` với mã bắt đầu bằng `ai_`.
- Bản cũ kiểm tra khóa AI (`503 ai_disabled`) **trước** đầu vào; bản mới kiểm tra đầu vào trước. Test bỏ qua phần kiểm đầu vào AI khi máy chủ chưa có khóa.
- Bản cũ không hoàn lượt AI khi AI lỗi, không có `field` trong lỗi 400, và `DELETE /api/push/subscribe` thiếu `endpoint` vẫn trả 200.
