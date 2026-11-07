# Bảng việc của nhóm

Tệp này được **sinh tự động** từ `docs/tasks.json` bằng `npm run tasks:doc`. Sửa ở `tasks.json`, đừng sửa tay ở đây.

Điểm là mức công sức tương đối (1 nhỏ, 2 nhỏ vừa, 3 vừa, 5 lớn), **không phải số ngày**. Năm nhóm có tổng điểm bằng nhau; có test kiểm tra điều này.

## Phân công

| Nhóm | Phụ trách | Trọng tâm | Số việc | Tổng điểm |
|---|---|---|---|---|
| A | Tài khoản và máy chủ | Đăng nhập, bảo mật tài khoản, dữ liệu phía máy chủ | 6 | 19 |
| B | Di động và thông báo | App trên điện thoại, thông báo, gọi dậy | 5 | 19 |
| C | AI và dữ liệu | Hiểu câu nói trên máy, kho món ăn, huấn luyện model | 5 | 19 |
| D | Giao diện và trải nghiệm | Màn hình, trợ năng, chia sẻ, đa ngôn ngữ | 5 | 19 |
| E | Nền tảng và chất lượng | Triển khai, CI, công cụ, bảo mật, giám sát | 6 | 19 |

Mỗi nhóm giao cho một thành viên. Tên thành viên điền vào bảng dưới khi chốt:

| Nhóm | Thành viên (tài khoản GitHub) |
|---|---|
| A | |
| B | |
| C | |
| D | |
| E | |

## Quyết định cần chốt trước khi bắt đầu

Cả nhóm nên họp một lần để chốt các mục này; nhiều việc bên dưới phụ thuộc vào chúng.

| Mã | Quyết định | Nội dung | Ai chốt |
|---|---|---|---|
| D-1 | Kiến trúc riêng tư | Chỉ câu nói không rời máy (giữ đồng bộ và thông báo qua máy chủ), hay mọi dữ liệu không rời máy (local-first, cần app native, thông báo cục bộ)? Ảnh hưởng B2, C1, D1 và nhóm A. | cả nhóm |
| D-2 | Giấy phép mã nguồn | Hiện package.json ghi UNLICENSED và chưa có tệp LICENSE. Chọn giấy phép trước khi mở repo cho người ngoài. | người đứng tên repo |
| D-3 | Tài khoản cửa hàng ứng dụng | Cần tài khoản Apple Developer và Google Play Developer (kiểm tra phí hiện hành) và người đứng tên. | người đứng tên repo |
| D-4 | Hosting và dịch vụ email | Chọn nơi chạy máy chủ và dịch vụ gửi email giao dịch cho A1, A2. | cả nhóm |
| D-5 | Chính sách dữ liệu và điều khoản | Soạn chính sách quyền riêng tư trước khi thu dữ liệu huấn luyện (C4) hay mở cho người dùng thật. | cả nhóm |
| D-6 | Quy ước làm việc | Quy ước nhánh, số người duyệt mỗi pull request, bắt buộc CI xanh. Đề xuất mặc định trong CONTRIBUTING.md. | cả nhóm |

## Thứ tự làm theo phụ thuộc

**Đợt 1** (làm song song được, không phụ thuộc việc khác): A1 (5), A3 (3), A4 (2), A5 (3), A6 (3), B1 (5), B3 (3), C1 (3), C2 (3), C3 (3), C4 (5), D1 (5), D2 (3), D3 (3), D4 (3), D5 (5), E1 (5), E2 (3), E3 (2), E4 (3), E5 (3), E6 (3)

**Đợt 2**: A2 (3), B2 (5), B4 (3), C5 (5)

**Đợt 3**: B5 (3)

## Nhóm A: Tài khoản và máy chủ

Đăng nhập, bảo mật tài khoản, dữ liệu phía máy chủ. Tổng 19 điểm.

### A1. Quên mật khẩu và đặt lại qua email (5 điểm)

Phụ thuộc: không. Nhãn: backend, security.

**Bối cảnh.** Hiện người dùng quên mật khẩu là mất tài khoản. Chưa có dịch vụ gửi email.

**Việc cần làm**
- Thêm POST /api/auth/forgot và POST /api/auth/reset.
- Bảng password_resets: token lưu dạng băm, hết hạn sau 60 phút, chỉ dùng một lần.
- Bộ gửi email tách riêng (cấu hình SMTP bằng biến môi trường MAIL_*) để test thay được bằng bộ giả.
- Thêm liên kết Quên mật khẩu vào màn đăng nhập.
- Đổi mật khẩu xong thì huỷ mọi phiên đang đăng nhập.

**Tiêu chí nghiệm thu**
- [ ] Trả lời giống hệt dù email có tài khoản hay không (không lộ email nào có tài khoản)
- [ ] Token dùng lần hai bị từ chối, token quá hạn bị từ chối
- [ ] Có giới hạn số lần yêu cầu theo email và IP
- [ ] Có test máy chủ cho các trường hợp trên và một test đầu-cuối đổi mật khẩu

**Tệp liên quan:** `server/routes.js`, `server/auth.js`, `server/db.js`, `web/js/app.js`

### A2. Xác minh email khi đăng ký (3 điểm)

Phụ thuộc: A1. Nhãn: backend.

**Bối cảnh.** Hiện đăng ký bằng email bất kỳ, kể cả email không phải của mình.

**Việc cần làm**
- Thêm cột verified_at và liên kết xác minh gửi qua bộ gửi email của A1.
- Chưa xác minh vẫn dùng được nhưng có banner nhắc, cấu hình ALLOW_UNVERIFIED để siết chặt.
- Gửi lại email xác minh có giới hạn tần suất.

**Tiêu chí nghiệm thu**
- [ ] Bấm liên kết thì tài khoản được đánh dấu đã xác minh
- [ ] Banner biến mất sau khi xác minh
- [ ] Có test máy chủ và cập nhật README

**Tệp liên quan:** `server/routes.js`, `server/db.js`, `web/js/app.js`

### A3. Danh sách thiết bị đăng nhập và đăng xuất từ xa (3 điểm)

Phụ thuộc: không. Nhãn: backend, frontend.

**Bối cảnh.** Bảng sessions đã lưu user agent nhưng người dùng không xem hay huỷ được phiên nào.

**Việc cần làm**
- GET /api/sessions và DELETE /api/sessions/:id (chỉ phiên của chính mình).
- Mục Thiết bị đăng nhập trong Hồ sơ: đánh dấu thiết bị hiện tại, nút Đăng xuất thiết bị khác.

**Tiêu chí nghiệm thu**
- [ ] Không huỷ được phiên của người khác (có test)
- [ ] Huỷ phiên khác thì thiết bị đó nhận 401 ở lần gọi kế tiếp
- [ ] Có test máy chủ

**Tệp liên quan:** `server/routes.js`, `server/auth.js`, `web/js/app.js`

### A4. Lưu bộ đếm giới hạn vào SQLite (2 điểm)

Phụ thuộc: không. Nhãn: backend, security.

**Bối cảnh.** Giới hạn thử đăng nhập và đăng ký đang nằm trong bộ nhớ, khởi động lại là mất.

**Việc cần làm**
- Bảng rate_limits (khoá, số lần, hết hạn) dùng chung cho đăng nhập, đăng ký và quên mật khẩu.
- Dọn các dòng hết hạn định kỳ.

**Tiêu chí nghiệm thu**
- [ ] Khởi động lại máy chủ không xoá bộ đếm (có test)
- [ ] Có test dọn dẹp dòng hết hạn

**Tệp liên quan:** `server/auth.js`, `server/routes.js`, `server/db.js`

### A5. Sao lưu SQLite tự động và khôi phục (3 điểm)

Phụ thuộc: không. Nhãn: backend, ops.

**Bối cảnh.** Toàn bộ dữ liệu người dùng nằm trong một file; mất file là mất tất cả.

**Việc cần làm**
- Lệnh npm run backup dùng VACUUM INTO ra file có dấu thời gian.
- Tuỳ chọn chạy sao lưu định kỳ trong máy chủ (BACKUP_EVERY_HOURS), giữ N bản gần nhất.
- Hướng dẫn khôi phục và một lệnh kiểm tra bản sao lưu mở được.

**Tiêu chí nghiệm thu**
- [ ] Sao lưu khi máy chủ đang chạy không làm hỏng dữ liệu
- [ ] Có test: sao lưu rồi khôi phục ra cùng số người dùng và việc
- [ ] Có mục Sao lưu trong README

**Tệp liên quan:** `server/db.js`, `server/index.js`, `Dockerfile`

### A6. Xuất và nhập dữ liệu cá nhân (3 điểm)

Phụ thuộc: không. Nhãn: backend, frontend.

**Bối cảnh.** Người dùng chưa có cách lấy dữ liệu của mình ra khỏi Remi.

**Việc cần làm**
- GET /api/export trả toàn bộ dữ liệu của người dùng dạng JSON có phiên bản định dạng.
- POST /api/import kiểm tra chặt rồi gộp vào dữ liệu hiện có.
- Nút Xuất và Nhập trong Hồ sơ.

**Tiêu chí nghiệm thu**
- [ ] Xuất rồi nhập sang tài khoản mới ra dữ liệu giống hệt (có test)
- [ ] Tệp sai định dạng bị từ chối với thông báo rõ
- [ ] Có test máy chủ

**Tệp liên quan:** `server/routes.js`, `web/js/app.js`

## Nhóm B: Di động và thông báo

App trên điện thoại, thông báo, gọi dậy. Tổng 19 điểm.

### B1. Bọc ứng dụng bằng Capacitor (iOS và Android) (5 điểm)

Phụ thuộc: không. Nhãn: mobile.

**Bối cảnh.** Mới có bản web cài được (PWA). Muốn lên cửa hàng ứng dụng cần bản native bọc bên ngoài.

**Việc cần làm**
- Thêm Capacitor, tạo dự án android và ios dùng thư mục web/.
- Cấu hình địa chỉ máy chủ (SERVER_URL) vì app native không cùng nguồn với máy chủ.
- Phiên đăng nhập trên WebView: dùng Bearer token (máy chủ đã hỗ trợ) thay cho cookie nếu cần.
- Biểu tượng và màn hình khởi động từ web/icons.
- Tài liệu build và chạy thử trên máy ảo và máy thật.

**Tiêu chí nghiệm thu**
- [ ] Đăng nhập, tạo việc và đồng bộ chạy được trong app Android và iOS
- [ ] Có hướng dẫn từng bước trong docs/MOBILE.md
- [ ] Không làm hỏng bản web hiện tại (npm test và test:e2e vẫn qua)

**Tệp liên quan:** `web/index.html`, `web/manifest.webmanifest`, `package.json`

### B2. Thông báo cục bộ hẹn ngay trên máy (5 điểm)

Phụ thuộc: B1. Nhãn: mobile.

**Bối cảnh.** Thông báo hiện nay đi qua máy chủ. Thông báo hẹn ngay trên máy hoạt động tin cậy hơn và không cần máy chủ biết nội dung.

**Việc cần làm**
- Dùng plugin Local Notifications của Capacitor.
- Dựng lại các thông báo từ buildSchedule() mỗi khi dữ liệu đổi (huỷ cái cũ, đặt cái mới).
- Hỗ trợ cuộc gọi dậy chỉ khi vẫn ở trạng thái ngủ.
- Không đặt trùng với thông báo đẩy từ máy chủ.

**Tiêu chí nghiệm thu**
- [ ] Tắt mạng và đóng app vẫn nhận nhắc đúng giờ trên máy thật
- [ ] Sửa hay xoá việc thì thông báo cũ biến mất
- [ ] Có ghi chú kết quả thử trên ít nhất hai máy

**Tệp liên quan:** `web/js/app.js`, `web/sw.js`

### B3. Kiểm thử thông báo đẩy thật trên Chrome, Safari iOS, Android (3 điểm)

Phụ thuộc: không. Nhãn: mobile, backend.

**Bối cảnh.** Thư viện web-push chưa từng được thử gửi thật tới thiết bị trong quá trình phát triển.

**Việc cần làm**
- Cài web-push, cấu hình VAPID, chạy máy chủ có HTTPS (có thể dùng tunnel).
- Thử Chrome máy tính, Chrome Android, Safari iOS 16.4 trở lên (đã thêm vào Màn hình chính).
- Ghi bảng kết quả vào docs/PUSH-TEST.md; sửa lỗi gặp phải; xử lý đăng ký hết hạn.

**Tiêu chí nghiệm thu**
- [ ] Nút gửi thử /api/push/test nhận được ở cả ba nền tảng
- [ ] Đăng ký hết hạn (410) tự bị xoá
- [ ] Có docs/PUSH-TEST.md với bảng kết quả và phiên bản thiết bị

**Tệp liên quan:** `server/push.js`, `server/scheduler.js`, `web/sw.js`

### B4. Nút hành động trên thông báo (3 điểm)

Phụ thuộc: B3. Nhãn: mobile, frontend.

**Bối cảnh.** Người dùng phải mở app để bấm Xong. Cần bấm ngay trên thông báo.

**Việc cần làm**
- Thêm nút Xong, Nhắc lại sau 10 phút, và Đã uống X ml cho thói quen nước.
- Xử lý ở service worker và gửi về app hoặc API nhỏ để ghi nhận.
- Nhắc lại sau 10 phút tạo một lời nhắc mới.

**Tiêu chí nghiệm thu**
- [ ] Bấm Xong trên thông báo thì việc hoặc mốc thói quen được đánh dấu
- [ ] Nhắc lại sau 10 phút hoạt động đúng một lần
- [ ] Có test cho phần xử lý ở máy chủ nếu có API mới

**Tệp liên quan:** `web/sw.js`, `server/routes.js`, `web/js/app.js`

### B5. Độ tin cậy cuộc gọi dậy trên điện thoại thật (3 điểm)

Phụ thuộc: B2. Nhãn: mobile, research.

**Bối cảnh.** Gọi dậy là tính năng dễ gây thất vọng nhất nếu thông báo bị hệ thống chặn.

**Việc cần làm**
- Thử với Tiết kiệm pin, Tập trung, Không làm phiền, khoá màn hình lâu trên iOS và Android.
- Ghi lại tỉ lệ nhận đúng giờ.
- Thêm màn hướng dẫn trong app và đề xuất đặt thêm báo thức hệ thống.
- Báo cáo xem có cần xin quyền đặc biệt của Apple (Critical Alerts) hay không.

**Tiêu chí nghiệm thu**
- [ ] Có báo cáo kết quả thử trên ít nhất 3 máy
- [ ] Có màn hướng dẫn trong app
- [ ] Quyết định rõ có làm tiếp Critical Alerts hay không

**Tệp liên quan:** `web/js/app.js`

## Nhóm C: AI và dữ liệu

Hiểu câu nói trên máy, kho món ăn, huấn luyện model. Tổng 19 điểm.

### C1. Nối bộ hiểu câu trên máy vào bản web chính (3 điểm)

Phụ thuộc: không. Nhãn: ai, frontend.

**Bối cảnh.** Bộ hiểu câu theo luật đã có và đã đo, nhưng chưa được dùng trong bản web chính. Bản HTML đơn trong standalone/ đã có cách nối làm mẫu.

**Việc cần làm**
- Nhúng local-parse.js và dữ liệu món ăn vào web/index.html.
- Thêm lựa chọn Tự động hoặc Chỉ trên máy trong Hồ sơ.
- Khi AI lỗi hoặc mất mạng thì đọc trên máy và nói rõ trong form.
- Chế độ Chỉ trên máy không được gọi /api/ai/parse.

**Tiêu chí nghiệm thu**
- [ ] Có test đầu-cuối: chế độ Chỉ trên máy không gửi yêu cầu AI nào
- [ ] Mất mạng vẫn tạo được việc bằng câu nói
- [ ] Giữ nguyên hành vi hiện tại khi chọn Tự động và AI hoạt động

**Tệp liên quan:** `web/js/local-parse.js`, `web/js/app.js`, `web/data/dishes.json`

### C2. Báo "không chắc" và chiến lược lai luật rồi AI (3 điểm)

Phụ thuộc: không. Nhãn: ai.

**Bối cảnh.** Bộ luật hiện luôn trả lời, kể cả khi không hiểu. Cần biết khi nào nên hỏi AI hoặc hỏi lại người dùng.

**Việc cần làm**
- Bộ luật trả thêm độ tin cậy và lý do (không thấy giờ, giờ mơ hồ, nhiều ngày...).
- Quy tắc lai: chắc thì dùng luôn, không chắc thì gọi AI hoặc hiện cảnh báo.
- Thêm số đo "không chắc nhưng sai" vào bộ đo.

**Tiêu chí nghiệm thu**
- [ ] Trên gold và holdout, các mẫu sai phải có độ tin cậy thấp hơn các mẫu đúng (báo cáo số liệu)
- [ ] Có test cho từng lý do không chắc
- [ ] Cập nhật ml/README.md

**Tệp liên quan:** `web/js/local-parse.js`, `ml/eval/run.js`

### C3. Mở rộng kho món ăn lên ít nhất 100 món (3 điểm)

Phụ thuộc: không. Nhãn: ai, data.

**Bối cảnh.** Kho hiện có 15 món, là mẫu. Món ngoài kho thì phải nhờ AI hoặc người dùng tự thêm.

**Việc cần làm**
- Thêm món, tên gọi khác và nguyên liệu cho 4 người, tự viết hoặc từ nguồn có giấy phép phù hợp.
- Ghi nguồn và giấy phép vào docs/DATA-SOURCES.md.
- Bổ sung bộ kiểm tra: định lượng đọc được, không trùng tên.

**Tiêu chí nghiệm thu**
- [ ] Ít nhất 100 món, test kho món vẫn qua
- [ ] Có docs/DATA-SOURCES.md nêu rõ nguồn từng nhóm dữ liệu
- [ ] Bộ đo ml/eval chạy lại và không giảm điểm

**Tệp liên quan:** `web/data/dishes.json`, `server/test/ml.test.js`

### C4. Thu dữ liệu thật có đồng ý để làm tập đo và huấn luyện (5 điểm)

Phụ thuộc: không. Nhãn: ai, privacy, backend.

**Bối cảnh.** Số đo hiện tại chỉ trên câu do nhóm tự viết. Cần dữ liệu thật, nhưng chỉ khi người dùng đồng ý rõ ràng.

**Việc cần làm**
- Màn đồng ý rõ ràng, tắt mặc định, có thể rút lại bất kỳ lúc nào.
- Lưu cặp (câu gõ, bản người dùng đã sửa) sau khi bỏ tên, số điện thoại, địa chỉ.
- Cho người dùng xem và xoá dữ liệu đã đóng góp.
- Công cụ xuất tập đo mù (giữ riêng, không đưa vào huấn luyện).

**Tiêu chí nghiệm thu**
- [ ] Không lưu gì nếu chưa đồng ý (có test)
- [ ] Rút lại đồng ý thì dữ liệu cũ bị xoá
- [ ] Có bộ lọc thông tin cá nhân với test các mẫu thường gặp
- [ ] Duyệt lại với người phụ trách quyết định D-5 trước khi bật cho người dùng

**Tệp liên quan:** `server/routes.js`, `server/db.js`, `web/js/app.js`, `ml/README.md`

### C5. Tinh chỉnh model nhỏ và so với bộ luật (5 điểm)

Phụ thuộc: C2, C4. Nhãn: ai, research.

**Bối cảnh.** Kịch bản huấn luyện đã viết nhưng chưa từng chạy vì chưa có GPU.

**Việc cần làm**
- Chọn model nền nhỏ có giấy phép dùng thương mại phù hợp và hỗ trợ tiếng Việt tốt.
- Chạy ml/train, chuyển GGUF, ép JSON bằng ngữ pháp GBNF.
- Đo trên gold, holdout và tập đo mù của C4; so với bộ luật.
- Đo thời gian trả lời và bộ nhớ trên điện thoại thấp nhất cần hỗ trợ.

**Tiêu chí nghiệm thu**
- [ ] Có báo cáo số đo cạnh bộ luật, nêu cả những chỗ model kém hơn
- [ ] JSON hợp lệ 100% nhờ ngữ pháp
- [ ] Chỉ đề xuất đưa vào app nếu đạt các tiêu chí trong ml/README.md

**Tệp liên quan:** `ml/train/lora_finetune.py`, `ml/engines/llamacpp.js`, `ml/README.md`

## Nhóm D: Giao diện và trải nghiệm

Màn hình, trợ năng, chia sẻ, đa ngôn ngữ. Tổng 19 điểm.

### D1. Chia sẻ danh sách đi chợ và việc với người thân (5 điểm)

Phụ thuộc: không. Nhãn: frontend, backend.

**Bối cảnh.** Việc đi chợ thường là của cả nhà. Hiện mỗi tài khoản là một ngăn riêng.

**Việc cần làm**
- Mô hình chia sẻ: người mời, người nhận, quyền xem hoặc sửa, thu hồi.
- Mời bằng liên kết hoặc email; chỉ chia sẻ từng việc hoặc danh sách, không chia sẻ cả tài khoản.
- Đồng bộ thay đổi hai chiều, xử lý xung đột theo mục.
- Quyết định D-1 (kiến trúc riêng tư) phải được chốt trước khi bắt đầu.

**Tiêu chí nghiệm thu**
- [ ] Hai tài khoản cùng tick một danh sách đi chợ và thấy thay đổi của nhau
- [ ] Thu hồi quyền thì người kia không còn thấy dữ liệu
- [ ] Có test máy chủ về quyền truy cập, không ai đọc được dữ liệu chưa được chia sẻ

**Tệp liên quan:** `server/routes.js`, `server/db.js`, `web/js/app.js`

### D2. Trợ năng: bàn phím và đọc màn hình (3 điểm)

Phụ thuộc: không. Nhãn: frontend, a11y.

**Bối cảnh.** Các hộp thoại và bộ chọn mới chưa được kiểm tra bằng bàn phím hay trình đọc màn hình.

**Việc cần làm**
- Bẫy tiêu điểm trong hộp thoại, trả tiêu điểm về nút đã mở, aria-modal chuẩn.
- Thứ tự Tab hợp lý cho bộ chọn giờ, nút chọn nhanh và danh sách đi chợ.
- Kiểm tra bằng VoiceOver hoặc NVDA, tương phản màu đạt mức AA.
- Thêm một số kiểm tra tự động vào e2e.

**Tiêu chí nghiệm thu**
- [ ] Dùng được toàn bộ luồng tạo việc và chia nước chỉ bằng bàn phím
- [ ] Trình đọc màn hình đọc được nhãn các nút + và −
- [ ] Có báo cáo kiểm tra và test tự động cho focus trap

**Tệp liên quan:** `web/js/app.js`, `web/css/app.css`, `web/index.html`

### D3. Tìm kiếm việc, thói quen và ghi chú (3 điểm)

Phụ thuộc: không. Nhãn: frontend.

**Bối cảnh.** Dữ liệu càng nhiều càng khó tìm lại một ghi chú hay một món đã nhớ.

**Việc cần làm**
- Ô tìm (phím Ctrl hoặc Cmd cộng K) tìm trong việc, thói quen, ghi chú ngày và nguyên liệu.
- Tìm không dấu vẫn ra kết quả có dấu.
- Kết quả mở thẳng khung chi tiết hoặc ngày trong Lịch.

**Tiêu chí nghiệm thu**
- [ ] Gõ "hop" tìm ra "Họp"
- [ ] Chọn kết quả mở đúng nơi
- [ ] Có test đầu-cuối

**Tệp liên quan:** `web/js/app.js`, `web/css/app.css`

### D4. Sửa kế hoạch uống nước và xem tiến độ 7 ngày (3 điểm)

Phụ thuộc: không. Nhãn: frontend.

**Bối cảnh.** Khung chi tiết thói quen mới chỉ đổi được lượng mỗi lần, chưa đổi được tổng lượng, số lần, khung giờ như lúc tạo.

**Việc cần làm**
- Dùng lại khối Chia lượng nước trong khung chi tiết thói quen.
- Biểu đồ cột 7 ngày gần nhất (ml đã uống) dựa trên nhật ký đã có.

**Tiêu chí nghiệm thu**
- [ ] Đổi kế hoạch thì lịch nhắc ngày hôm nay và các ngày sau cập nhật
- [ ] Biểu đồ đúng với dữ liệu nhật ký (có test)
- [ ] Không tràn ngang ở 320px

**Tệp liên quan:** `web/js/app.js`, `web/css/app.css`

### D5. Đa ngôn ngữ: tiếng Việt và tiếng Anh (5 điểm)

Phụ thuộc: không. Nhãn: frontend, i18n.

**Bối cảnh.** Mọi chữ hiện nằm cứng trong mã. Muốn có bản tiếng Anh phải tách ra.

**Việc cần làm**
- Tách chuỗi sang web/js/i18n.js (tiếng Việt, tiếng Anh).
- Lời nhắc, giọng nhắc và các câu gọi tên cũng theo ngôn ngữ.
- Prompt AI và bộ hiểu câu theo ngôn ngữ đã chọn (tiếng Anh dùng AI trước, bộ luật sau).
- Chọn ngôn ngữ trong Hồ sơ, mặc định theo trình duyệt.

**Tiêu chí nghiệm thu**
- [ ] Test tự động báo lỗi nếu còn chuỗi tiếng Việt cứng ngoài tệp ngôn ngữ
- [ ] Đổi ngôn ngữ không cần tải lại trang
- [ ] Ngày giờ định dạng theo ngôn ngữ

**Tệp liên quan:** `web/js/app.js`, `web/index.html`, `server/ai.js`

## Nhóm E: Nền tảng và chất lượng

Triển khai, CI, công cụ, bảo mật, giám sát. Tổng 19 điểm.

### E1. Triển khai thử lên máy chủ thật (5 điểm)

Phụ thuộc: không. Nhãn: ops.

**Bối cảnh.** Docker và compose đã viết nhưng chưa từng được build hoặc chạy trên máy chủ thật có HTTPS.

**Việc cần làm**
- Chạy docker build và compose, sửa lỗi nếu có (kèm package-lock.json).
- Chọn nhà cung cấp, bật HTTPS và tên miền, gắn ổ đĩa cho /data.
- Điền biến môi trường thật (ANTHROPIC_API_KEY, TRUST_PROXY=1, VAPID).
- Viết docs/DEPLOY.md từng bước và kiểm tra /api/health từ ngoài.

**Tiêu chí nghiệm thu**
- [ ] Có địa chỉ chạy được, đăng ký và tạo việc thành công
- [ ] Khởi động lại container không mất dữ liệu
- [ ] docs/DEPLOY.md đủ để người khác làm lại từ đầu

**Tệp liên quan:** `Dockerfile`, `docker-compose.yml`, `.env.example`, `README.md`

### E2. Làm CI chạy ổn định cả bài kiểm thử trình duyệt (3 điểm)

Phụ thuộc: không. Nhãn: ops, testing.

**Bối cảnh.** Công việc CI hiện chỉ chạy test máy chủ; job e2e đang để continue-on-error vì chưa được kiểm chứng trên GitHub.

**Việc cần làm**
- Làm cho npm run test:e2e, test:responsive và test:features chạy xanh trên GitHub Actions.
- Lưu cache trình duyệt, đính kèm ảnh chụp màn hình khi lỗi.
- Bỏ continue-on-error và đặt các job thành bắt buộc trong bảo vệ nhánh main.

**Tiêu chí nghiệm thu**
- [ ] Ba bộ test trình duyệt xanh trên 5 lần chạy liên tiếp
- [ ] Pull request không gộp được khi CI đỏ
- [ ] Thời gian CI hợp lý, ghi vào CONTRIBUTING.md

**Tệp liên quan:** `.github/workflows/ci.yml`, `package.json`

### E3. ESLint, Prettier và kiểm tra trước khi commit (2 điểm)

Phụ thuộc: không. Nhãn: tooling.

**Bối cảnh.** Chưa có công cụ thống nhất cách viết mã giữa 5 người.

**Việc cần làm**
- Thêm ESLint và Prettier với cấu hình tối thiểu hợp với mã hiện tại.
- npm run lint và npm run format, chạy trong CI.
- Hook commit chạy lint cho tệp đã đổi.

**Tiêu chí nghiệm thu**
- [ ] npm run lint xanh trên toàn bộ mã hiện có
- [ ] CI báo đỏ khi sai quy tắc
- [ ] Có hướng dẫn cài hook trong CONTRIBUTING.md

**Tệp liên quan:** `package.json`, `.editorconfig`

### E4. Tự lưu font và rà soát bảo mật (3 điểm)

Phụ thuộc: không. Nhãn: security, frontend.

**Bối cảnh.** Trang đang tải font từ Google Fonts (lộ địa chỉ IP người dùng cho bên thứ ba) và CSP phải mở cho bên đó.

**Việc cần làm**
- Tự lưu font Be Vietnam Pro trong web/fonts (kiểm tra giấy phép), bỏ liên kết Google Fonts.
- Thu hẹp CSP bỏ googleapis và gstatic, cập nhật service worker.
- Rà soát theo danh sách OWASP ASVS mức cơ bản và ghi báo cáo vào docs/SECURITY-REVIEW.md.

**Tiêu chí nghiệm thu**
- [ ] Không còn yêu cầu mạng nào tới bên thứ ba khi mở trang (kiểm bằng test)
- [ ] Giao diện hiển thị đúng tiếng Việt có dấu với font mới
- [ ] Báo cáo liệt kê phát hiện và mức độ ưu tiên

**Tệp liên quan:** `server/http.js`, `web/index.html`, `web/css/app.css`

### E5. Hợp nhất bản HTML đơn với bản web chính (3 điểm)

Phụ thuộc: không. Nhãn: tooling, frontend.

**Bối cảnh.** standalone/remi.html là ảnh chụp từ một nhánh mã riêng. Hai bản sẽ lệch dần nếu để vậy.

**Việc cần làm**
- Viết script tạo file HTML đơn từ web/ (nhúng CSS, JS, dữ liệu) thay cho chỉnh tay.
- Kiểm thử file sinh ra trong CI bằng bộ test trình duyệt.
- Xoá bản lệch và ghi cách tạo lại vào standalone/README.md.

**Tiêu chí nghiệm thu**
- [ ] npm run build:standalone tạo ra file chạy được khi mở trực tiếp
- [ ] CI kiểm tra file sinh ra
- [ ] Chỉ còn một nguồn mã duy nhất

**Tệp liên quan:** `standalone/remi.html`, `web/index.html`, `web/js/app.js`

### E6. Giám sát: nhật ký, sức khoẻ và cảnh báo lỗi (3 điểm)

Phụ thuộc: không. Nhãn: ops, backend.

**Bối cảnh.** Khi chạy thật cần biết thông báo có đang được gửi hay không.

**Việc cần làm**
- Nhật ký JSON có cấp độ và mã yêu cầu.
- /api/health trả thêm trạng thái cơ sở dữ liệu và độ trễ của bộ gửi lời nhắc.
- Đếm lời nhắc đã gửi, bỏ qua, lỗi; cảnh báo lỗi qua webhook hoặc Sentry.

**Tiêu chí nghiệm thu**
- [ ] Có test cho /api/health khi cơ sở dữ liệu lỗi
- [ ] Nhật ký không chứa mật khẩu, token hay nội dung câu nói
- [ ] Có tài liệu cách đọc số liệu

**Tệp liên quan:** `server/index.js`, `server/scheduler.js`, `server/routes.js`

