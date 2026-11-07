# Bảng việc của nhóm

Tệp này được **sinh tự động** từ `docs/tasks.json` bằng `npm run tasks:doc`. Sửa ở `tasks.json`, đừng sửa tay ở đây.

**Cách chia:** mỗi thành viên phụ trách trọn **một chức năng mới** của Remi, từ dữ liệu, máy chủ, giao diện tới test và tài liệu. Năm chức năng độc lập với nhau nên làm song song được, ngoài vài chỗ phụ thuộc ghi rõ bên dưới.

Điểm là mức công sức tương đối (1 nhỏ, 2 nhỏ vừa, 3 vừa, 5 lớn), **không phải số ngày**. Năm chức năng có tổng điểm bằng nhau; có test kiểm tra điều này.

## Phân công

| Nhóm | Chức năng | Gồm | Số việc | Tổng điểm | Thành viên (tài khoản GitHub) |
|---|---|---|---|---|---|
| A | **Chia sẻ với gia đình** | Mời người thân, danh sách đi chợ dùng chung, giao việc cho nhau, thói quen chung | 5 | 19 | |
| B | **Thực đơn tuần và tủ đồ nhà** | Lên thực đơn cả tuần, gộp danh sách đi chợ, quản lý đồ có sẵn và hạn dùng | 5 | 19 | |
| C | **Thống kê, chuỗi ngày và phần thưởng** | Chuỗi ngày liên tiếp, biểu đồ tuần tháng, huy hiệu, Remi đổi biểu cảm | 5 | 19 | |
| D | **Lịch nâng cao** | Xem tuần và ngày dạng dòng thời gian, kéo thả, báo trùng giờ, xuất nhập lịch .ics | 5 | 19 | |
| E | **Nhập nhanh thông minh** | Nhiều việc trong một câu, chụp ảnh thành danh sách, việc hay dùng, nói liên tục, hoàn tác | 5 | 19 | |

Điền tên thành viên vào cột cuối khi chốt.

## Quyết định cần chốt trước khi bắt đầu

Cả nhóm nên họp một lần để chốt các mục này.

| Mã | Quyết định | Nội dung | Ai chốt |
|---|---|---|---|
| D-1 | Kiến trúc riêng tư | Chỉ câu nói không rời máy (giữ đồng bộ và máy chủ), hay mọi dữ liệu không rời máy? Chức năng A (chia sẻ) và D5 (liên kết lịch) cần máy chủ nên phải chốt trước; E2 gửi ảnh tới Claude nên cũng phải nêu rõ cho người dùng. | cả nhóm |
| D-2 | Giấy phép mã nguồn | Hiện package.json ghi UNLICENSED và chưa có tệp LICENSE. Chọn giấy phép trước khi mở repo cho người ngoài. | người đứng tên repo |
| D-3 | Có làm N0 trước hay không | Khuyến nghị: một người làm N0 (tách app.js) trong lúc cả nhóm đọc mã và chốt thiết kế, rồi mới chia nhánh làm chức năng. Nếu bỏ qua, chấp nhận xung đột khi gộp và gộp nhỏ, gộp thường xuyên. | cả nhóm |
| D-4 | Thứ tự ưu tiên khi chỉ kịp làm một phần | Mỗi chức năng chia từng việc nhỏ theo thứ tự, việc đầu của mỗi nhóm đã có giá trị riêng. Chốt xem nếu thiếu thời gian thì chức năng nào cắt bớt phần cuối trước. | cả nhóm |
| D-5 | Chính sách dữ liệu và điều khoản | Soạn trước khi mở cho người dùng thật: chia sẻ gia đình (A), gửi ảnh cho Claude (E2), liên kết lịch (D5). | cả nhóm |
| D-6 | Quy ước làm việc | Quy ước nhánh, số người duyệt, bắt buộc CI xanh. Đề xuất mặc định trong CONTRIBUTING.md. | cả nhóm |

## Thứ tự làm trong mỗi chức năng

**Đợt 1** (làm ngay được, không phụ thuộc việc khác): A1 (5), B1 (5), B3 (5), B5 (2), C1 (5), D1 (5), D4 (3), E1 (5), E2 (5), E3 (3), E5 (3)

**Đợt 2**: A2 (5), A3 (3), A4 (3), B2 (5), B4 (2), C2 (5), C3 (3), D2 (5), D3 (3), D5 (3), E4 (3)

**Đợt 3**: A5 (3), C4 (3), C5 (3)

Việc đầu của mỗi chức năng đều có giá trị dùng được riêng, nên nếu thiếu thời gian có thể dừng ở giữa chừng mà không bỏ phí.

## Chức năng A: Chia sẻ với gia đình

Mời người thân, danh sách đi chợ dùng chung, giao việc cho nhau, thói quen chung. Tổng 19 điểm.

### A1. Gia đình và lời mời (5 điểm)

Phụ thuộc: không. Nhãn: feature, backend, frontend.

**Bối cảnh.** Mỗi tài khoản hiện là một ngăn riêng, dữ liệu nằm trong một tài liệu JSON theo từng người (bảng states). Chia sẻ cần mô hình mới, không nhét vào tài liệu cá nhân.

**Việc cần làm**
- Bảng families, family_members (vai trò chủ hoặc thành viên) và invites (mã dùng một lần, hết hạn).
- API: tạo gia đình, tạo lời mời (liên kết có mã), chấp nhận, rời nhóm, chủ xoá thành viên, chủ xoá gia đình.
- Màn Gia đình trong Hồ sơ: danh sách thành viên, nút Mời, hiện liên kết để sao chép.
- Một người thuộc tối đa một gia đình ở bản đầu để đơn giản.

**Tiêu chí nghiệm thu**
- [ ] Hai tài khoản kết nối qua liên kết mời và thấy nhau trong màn Gia đình
- [ ] Mã mời dùng lần hai hoặc quá hạn bị từ chối
- [ ] Rời nhóm hay bị xoá thì không còn truy cập gì của gia đình (có test)
- [ ] Có test máy chủ cho toàn bộ luồng và quyền của từng vai trò

**Tệp hiện có liên quan:** `server/db.js`, `server/routes.js`, `web/js/app.js`

### A2. Danh sách đi chợ dùng chung (5 điểm)

Phụ thuộc: A1. Nhãn: feature, backend, frontend.

**Bối cảnh.** Việc đi chợ thường là của cả nhà: một người lên danh sách, người đi chợ tick từng món.

**Việc cần làm**
- Cho phép chia sẻ một việc đi chợ (kèm danh sách và số lượng) với gia đình.
- Lưu danh sách chung ở bảng riêng; mọi thành viên xem, tick, thêm món, sửa số lượng.
- Cập nhật gần thời gian thực bằng hỏi lại mỗi 15 giây khi đang mở việc đó.
- Hiện ai vừa tick món nào. Xung đột (hai người cùng sửa một món) thì bản mới nhất thắng và báo nhẹ.

**Tiêu chí nghiệm thu**
- [ ] Hai tài khoản trong cùng gia đình cùng tick một danh sách và thấy thay đổi của nhau trong vòng 20 giây
- [ ] Người ngoài gia đình không đọc được (có test truy cập)
- [ ] Bản chia sẻ không làm hỏng đồng bộ dữ liệu cá nhân hiện có
- [ ] Thêm bước vào e2e/run.js hoặc một bộ e2e mới cho hai thiết bị cùng gia đình

**Tệp hiện có liên quan:** `server/routes.js`, `server/db.js`, `web/js/app.js`, `e2e/run.js`

### A3. Giao việc cho người trong nhà (3 điểm)

Phụ thuộc: A1. Nhãn: feature, backend, frontend.

**Bối cảnh.** Ví dụ: nhờ vợ đón con lúc 5h. Hiện chỉ tự nhắc cho mình.

**Việc cần làm**
- Khi tạo việc, chọn Giao cho một thành viên gia đình.
- Người nhận thấy việc trong mục Việc được giao, chọn Nhận, Từ chối hoặc Đã xong.
- Người giao thấy trạng thái. Có huy hiệu số việc chưa xem trên avatar.

**Tiêu chí nghiệm thu**
- [ ] Giao, nhận, từ chối và hoàn thành đều có trạng thái đúng ở cả hai phía (có test)
- [ ] Chỉ thành viên cùng gia đình mới giao được cho nhau
- [ ] Việc từ chối quay về người giao kèm thông báo trong app

**Tệp hiện có liên quan:** `server/routes.js`, `server/db.js`, `web/js/app.js`

### A4. Thói quen chung và nhắc nhau (3 điểm)

Phụ thuộc: A1. Nhãn: feature, backend, frontend.

**Bối cảnh.** Uống nước hay đi bộ dễ giữ hơn khi cả nhà cùng làm.

**Việc cần làm**
- Một thói quen có thể mở chia sẻ cho gia đình, mỗi người có tiến độ riêng.
- Màn tóm tắt: hôm nay ai đã làm xong, ai chưa.
- Nút Nhắc nhẹ gửi một lời nhắc dễ thương cho người chưa làm (giới hạn tần suất để không phiền).

**Tiêu chí nghiệm thu**
- [ ] Tiến độ của mỗi người chỉ hiện cho người cùng gia đình
- [ ] Nút Nhắc nhẹ có giới hạn số lần mỗi ngày (có test)
- [ ] Tắt chia sẻ thì người khác không còn thấy tiến độ

**Tệp hiện có liên quan:** `server/routes.js`, `web/js/app.js`

### A5. Chia từng mục và thu hồi quyền (3 điểm)

Phụ thuộc: A1, A2. Nhãn: feature, privacy, backend, frontend.

**Bối cảnh.** Người dùng cần kiểm soát rõ cái gì đang được chia sẻ với ai.

**Việc cần làm**
- Màn Đang chia sẻ: liệt kê từng việc, danh sách, thói quen đã chia sẻ và với ai.
- Thu hồi từng mục hoặc tất cả bằng một nút.
- Ghi nhật ký ngắn ai đã xem hay sửa mục chung gần đây.

**Tiêu chí nghiệm thu**
- [ ] Thu hồi có hiệu lực ngay ở lần gọi API kế tiếp (có test)
- [ ] Không có đường nào để đọc mục chưa được chia sẻ, kể cả đoán mã (có test)
- [ ] Cập nhật README mục Chia sẻ và quyền riêng tư

**Tệp hiện có liên quan:** `server/routes.js`, `web/js/app.js`

## Chức năng B: Thực đơn tuần và tủ đồ nhà

Lên thực đơn cả tuần, gộp danh sách đi chợ, quản lý đồ có sẵn và hạn dùng. Tổng 19 điểm.

### B1. Thực đơn tuần (5 điểm)

Phụ thuộc: không. Nhãn: feature, frontend.

**Bối cảnh.** Hiện Remi chỉ giúp đi chợ cho từng bữa. Nhiều nhà muốn lên thực đơn cả tuần một lần.

**Việc cần làm**
- Tab Thực đơn: lưới 7 ngày nhân 3 bữa (sáng, trưa, tối).
- Chọn món từ kho món ăn (tìm không dấu) hoặc gõ tên món tự do; mỗi bữa có số người ăn.
- Lưu theo tuần, sao chép tuần trước sang tuần này.
- Lưu trong dữ liệu người dùng và đồng bộ như các dữ liệu khác.

**Tiêu chí nghiệm thu**
- [ ] Tạo, sửa, xoá món trong từng bữa và đồng bộ sang thiết bị khác (có test e2e)
- [ ] Không tràn ngang ở 320px; ở màn hình rộng hiện cả tuần cùng lúc
- [ ] Có test cho phần sao chép tuần

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`, `web/data/dishes.json`

### B2. Gộp danh sách đi chợ từ thực đơn (5 điểm)

Phụ thuộc: B1. Nhãn: feature, frontend.

**Bối cảnh.** Cả tuần dùng nhiều lần hành, gừng, nước mắm. Phải cộng dồn chứ không liệt kê lặp lại.

**Việc cần làm**
- Nút Tạo danh sách đi chợ từ tuần: lấy nguyên liệu của mọi món trong tuần, co giãn theo số người từng bữa.
- Cộng dồn nguyên liệu trùng nếu cùng loại đơn vị (g với kg, ml với lít); khác loại thì giữ hai dòng.
- Nhóm theo loại (thịt cá, rau củ, gia vị, khác).
- Tạo ra một việc đi chợ thường, dùng lại bộ tick và chỉnh số lượng đã có.

**Tiêu chí nghiệm thu**
- [ ] Hai món cùng dùng 200 g và 300 g thịt ba chỉ ra 500 g (có test trên qty.js hoặc hàm mới)
- [ ] Đơn vị không cộng được thì không làm mất dòng nào
- [ ] Có test với ít nhất 5 món chồng lên nhau

**Tệp hiện có liên quan:** `web/js/qty.js`, `web/js/app.js`, `server/test/qty.test.js`

### B3. Tủ đồ nhà (5 điểm)

Phụ thuộc: không. Nhãn: feature, frontend.

**Bối cảnh.** Biết nhà còn gì để khỏi mua trùng và khỏi để đồ hỏng. Lưu ý: state.pantry hiện chỉ là bộ nhớ gợi ý khi đi chợ, không phải kho đồ có sẵn; cần kho mới.

**Việc cần làm**
- Dữ liệu mới state.fridge: tên, số lượng, đơn vị, hạn dùng.
- Màn Tủ đồ: thêm, sửa, trừ khi dùng, sắp theo hạn dùng.
- Đi chợ xong, tick món thì có nút Cho vào tủ.
- Nhắc đồ sắp hết hạn trong 2 ngày (dùng cơ chế nhắc hiện có).

**Tiêu chí nghiệm thu**
- [ ] Thêm và trừ số lượng dùng đơn vị qty.js, không cho số âm (có test)
- [ ] Đồ sắp hết hạn hiện nổi bật và có lời nhắc
- [ ] Dữ liệu đồng bộ cùng các dữ liệu khác

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`, `server/test/qty.test.js`

### B4. Hôm nay nấu gì (2 điểm)

Phụ thuộc: B3. Nhãn: feature, frontend.

**Bối cảnh.** Câu hỏi mỗi ngày của người nội trợ.

**Việc cần làm**
- Gợi ý món nấu được từ đồ trong tủ, xếp theo tỉ lệ nguyên liệu đã có.
- Hiện nguyên liệu còn thiếu và nút tạo việc đi chợ cho phần thiếu.

**Tiêu chí nghiệm thu**
- [ ] Món đủ nguyên liệu xếp trên món thiếu (có test thuật toán xếp hạng)
- [ ] Bấm tạo việc đi chợ ra danh sách chỉ gồm phần thiếu

**Tệp hiện có liên quan:** `web/data/dishes.json`, `web/js/app.js`

### B5. Món của tôi (2 điểm)

Phụ thuộc: không. Nhãn: feature, frontend.

**Bối cảnh.** Mỗi nhà có những món riêng, kho mẫu không bao giờ đủ.

**Việc cần làm**
- Tạo món riêng: tên, nguyên liệu và định lượng cho 4 người, ghi chú.
- Nhân bản một món có sẵn rồi sửa.
- Món của tôi xuất hiện cùng kho món khi chọn món cho thực đơn và đi chợ.

**Tiêu chí nghiệm thu**
- [ ] Món tạo ra dùng được trong tạo việc đi chợ và (khi có B1) trong thực đơn
- [ ] Dữ liệu đồng bộ giữa các thiết bị
- [ ] Có test

**Tệp hiện có liên quan:** `web/js/app.js`, `web/data/dishes.json`

## Chức năng C: Thống kê, chuỗi ngày và phần thưởng

Chuỗi ngày liên tiếp, biểu đồ tuần tháng, huy hiệu, Remi đổi biểu cảm. Tổng 19 điểm.

### C1. Chuỗi ngày và tỉ lệ hoàn thành (5 điểm)

Phụ thuộc: không. Nhãn: feature, frontend.

**Bối cảnh.** Chỉ thói quen có nhật ký (h.log theo ngày). Việc thường hoàn thành chỉ đổi cờ done, không lưu khi nào, và việc lặp lại chỉ nhảy sang lần sau, nên chưa tính được lịch sử.

**Việc cần làm**
- Ghi lịch sử hoàn thành việc theo ngày (ví dụ state.doneLog) mỗi khi tick, kể cả việc lặp lại.
- Hàm tính chuỗi ngày liên tiếp cho thói quen, tính theo đúng các thứ trong tuần được chọn (ngày nghỉ không làm đứt chuỗi).
- Tỉ lệ hoàn thành 7 và 30 ngày gần nhất.
- Hiện chuỗi và tỉ lệ ngay trên thẻ thói quen.

**Tiêu chí nghiệm thu**
- [ ] Hàm tính chuỗi có test với đồng hồ cố định: thói quen thứ 2, 4, 6 bỏ qua thứ 3 và thứ 5 mà không đứt chuỗi
- [ ] Dữ liệu cũ chưa có nhật ký vẫn chạy bình thường
- [ ] Nhật ký đồng bộ cùng dữ liệu khác

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`, `server/test/ml.test.js`

### C2. Trang Thống kê tuần và tháng (5 điểm)

Phụ thuộc: C1. Nhãn: feature, frontend.

**Bối cảnh.** Người dùng muốn thấy mình tiến bộ ra sao.

**Việc cần làm**
- Tab Thống kê: chọn tuần hoặc tháng.
- Biểu đồ cột vẽ bằng SVG tự viết (không thêm thư viện): nước uống ml mỗi ngày, số việc hoàn thành, tỉ lệ thói quen.
- Ghi nhật ký giờ dậy và giờ đi ngủ mỗi ngày (hiện chỉ lưu trạng thái hiện tại) để vẽ biểu đồ giấc ngủ.
- Màn hình rộng xếp biểu đồ thành lưới.

**Tiêu chí nghiệm thu**
- [ ] Biểu đồ khớp số liệu nhật ký (test với dữ liệu mẫu)
- [ ] Không tràn ngang ở 320px
- [ ] Có trạng thái trống dễ thương khi chưa có dữ liệu

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`, `web/index.html`

### C3. Huy hiệu và bộ sưu tập (3 điểm)

Phụ thuộc: C1. Nhãn: feature, frontend.

**Bối cảnh.** Phần thưởng nhỏ giúp giữ thói quen, nhất là khi app dành cho người thích sự đáng yêu.

**Việc cần làm**
- Khoảng 12 huy hiệu (7 ngày liên tiếp, uống đủ nước 5 ngày, hoàn thành 10 việc đầu tiên...), mô tả điều kiện rõ ràng.
- Mở khoá thì hiện thông báo trong app, mỗi huy hiệu chỉ báo một lần.
- Trang Bộ sưu tập: huy hiệu đã có sáng, chưa có mờ kèm điều kiện.

**Tiêu chí nghiệm thu**
- [ ] Điều kiện từng huy hiệu có test với dữ liệu mẫu
- [ ] Không báo lại huy hiệu đã mở khoá, kể cả sau khi đồng bộ từ thiết bị khác
- [ ] Huy hiệu lưu trong dữ liệu người dùng

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`

### C4. Remi đổi biểu cảm (3 điểm)

Phụ thuộc: C3. Nhãn: feature, frontend, design.

**Bối cảnh.** Linh vật Remi hiện chỉ là biểu tượng. Cho nó sống động theo thành tích.

**Việc cần làm**
- Vẽ vài biến thể SVG của Remi (vui, hào hứng, buồn ngủ, ăn mừng) dựa trên web/icons/icon.svg.
- Remi xuất hiện ở đầu Hôm nay và đổi biểu cảm theo tình hình (đã đủ nước, đang có chuỗi, mới dậy...).
- Mỗi huy hiệu mở khoá một món phụ kiện (nơ, mũ) bật được trong Hồ sơ.

**Tiêu chí nghiệm thu**
- [ ] Tối thiểu 4 biểu cảm, mỗi cái có điều kiện hiện rõ ràng (có test hàm chọn biểu cảm)
- [ ] Không làm chậm tải trang đáng kể (SVG nhúng, không ảnh rời)
- [ ] Hoạt ảnh tôn trọng chế độ giảm chuyển động của hệ thống

**Tệp hiện có liên quan:** `web/icons/icon.svg`, `web/js/app.js`, `web/css/app.css`

### C5. Bản tin cuối tuần (3 điểm)

Phụ thuộc: C2. Nhãn: feature, frontend.

**Bối cảnh.** Một lời tổng kết tuần theo giọng của Remi, gọi đúng tên người dùng.

**Việc cần làm**
- Sáng chủ nhật hiện thẻ Tuần của bạn: số việc xong, nước uống, chuỗi dài nhất, lời Remi.
- Lời Remi theo giọng nhắc đã chọn (thân mật, lịch sự, vui vẻ).
- Nút Lưu ảnh: vẽ thẻ ra canvas thành PNG để chia sẻ.

**Tiêu chí nghiệm thu**
- [ ] Thẻ chỉ hiện một lần mỗi tuần và xem lại được từ Thống kê
- [ ] Ảnh PNG hiển thị đúng chữ tiếng Việt có dấu
- [ ] Có test cho hàm tạo lời tổng kết

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`

## Chức năng D: Lịch nâng cao

Xem tuần và ngày dạng dòng thời gian, kéo thả, báo trùng giờ, xuất nhập lịch .ics. Tổng 19 điểm.

### D1. Xem tuần và xem ngày dạng dòng thời gian (5 điểm)

Phụ thuộc: không. Nhãn: feature, frontend.

**Bối cảnh.** Lịch hiện chỉ có lưới tháng và danh sách của một ngày. Việc cũng chưa có thời lượng nên không vẽ thành khối được.

**Việc cần làm**
- Thêm trường thời lượng (durMin, mặc định 30 phút) vào việc và ô chỉnh trong khung chi tiết.
- Chế độ Tuần và Ngày: trục giờ dọc, việc là khối theo thời lượng, đường kẻ giờ hiện tại.
- Màn hình rộng hiện 7 cột; điện thoại hiện 1 hoặc 3 ngày.
- Thói quen có giờ cố định hiện thành vạch nhỏ.

**Tiêu chí nghiệm thu**
- [ ] Việc cũ chưa có durMin vẫn hiển thị với mặc định
- [ ] Khối việc đúng vị trí và độ dài theo giờ và thời lượng (có test)
- [ ] Không tràn ngang ở 320px

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`

### D2. Kéo thả đổi giờ và thời lượng (5 điểm)

Phụ thuộc: D1. Nhãn: feature, frontend.

**Bối cảnh.** Dời việc bằng kéo thả nhanh hơn mở form rất nhiều.

**Việc cần làm**
- Kéo khối việc sang giờ hoặc ngày khác (chuột và cảm ứng, bước 5 phút).
- Kéo mép dưới để đổi thời lượng.
- Lưu và đồng bộ; việc lặp lại hỏi dời một lần hay mọi lần.
- Phím tắt bàn phím để dời cho người không dùng chuột.

**Tiêu chí nghiệm thu**
- [ ] Kéo xong thì giờ lưu đúng và lịch nhắc cập nhật (có test e2e)
- [ ] Hoạt động trên cảm ứng (kiểm tra bằng thiết bị thật hoặc giả lập cảm ứng)
- [ ] Có phương án thay thế bằng bàn phím

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`

### D3. Báo trùng giờ và tìm giờ trống (3 điểm)

Phụ thuộc: D1. Nhãn: feature, frontend.

**Bối cảnh.** Hai việc đè nhau là lỗi dễ gặp khi tự đặt nhiều thứ.

**Việc cần làm**
- Phát hiện hai việc có khoảng thời gian chồng nhau, hiện cảnh báo ngay trong khung tạo và sửa.
- Nút Tìm giờ trống: gợi ý 3 khoảng trống gần nhất đủ thời lượng, trong khung giờ thức của người dùng.
- Bấm vào gợi ý thì điền giờ vào bộ chọn.

**Tiêu chí nghiệm thu**
- [ ] Hàm tìm khoảng trống có test với nhiều trường hợp biên (nửa đêm, trùng đúng đầu mút)
- [ ] Không báo trùng với việc đã xong
- [ ] Gợi ý không rơi vào giờ ngủ

**Tệp hiện có liên quan:** `web/js/app.js`

### D4. Xuất và nhập lịch .ics (3 điểm)

Phụ thuộc: không. Nhãn: feature, frontend, backend.

**Bối cảnh.** Cầu nối với Google Calendar và Apple Calendar.

**Việc cần làm**
- Nút Xuất .ics: việc và (tuỳ chọn) thói quen có giờ thành sự kiện, có lặp lại hằng ngày hoặc hằng tuần.
- Nhập .ics: đọc VEVENT cơ bản (tiêu đề, giờ, thời lượng, lặp lại đơn giản), cho xem trước rồi mới nhập.
- Bỏ qua phần không hỗ trợ và nói rõ đã bỏ gì.

**Tiêu chí nghiệm thu**
- [ ] Xuất rồi nhập lại ra các việc giống nhau về giờ và lặp lại (có test)
- [ ] Mở được tệp .ics xuất ra bằng ít nhất một ứng dụng lịch thật (ghi vào pull request)
- [ ] Tệp .ics hỏng không làm app lỗi

**Tệp hiện có liên quan:** `web/js/app.js`, `server/routes.js`

### D5. Liên kết lịch để thuê bao (3 điểm)

Phụ thuộc: D4. Nhãn: feature, backend, privacy.

**Bối cảnh.** Thuê bao một địa chỉ .ics trong Google hay Apple Calendar thì lịch của Remi tự hiện bên đó, không cần xuất tay.

**Việc cần làm**
- Bảng calendar_tokens: mỗi người có một mã bí mật, tạo lại hoặc thu hồi được.
- GET /api/cal/<mã>.ics trả lịch tương lai của người đó (không dùng cookie).
- Nút Lấy liên kết lịch trong Hồ sơ, cảnh báo rằng ai có liên kết là xem được lịch.

**Tiêu chí nghiệm thu**
- [ ] Mã sai trả 404, mã bị thu hồi trả 404 (có test)
- [ ] Chỉ trả việc của chính chủ, không trả ghi chú riêng
- [ ] Có giới hạn tần suất truy cập

**Tệp hiện có liên quan:** `server/routes.js`, `server/db.js`, `web/js/app.js`

## Chức năng E: Nhập nhanh thông minh

Nhiều việc trong một câu, chụp ảnh thành danh sách, việc hay dùng, nói liên tục, hoàn tác. Tổng 19 điểm.

### E1. Nhiều việc trong một câu (5 điểm)

Phụ thuộc: không. Nhãn: feature, ai, frontend.

**Bối cảnh.** Người dùng hay nói liền một mạch: mai họp 9h, 2h đón con, tối đi chợ. Hiện mỗi lần chỉ ra một việc.

**Việc cần làm**
- Tách câu thành nhiều việc: cập nhật prompt AI (trả mảng) và bộ luật tách theo dấu phẩy, chấm phẩy, từ nối (rồi, sau đó, và).
- Màn xem lại: danh sách các việc đã hiểu, bỏ tick việc không muốn, sửa nhanh từng việc rồi Thêm tất cả.
- Thêm ít nhất 15 câu nhiều việc vào ml/data/gold.jsonl (kèm nhãn) để đo bộ luật.

**Tiêu chí nghiệm thu**
- [ ] Câu 3 việc ra đúng 3 việc với giờ đúng trong ít nhất 90% mẫu trên bộ đo mới (báo cáo số liệu)
- [ ] Câu một việc vẫn chạy y như cũ (các bài đo cũ không giảm điểm)
- [ ] Có test đầu-cuối từ câu tới ba việc được lưu

**Tệp hiện có liên quan:** `server/ai.js`, `web/js/local-parse.js`, `web/js/app.js`, `ml/data/gold.jsonl`

### E2. Chụp ảnh thành danh sách (5 điểm)

Phụ thuộc: không. Nhãn: feature, ai, backend, frontend.

**Bối cảnh.** Ghi chú viết tay, tin nhắn chụp màn hình, trang công thức: chụp một cái là ra danh sách đi chợ.

**Việc cần làm**
- Nút Chụp hoặc chọn ảnh; thu nhỏ ảnh ở máy trước khi gửi.
- Endpoint POST /api/ai/vision gửi ảnh cho Claude (khối ảnh của Messages API) để đọc ra việc hoặc danh sách món kèm định lượng.
- Giới hạn kích thước, định dạng và dùng chung bộ đếm lượt AI mỗi ngày; không lưu ảnh ở máy chủ.
- Có dòng giải thích ảnh sẽ được gửi tới Claude; tắt hẳn khi người dùng chọn chế độ Chỉ trên máy.

**Tiêu chí nghiệm thu**
- [ ] Ảnh sai định dạng hoặc quá lớn bị từ chối rõ ràng (có test)
- [ ] Không có ảnh nào được ghi vào đĩa hay cơ sở dữ liệu (có test)
- [ ] Kết quả đi qua màn xem lại trước khi tạo gì, không tự tạo việc
- [ ] Kiểm thử với ít nhất 5 ảnh thật, ghi kết quả vào pull request (máy chủ giả trong test tự động)

**Tệp hiện có liên quan:** `server/ai.js`, `server/routes.js`, `web/js/app.js`

### E3. Việc hay dùng và mẫu (3 điểm)

Phụ thuộc: không. Nhãn: feature, frontend.

**Bối cảnh.** Nhiều việc lặp đi lặp lại nhưng không đều đủ để đặt lặp (đón con 4h30 các ngày đi học).

**Việc cần làm**
- Lưu một việc làm mẫu: tên, giờ trong ngày, nhắc trước, danh sách.
- Dải Việc hay dùng ở trang chủ: một chạm tạo lại cho hôm nay hoặc ngày mai.
- Gợi ý lưu thành mẫu khi một việc có tên gần giống xuất hiện từ 3 lần trở lên.

**Tiêu chí nghiệm thu**
- [ ] Một chạm tạo đúng việc với giờ của hôm nay hoặc ngày mai (có test)
- [ ] Gợi ý chỉ hiện sau lần thứ 3 và không hiện lại khi đã từ chối
- [ ] Mẫu đồng bộ giữa các thiết bị

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`

### E4. Nói liên tục (3 điểm)

Phụ thuộc: E1. Nhãn: feature, frontend.

**Bối cảnh.** Nút micro hiện chỉ nghe một câu rồi tự gửi.

**Việc cần làm**
- Chế độ nói liên tục: hiện chữ trực tiếp, tự ngắt câu khi dừng.
- Đưa toàn bộ lời nói qua cơ chế nhiều việc của E1, hiện màn xem lại.
- Xử lý khéo trường hợp bị từ chối quyền micro hoặc trình duyệt không hỗ trợ.

**Tiêu chí nghiệm thu**
- [ ] Nói ba việc liền nhau ra ba việc (kiểm tra bằng giả lập SpeechRecognition trong test)
- [ ] Từ chối micro thì báo hướng dẫn bật quyền, không báo lỗi mơ hồ
- [ ] Dừng thì giải phóng micro

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`

### E5. Hoàn tác và lịch sử nhập (3 điểm)

Phụ thuộc: không. Nhãn: feature, frontend.

**Bối cảnh.** Lỡ tay tick nhầm hoặc xoá nhầm là mất công nhập lại.

**Việc cần làm**
- Thông báo Hoàn tác trong khoảng 8 giây sau khi tạo, xoá, tick hoặc dời việc.
- Phím Ctrl hoặc Cmd cộng Z hoàn tác thao tác gần nhất.
- Lịch sử 20 câu đã nhập gần đây, bấm để dùng lại.

**Tiêu chí nghiệm thu**
- [ ] Hoàn tác khôi phục đúng trạng thái trước đó kể cả danh sách và ghi chú (có test)
- [ ] Hoàn tác không làm hỏng đồng bộ (mục khôi phục không bị coi là đã xoá)
- [ ] Lịch sử không lưu câu khi người dùng bật chế độ riêng tư

**Tệp hiện có liên quan:** `web/js/app.js`, `web/css/app.css`

## Việc chung, chưa phân công

Đây là các việc nền tảng (hạ tầng, bảo mật, di động, công cụ) không thuộc chức năng nào. **Không tính vào 95 điểm ở trên.** Ai xong phần của mình sớm thì nhận thêm. Riêng **N0** nên làm trước vì nó giảm xung đột khi 5 người cùng sửa một tệp.

### N0. Tách app.js thành các tệp theo tính năng (nên làm trước) (5 điểm)

Phụ thuộc: không. Nhãn: tooling, refactor.

**Bối cảnh.** app.js là một khối hơn 1500 dòng bọc trong một hàm. Năm người cùng sửa một tệp sẽ xung đột liên tục khi gộp.

**Việc cần làm**
- Tách thành các tệp theo vùng (dữ liệu và đồng bộ, hộp thoại, Hôm nay, Lịch, Thói quen, Đi chợ...) nạp theo thứ tự, dùng chung một đối tượng Remi để chia sẻ trạng thái và hàm.
- Không đổi hành vi: toàn bộ bộ test hiện có vẫn qua.
- Ghi sơ đồ tệp vào CONTRIBUTING.md để mỗi người biết đặt mã tính năng mới ở đâu.

**Tiêu chí nghiệm thu**
- [ ] npm test, test:e2e, test:responsive, test:features đều xanh trước và sau
- [ ] Mỗi tính năng mới có chỗ gắn rõ ràng, không cần sửa các tệp của tính năng khác
- [ ] Cả nhóm xem lại trước khi gộp

**Tệp hiện có liên quan:** `web/js/app.js`, `web/index.html`, `e2e/run.js`

### N1. Quên mật khẩu và xác minh email (5 điểm)

Phụ thuộc: không. Nhãn: backend, security.

**Bối cảnh.** Quên mật khẩu hiện là mất tài khoản; email đăng ký chưa được xác minh.

**Việc cần làm**
- POST /api/auth/forgot và /api/auth/reset với token băm, hết hạn 60 phút, dùng một lần.
- Bộ gửi email tách riêng cấu hình bằng biến môi trường để test thay bằng bộ giả.
- Xác minh email khi đăng ký, banner nhắc nếu chưa xác minh.

**Tiêu chí nghiệm thu**
- [ ] Trả lời giống hệt dù email có tài khoản hay không
- [ ] Token dùng lần hai hoặc quá hạn bị từ chối (có test)
- [ ] Đổi mật khẩu xong thì huỷ mọi phiên đang đăng nhập

**Tệp hiện có liên quan:** `server/routes.js`, `server/auth.js`, `server/db.js`, `web/js/app.js`

### N2. Triển khai thử lên máy chủ thật (5 điểm)

Phụ thuộc: không. Nhãn: ops.

**Bối cảnh.** Docker và compose chưa từng được build hay chạy trên máy chủ thật có HTTPS.

**Việc cần làm**
- Chạy docker build, sửa lỗi nếu có, thêm package-lock.json.
- Chọn nhà cung cấp, bật HTTPS, gắn ổ đĩa cho /data, điền biến môi trường thật.
- Viết docs/DEPLOY.md từng bước.

**Tiêu chí nghiệm thu**
- [ ] Có địa chỉ chạy được, đăng ký và tạo việc thành công
- [ ] Khởi động lại container không mất dữ liệu
- [ ] docs/DEPLOY.md đủ để người khác làm lại từ đầu

**Tệp hiện có liên quan:** `Dockerfile`, `docker-compose.yml`, `.env.example`, `README.md`

### N3. Làm CI chạy ổn định cả bài kiểm thử trình duyệt (3 điểm)

Phụ thuộc: không. Nhãn: ops, testing.

**Bối cảnh.** Job trình duyệt đang để cho phép lỗi vì chưa từng chạy trên GitHub.

**Việc cần làm**
- Làm test:e2e, test:responsive, test:features xanh trên GitHub Actions.
- Bỏ continue-on-error và đặt các job thành bắt buộc trong bảo vệ nhánh main.

**Tiêu chí nghiệm thu**
- [ ] Ba bộ test xanh trên 5 lần chạy liên tiếp
- [ ] Pull request không gộp được khi CI đỏ

**Tệp hiện có liên quan:** `.github/workflows/ci.yml`, `package.json`

### N4. Tự lưu font và rà soát bảo mật (3 điểm)

Phụ thuộc: không. Nhãn: security, frontend.

**Bối cảnh.** Trang đang tải font từ Google Fonts nên lộ địa chỉ IP người dùng cho bên thứ ba.

**Việc cần làm**
- Tự lưu font Be Vietnam Pro trong web/fonts (kiểm tra giấy phép), siết CSP.
- Rà soát theo OWASP ASVS mức cơ bản, ghi docs/SECURITY-REVIEW.md.

**Tiêu chí nghiệm thu**
- [ ] Không còn yêu cầu mạng tới bên thứ ba khi mở trang (có test)
- [ ] Báo cáo liệt kê phát hiện và mức ưu tiên

**Tệp hiện có liên quan:** `server/http.js`, `web/index.html`, `web/css/app.css`

### N5. Bọc Capacitor và thử thông báo đẩy thật (5 điểm)

Phụ thuộc: không. Nhãn: mobile.

**Bối cảnh.** Mới có bản web cài được; web-push chưa từng thử gửi thật tới thiết bị.

**Việc cần làm**
- Thêm Capacitor cho iOS và Android, chạy được trên máy ảo.
- Thử gửi thông báo đẩy thật trên Chrome, Android và Safari iOS (Màn hình chính), ghi bảng kết quả vào docs/PUSH-TEST.md.

**Tiêu chí nghiệm thu**
- [ ] Đăng nhập và đồng bộ chạy được trong app trên máy ảo
- [ ] Bảng kết quả thông báo đẩy ghi rõ thiết bị và phiên bản

**Tệp hiện có liên quan:** `web/index.html`, `web/sw.js`, `server/push.js`, `package.json`

### N6. Hợp nhất bản HTML đơn với bản web chính (3 điểm)

Phụ thuộc: không. Nhãn: tooling.

**Bối cảnh.** standalone/remi.html là ảnh chụp từ một nhánh mã riêng, sẽ lệch dần.

**Việc cần làm**
- Viết script tạo file HTML đơn từ web/ thay cho chỉnh tay.
- Kiểm thử file sinh ra trong CI.

**Tiêu chí nghiệm thu**
- [ ] Chỉ còn một nguồn mã duy nhất
- [ ] CI kiểm tra file sinh ra

**Tệp hiện có liên quan:** `standalone/remi.html`, `web/index.html`, `web/js/app.js`

### N7. Huấn luyện model nhỏ hiểu câu trên máy (5 điểm)

Phụ thuộc: không. Nhãn: ai, research.

**Bối cảnh.** Kịch bản huấn luyện đã viết nhưng chưa từng chạy vì chưa có GPU. Nên làm sau khi đã có dữ liệu thật và bộ đo mù.

**Việc cần làm**
- Chọn model nền nhỏ có giấy phép dùng thương mại phù hợp.
- Huấn luyện, đo trên gold, holdout và dữ liệu thật, so với bộ luật, đo tốc độ trên điện thoại.

**Tiêu chí nghiệm thu**
- [ ] Có báo cáo số đo cạnh bộ luật, nêu cả những chỗ model kém hơn
- [ ] Chỉ đề xuất đưa vào app nếu đạt các tiêu chí trong ml/README.md

**Tệp hiện có liên quan:** `ml/train/lora_finetune.py`, `ml/engines/llamacpp.js`, `ml/README.md`

