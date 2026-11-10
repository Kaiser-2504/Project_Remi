# Chức năng "Nhập nhanh thông minh" của Remi: gói mã để đọc và làm tiếp

Người dùng **gõ hoặc nói một câu** vào ô nhập ("vợ nhờ đi chợ nấu cà ri lúc 7h", "uống 2 lít nước mỗi ngày"), Remi hiểu câu đó, cho xem lại, rồi tạo việc hoặc thói quen. Gói này gom đúng những phần mã lo việc đó, kèm một công cụ chạy thử trên terminal.

Số dòng trong tài liệu này là của bản trong gói (ngày 09/11/2026). Mã trong app.js sẽ dịch chuyển khi mọi người sửa, nên coi số dòng là gợi ý, tìm theo tên hàm.

## 1. Chạy thử ngay (không cần cài gì ngoài Node.js)

Cần Node.js (kiểm tra bằng `node -v`). Công cụ được thử với Node 22; các bản từ 18 trở lên được kỳ vọng chạy được nhưng chưa thử. Trong thư mục này:

```
node try-nhap-nhanh.js
```

Rồi gõ câu. Hoặc xử lý một câu rồi thoát:

```
node try-nhap-nhanh.js --text "nhắc tôi uống 2 ly nước mỗi ngày"
```

Công cụ chạy **hai bộ hiểu câu trên máy** của Remi và so sánh. Kết quả thật (cố định giờ bằng `--now 2026-11-04T10:00`):

```
  Câu: "nhắc tôi uống 2 ly nước mỗi ngày"   (bây giờ: 2026-11-04 10:00)
  [1] Bộ luật  web/js/local-parse.js hiểu là:
    Loại:        VIỆC (một thời điểm)
    Tên:         📌 Uống 2 ly nước
    Khi nào:     Thứ năm, 05/11 lúc 09:00
    Nhắc trước:  0 phút   Lặp lại: daily
  [2] Mô hình học máy  web/js/intent-model.js đoán: nuoc (thói quen uống nước), tin cậy 99.2%
      nuoc 99%   habit_khac 1%   viec 0%   di_cho 0%
  [3] Hai bên KHÁC NHAU: bộ luật ra "việc có giờ", mô hình ra "thói quen uống nước". Đây là chỗ cần xem lại.
```

```
  Câu: "lên lịch hẹn uống 1 lít nước chia làm 4 lần từ 1h-5h"   (bây giờ: 2026-11-04 10:00)
  [1] Bộ luật  web/js/local-parse.js hiểu là:
    Loại:        THÓI QUEN (lặp lại)
    Tên:         💧 Uống nước 1 lít
    Lặp lại:     chỉ hôm nay
    Chia đều:    4 lần, từ 13:00 đến 17:00
    Lượng nước:  1000 ml
  [2] Mô hình học máy  web/js/intent-model.js đoán: nuoc (thói quen uống nước), tin cậy 96.3%
      nuoc 96%   viec 3%   di_cho 1%   habit_khac 0%
  [3] Hai bên ĐỒNG Ý: thói quen uống nước.
```

Câu đầu cho thấy một điểm yếu thật của bộ luật: nó hiểu thành **việc** lặp hằng ngày lúc 9h, trong khi mô hình học máy đoán đúng là **thói quen uống nước**.

**Lưu ý quan trọng:** bản Remi đang chạy hiểu câu bằng **AI của Claude qua máy chủ** (mục 3), không phải hai bộ trên. Công cụ này không gọi AI đó nên không cần khóa, nhưng kết quả của nó **không phải đúng thứ app đang dùng**.

## 2. Hiện trạng so với 5 hạng mục của chức năng

| Hạng mục | Hiện trạng | Nên sửa ở đâu để làm tiếp |
|---|---|---|
| Một câu thành một việc hoặc thói quen | **Đã có**, qua AI (Claude) | `server/ai.js`, `normalize` và `submit` trong app.js |
| Nói bằng giọng | **Đã có một phần**: nói **một câu**, tự gửi khi nói xong | khối voice trong app.js (dòng 1211 đến 1227) |
| Nhiều việc trong một câu | **Chưa có.** AI và bộ luật chỉ trả về **một** kết quả | prompt và schema trong `server/ai.js`; `normalize`, `submit`, `openSheet` hiện chỉ giữ một bản nháp; `web/js/local-parse.js` |
| Chụp ảnh thành danh sách | **Chưa có** | cần thêm đường dẫn mới ở `server/routes.js`, gọi AI có ảnh ở `server/ai.js`, nút mới ở ô nhập trong `web/index.html` |
| Việc hay dùng một chạm | **Chưa có.** Gợi ý hiện là nút cố định trong HTML, không học theo người dùng | dữ liệu người dùng (`state`) trong app.js, ô gợi ý trong `web/index.html` |
| Hoàn tác | **Chưa có** | thông báo trong app (`alertUser`, dòng 242 đến 258) và thao tác lưu trong app.js; cẩn thận với cơ chế đồng bộ xoá |

Phần "Chưa có" là việc cần làm, không phải lỗi.

## 3. Luồng hoạt động hiện tại

```
Gõ câu (#ta) hoặc nói (#mic)  hoặc bấm nút gợi ý (data-ex)
        |
        v
submit()  app.js          gửi POST /api/ai/parse  { text, now, weekday }
        |
        v
server/routes.js          kiểm tra đăng nhập, giới hạn lượt AI mỗi ngày (mặc định 60), rồi gọi:
server/ai.js              buildPrompt -> gọi Claude -> extractJson -> trả { data }
        |
        v
normalize()  app.js       làm sạch kết quả AI thành "bản nháp" (việc hoặc thói quen)
        |
        v
openSheet(bản nháp,'ai')  khung xem lại: sửa tên, ngày giờ, nhắc trước, danh sách đi chợ, chia nước...
        |
        v
confirmDraft()            bấm Thêm: lưu vào dữ liệu người dùng, lập lịch nhắc
```

Khi AI lỗi: app báo "Remi chưa hiểu được lúc này", **giữ nguyên câu đã gõ**, và các ô tạo nhanh (`data-new`, qua `openManual`) vẫn dùng được để tạo tay.

## 4. Ba bộ "hiểu câu" và cái nào đang chạy trong app

| Bộ | Tệp | Đang nối vào app? |
|---|---|---|
| **AI (Claude) qua máy chủ** | `server/ai.js`, đường dẫn `/api/ai/parse` | **Có**: đây là thứ app dùng |
| Bộ luật trên máy | `web/js/local-parse.js` | **Không.** Chỉ dùng cho đo chất lượng (`ml/`) và bản HTML đơn |
| Mô hình học máy phân loại ý định | `web/js/intent-model.js` + `web/data/intent-model.json`, huấn luyện ở `remi-ai/` | **Không.** Chưa nối vào giao diện |

## 5. Bản đồ mã

**Trong `code/` (đúng đường dẫn như trong repo, chép đè lại được):**

| Tệp | Vai trò |
|---|---|
| `server/ai.js` | Xây prompt, kiểm tra đầu vào, gọi Claude, tách JSON từ câu trả lời |
| `web/js/app.js` | Toàn bộ logic giao diện, trong đó có phần nhập nhanh (xem bảng dưới) |
| `web/index.html`, `web/css/app.css` | Ô nhập, nút gợi ý, ba ô tạo nhanh và kiểu dáng của chúng |
| `web/js/api.js` | Gọi API cùng nguồn, kèm header chống CSRF |
| `web/js/local-parse.js` | Bộ luật hiểu câu tiếng Việt trên máy (giờ giấc, lặp lại, nước uống, đi chợ) |
| `web/js/intent-model.js` | Chạy mô hình phân loại ý định trong trình duyệt |
| `web/js/qty.js` | Đọc và co giãn định lượng ("600 g", "3 củ") cho danh sách đi chợ |
| `web/data/dishes.json` | Kho món ăn và nguyên liệu cho bộ luật |
| `web/data/intent-model.json` | Mô hình đã huấn luyện |
| `ml/` | Lược đồ kết quả (`schema.js`), bộ đo chất lượng (`eval/run.js`), sinh dữ liệu (`gen/`), các câu mẫu viết tay (`data/gold.jsonl`, `holdout.jsonl`) |
| `remi-ai/` | Mã huấn luyện mô hình phân loại ý định (có demo riêng, xem `remi-ai/README.md`) |
| `server/test/` | `ai.test.js`, `ml.test.js`, `intent.test.js` (cần cả repo để chạy) |

**Trong `code/web/js/app.js` (tệp lớn, không tách riêng được; bản trích để đọc ở `excerpts/app.nhap-nhanh.txt`):**

| Việc | Hàm | Dòng |
|---|---|---|
| Gọi AI, chuẩn hoá, báo lỗi | `defaultWhen`, `normalize`, `submit`, `aiHelp` | 340 đến 406 |
| Khung xem lại câu đã hiểu | `openSheet` | 572 đến 627 |
| Bấm Thêm: lưu | `confirmDraft` | 767 đến 791 |
| Tạo tay bằng ô tạo nhanh | `openManual` | 1134 đến 1140 |
| Nút gợi ý, ô tạo nhanh | khối sự kiện | 1142 đến 1148 |
| Nút Thêm, phím Enter | | 1180 đến 1181 |
| Nói bằng giọng | khối voice | 1211 đến 1227 |
| Các phần con của khung xem lại | chọn ngày giờ / chia nước / danh sách đi chợ / form thói quen | 410 đến 498 / 500 đến 569 / 628 đến 713 / 714 đến 760 |

Giao diện: `excerpts/index.composer.html.txt` (ô nhập, gợi ý, ô tạo nhanh) và `excerpts/app.composer.css.txt`.

## 6. Hợp đồng `/api/ai/parse`

Gửi: `{ "text": "câu của người dùng", "now": "2026-11-04T10:00", "weekday": "Thứ tư" }`. Nhận: `{ "data": { "intent": "task" hoặc "habit", "title", "emoji", "when", "repeat", "leadMinutes", "shopping", "servings", "checklist": [{ "item", "qty" }], "tips", "habit": { "recurring", "times", "days", "spread", "ml" } } }`. Lỗi: `503 ai_disabled` (máy chủ chưa có khóa AI), `429 ai_limit` (hết lượt trong ngày), `400` (câu sai), `401` (chưa đăng nhập). Lược đồ đầy đủ ở `ml/schema.js`.

## 7. Chạy trong cả app Remi

Gói này **không chạy app được một mình** (cần máy chủ, đăng nhập, cơ sở dữ liệu). Để chạy app thật, dùng repo `Project_Remi`:

```
npm install
```

```
npm start
```

rồi mở http://localhost:3000. Muốn AI hiểu câu nói, điền `ANTHROPIC_API_KEY` vào `.env` (chưa có thì ô nhập báo máy chủ chưa bật AI, các ô tạo nhanh vẫn dùng được). Test liên quan: `npm test` (có `ai.test.js` kiểm tra gọi AI bằng máy chủ giả, `ml.test.js`, `intent.test.js`).

## 8. Lưu ý khi làm tiếp

- `web/js/app.js` là **một tệp hơn 1.500 dòng**: năm người cùng sửa sẽ hay xung đột khi gộp. Gộp nhỏ, gộp thường xuyên, và nói với nhóm trước khi sửa các hàm dùng chung (`openSheet`, `normalize`).
- Khi thêm hạng mục mới, thêm test và nhớ rằng giao diện chỉ được gọi API cùng nguồn (theo `docs/API.md` của repo).
- Chụp ảnh gửi AI nghĩa là **ảnh rời khỏi máy người dùng**: cần ghi rõ cho người dùng và cân nhắc quyền riêng tư.
- **Gói này là bản chụp để đọc và thử, không phải nơi sửa.** Đừng chép đè `code/` vào repo đang làm việc: nếu đồng đội đã sửa `app.js` hay các tệp khác từ lúc chụp thì bạn sẽ ghi đè mất thay đổi của họ. Hãy sửa trực tiếp trong repo bằng git (`git pull` trước khi sửa), dùng gói này để đọc và tìm đúng chỗ.
- Mã trong gói giống hệt repo `Project_Remi` ở thời điểm đóng gói. Nếu repo đã đổi, số dòng trong tài liệu này sẽ lệch.
