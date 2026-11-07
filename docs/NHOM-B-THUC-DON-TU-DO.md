# Nhóm B: Thực đơn tuần và tủ đồ nhà

Tab **Bếp** trong app, gồm ba phần: Thực đơn tuần, Tủ đồ và Món của tôi, cùng thẻ "Hôm nay nấu gì?".

## Chức năng

| Yêu cầu | Đã làm | Ở đâu |
|---|---|---|
| Lưới 7 ngày x 3 bữa | Tuần từ thứ hai tới chủ nhật, mỗi ngày Sáng, Trưa, Tối; mỗi bữa tối đa 6 món, mỗi món có số người ăn. Chuyển tuần trước, tuần sau, về tuần này. Chép tuần trước (chỉ điền bữa còn trống), xoá tuần (có hoàn tác). | `kitchen.js`: `weekStart`, `addMeal`, `removeMeal`, `copyWeek`, `clearWeek` |
| Gộp nguyên liệu cả tuần thành một danh sách đi chợ | Cộng dồn cùng nguyên liệu ở nhiều món (không phân biệt hoa thường và dấu), quy đổi g với kg, ml với lít, co giãn theo số người, làm tròn **lên** để mua đủ. Trừ đi đồ đang có trong tủ (không tính đồ hết hạn). Chọn hoặc bỏ từng món, chọn giờ đi chợ, tạo thành việc đi chợ có nhắc trước. Gộp lại lần nữa thì cập nhật việc cũ, không tạo việc trùng. | `aggregate`, `subtractStock` |
| Quản lý đồ có sẵn và hạn dùng | Thêm đồ với lượng và hạn (không ghi, 3 ngày, 1 tuần, 2 tuần, 1 tháng hoặc chọn ngày). Cùng tên cùng hạn thì cộng dồn. Đồ hết hạn lên đầu, rồi đồ sắp hết hạn (còn 0 đến 3 ngày). Nút + và − chỉnh lượng, bỏ đồ có hoàn tác, bỏ toàn bộ đồ hết hạn một chạm. Tab Hôm nay hiện băng nhắc khi có đồ cần dùng sớm. Máy chủ gửi thông báo đẩy lúc 18:00 hôm trước ngày hết hạn. Đi chợ về: trong việc đi chợ bấm "Cất đồ đã mua vào tủ". | `expiryStatus`, `sortStock`, `addStock`, `expiryReminders` |
| Gợi ý "hôm nay nấu gì" | Xếp hạng món theo tỉ lệ nguyên liệu chính đang có trong tủ (gia vị cơ bản như nước mắm, đường không tính), cộng điểm khi dùng được đồ sắp hết hạn, trừ điểm món đã ăn trong 3 ngày qua, bỏ món đã có trong thực đơn hôm nay. Chỉ gợi ý khi có ít nhất 30% nguyên liệu chính, trừ khi giúp dùng đồ sắp hỏng. Một chạm để thêm vào bữa đang tới. Gõ "Hôm nay nấu gì?" ở ô nhập cũng mở thẳng phần này (không tốn lượt AI). Nấu xong thì trừ nguyên liệu khỏi tủ, dùng đồ gần hết hạn trước. | `suggest`, `consume` |
| Món của riêng mình | Tạo, sửa, xoá món: tên, số người, danh sách nguyên liệu và lượng, cách nấu. Chép một món có sẵn để sửa theo khẩu vị nhà mình. Tạo món mới ngay từ ô tìm khi thêm vào bữa. Món của tôi đứng trước món có sẵn khi tìm và được ưu tiên nhẹ khi gợi ý. | `validateRecipe`, `allDishes`, `searchDishes` |

## Cấu trúc mã

```
web/js/kitchen.js       logic thuần (không DOM, không tự đọc đồng hồ): chạy được trong trình duyệt và Node
web/js/kitchen-ui.js    giao diện tab Bếp, nhận "ngữ cảnh" từ app.js nên không đụng vào biến nội bộ của app
web/data/dishes.json    15 món có sẵn (dùng chung với bộ hiểu câu ở ml/)
web/css/app.css         phần cuối file: giao diện tab Bếp, 3 mốc màn hình
server/test/kitchen.test.js   49 bài test đơn vị, tính chất ngẫu nhiên và tích hợp với máy chủ
e2e/kitchen.js          bài test trình duyệt đi hết luồng, cả đồng bộ hai máy
scripts/mutation-test.js      kiểm thử đột biến không cần thư viện ngoài
```

Thay đổi trong mã chung (`app.js`) được giữ nhỏ và có chú thích "nhóm B": thêm `state.kitchen`, đưa vào lưu máy, chụp, gộp và đồng bộ; thêm lời nhắc hạn dùng vào lịch nhắc gửi máy chủ; thêm tab, băng nhắc, nút "Cất đồ đã mua vào tủ" và phím tắt "hôm nay nấu gì". Máy chủ **không phải sửa**: nó lưu dữ liệu dạng JSON nguyên khối, phần bếp đi kèm như các phần khác.

## Dữ liệu và đồng bộ

```
state.kitchen = {
  meals:   { "2026-11-09|toi": [{ d: "lib:ca ri ga", n: "Cà ri gà", s: 4 }] },
  stock:   [{ id, name, qty: "500 g", exp: "2026-11-12" | "", added, u }],
  recipes: [{ id: "my-…", name, servings, items: [{ item, qty }], note, u }]
}
state.meta.mealU = { "2026-11-09|toi": <thời điểm sửa> }
```

- **Tủ đồ, món của tôi** gộp theo từng mục giống việc và thói quen: bản có `u` mới hơn thắng, xoá ghi bằng bia mộ trong `meta.deleted`.
- **Thực đơn** gộp theo từng bữa với `meta.mealU`; bữa bị xoá vẫn giữ dấu thời gian để không sống lại từ máy khác.
- Hai bên cùng dấu thời gian mà khác nội dung thì chọn theo nội dung, để hai máy luôn ra cùng một kết quả. Lỗi này được kiểm thử ngẫu nhiên tìm ra (trước đó máy A và máy B có thể ra hai thực đơn khác nhau).
- Mỗi bữa giữ tên món (`n`) ngay trong thực đơn, nên món của tôi bị xoá thì bữa vẫn hiện tên; danh sách đi chợ báo rõ "không còn công thức" thay vì lặng lẽ bỏ qua.
- Dữ liệu đọc từ máy hoặc máy chủ luôn qua `normalizeKitchen`: thiếu thì tạo, sai kiểu thì bỏ, quá giới hạn thì cắt (300 món trong tủ, 200 món của tôi, 6 món một bữa, 40 nguyên liệu một món).

## Kiểm thử

| Cách kiểm | Lệnh | Kết quả lần chạy cuối |
|---|---|---|
| Unit test logic (ngày cố định, không phụ thuộc giờ chạy) | `npm test` | 49 bài của nhóm B, cả bộ 99/99 xanh |
| Kiểm thử theo tính chất với dữ liệu ngẫu nhiên (hạt giống cố định): tổng gram không mất, không nhân đôi; gộp hai máy giao hoán, lũy đẳng, không mất món | `npm test` | 400 trường hợp ngẫu nhiên, tìm ra và đã sửa 1 lỗi gộp |
| Tích hợp với máy chủ thật: lưu và đọc phần bếp, xung đột 409 rồi gộp, máy chủ nhận lời nhắc hạn dùng | `npm test` | xanh |
| Kiểm thử đột biến: tự làm hỏng mã 253 kiểu (đổi `<` thành `<=`, `&&` thành `\|\|`, đổi số...) xem test có đỏ không | `npm run test:mutation` | 90% đột biến bị bắt; phần còn lại là đột biến tương đương (so sánh với 1e-9, kiểm tra null phòng thủ) |
| Trình duyệt thật, đi hết luồng như người dùng, đồng bộ hai máy | `npm run test:kitchen` | 17 bước xanh, chạy lặp 6 lần liên tiếp không chập chờn |
| Bố cục: không tràn ngang ở 7 cỡ màn hình, có cả tab Bếp | `npm run test:responsive` | xanh |
| Không làm hỏng phần cũ | `npm run test:e2e`, `test:features`, `ml:eval` | xanh |
| Soát giao diện bằng mắt qua ảnh chụp ở 320px, 390px, 1024px, 1440px | `KITCHEN_SHOTS=anh npm run test:kitchen` | đã soát, sửa 2 lỗi (tràn ngang ở 320px, hạn dùng bị "dính" sang món sau) |

## Chưa kiểm tra

- Chưa thử trên điện thoại thật (mới giả lập cỡ màn hình trên Chromium).
- Chưa thử thông báo đẩy thật cho lời nhắc hạn dùng (test dùng bộ gửi giả, giống phần còn lại của dự án).
- Ô chọn ngày (`input type=date`) hiển thị theo ngôn ngữ của trình duyệt.

## Có thể làm tiếp

- Đơn vị đếm khác tên (1 vỉ trứng với 10 quả) chưa quy đổi được cho nhau.
- Kéo thả món giữa các bữa (liên quan nhóm D: kéo thả trên lịch).
- Chia sẻ thực đơn và tủ đồ với người nhà (nhóm A).
