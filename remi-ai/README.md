# Remi AI: bộ phân loại ý định câu nói

Một mô hình AI **tự cài đặt bằng numpy** (không dùng scikit-learn) nhận một câu tiếng Việt và cho biết người dùng đang muốn gì, theo đúng cách ứng dụng Remi cần:

| Nhãn | Ví dụ | Remi sẽ làm gì |
|---|---|---|
| `nuoc` | "nhắc tôi uống 2 ly nước mỗi ngày" | Mở form **thói quen uống nước** |
| `habit_khac` | "đi bộ 30 phút mỗi sáng" | Mở form **thói quen** |
| `viec` | "mai 9h họp nhóm" | Mở form **việc có giờ** |
| `di_cho` | "đi chợ nấu cà ri", "mua nước mắm" | Mở form **việc đi chợ** kèm nguyên liệu |

Thư mục này **tự chứa mọi thứ**: dữ liệu, mã thuật toán, mô hình đã huấn luyện, demo, test. Không cần phần còn lại của repo để chạy.

## Chạy demo

Cần Python 3.10 trở lên và thư viện numpy:

```
pip install -r requirements.txt
```

Rồi **một trong hai cách**:

- **Bấm đúp** `run_demo.bat` (Windows) hoặc `run_demo.command` (Mac). Lần đầu Mac có thể chặn: bấm chuột phải vào file, chọn *Mở*, rồi xác nhận. Windows có thể hỏi xác nhận: chọn *More info* rồi *Run anyway*.
- **Terminal**, trong thư mục này:

```
python demo.py
```

(Mac dùng `python3`; Windows có thể dùng `py`.) Gõ một câu rồi Enter, ví dụ:

```
Nhập câu > nhắc tôi uống 2 ly nước mỗi ngày

  Câu: "nhắc tôi uống 2 ly nước mỗi ngày"
  Mô hình đoán:  nuoc   độ tin cậy 99.2%
  Xác suất từng nhãn:
    nuoc        ████████████████████████████  99.2%  <== chọn
    habit_khac  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0.7%
    viec        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0.0%
    di_cho      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0.0%
  Vì sao: các đặc trưng đẩy về nuoc (so với habit_khac), mạnh nhất trước: nuoc, ly, uong, ly nuoc, uong 0
  Remi hiểu là:  {"intent": "habit", "shopping": false}
  Remi sẽ làm:   Mở form THÓI QUEN UỐNG NƯỚC (chia lượng nước, chọn khung giờ nhắc)
```

Lệnh trong chế độ gõ câu: `:help`, `:examples` (xem câu mẫu, gõ số để chạy), `:auto` (chạy tất cả câu mẫu), `:algo nb` / `:algo softmax` (đổi thuật toán ngay giữa buổi), `:explain` (bật tắt phần "vì sao"), `:quit`.

Các cách chạy khác: `python demo.py --auto` (tự chạy câu mẫu), `python demo.py --text "câu" --json` (một câu, kết quả JSON).

### Gợi ý kịch bản trình bày (khoảng 5 phút)

1. **Bài toán** (30 giây): vì sao Remi cần biết câu nói là việc gì. Bảng bốn nhãn ở trên.
2. **Chạy `:auto`**: cho thấy phần lớn câu đúng, kể cả không dấu ("uong nuoc 2 lit moi ngay") và ca khó ("mua nước mắm" là đi chợ, "mua nước hoa" là việc, không phải uống nước).
3. **Câu bộ luật cũ làm sai**: "nhắc tôi uống 2 ly nước mỗi ngày". Bộ luật viết tay trong Remi chỉ đúng 71% trên 100 câu viết tay, mô hình đạt 97% (xem lưu ý bên dưới).
4. **Giải thích "vì sao"**: mô hình chỉ ra những từ đẩy nó về nhãn đã chọn.
5. **Trung thực về lỗi**: "nhớ hydrate cho da nha" mô hình đoán sai với độ tin cậy 95%; "xin chào bạn" bị xếp vào một nhãn vì mô hình **không có nhãn "khác"**. Nói rõ đây là hạn chế và hướng cải thiện.
6. **So hai thuật toán**: `:algo nb` rồi gõ lại câu đó.
7. **Cho xem `python train.py`**: đường mất mát giảm, ma trận nhầm lẫn, bảng ngưỡng tin cậy.

## Mô hình hoạt động thế nào

Bốn bước, mỗi bước một tệp ngắn trong `remi_ai/` (đọc được trong vài phút):

1. **Chuẩn hoá và rút đặc trưng** (`text.py`): chữ thường, bỏ dấu, số thành "0"; đặc trưng là từ đơn, cặp từ liền nhau, và nhóm 3 đến 4 ký tự trong từng từ.
2. **TF-IDF** (`tfidf.py`): mỗi câu thành một vector số. Đặc trưng hiếm có trọng số cao, đặc trưng có ở mọi câu có trọng số thấp.
3. **Thuật toán** (hai lựa chọn, cùng đầu vào):
   - `softmax.py`: **hồi quy softmax** học bằng giảm gradient (Adam). Mỗi nhãn có một vector trọng số; xác suất = softmax(X·W + b); tối thiểu hoá cross-entropy kèm điều chuẩn L2. Có công thức gradient ghi rõ trong tệp.
   - `naive_bayes.py`: **Naive Bayes** (định lý Bayes với giả định đặc trưng độc lập, làm mượt Laplace).
4. **Ngưỡng tin cậy** (`remi_actions.py`): nếu xác suất cao nhất dưới 60% thì Remi **hỏi lại người dùng** thay vì tự đoán.

`pipeline.py` ghép các bước và có hàm giải thích ("vì sao"), `metrics.py` tính precision, recall, F1, ma trận nhầm lẫn.

## Kết quả

Đo trên các tập kiểm tra có sẵn (xem `python train.py`). **Hãy đọc kỹ phần lưu ý bên dưới.**

| Tập kiểm tra | Số câu | Bộ luật hiện có của Remi | Naive Bayes | Hồi quy softmax |
|---|---|---|---|---|
| `test_hand` (viết tay) | 100 | 71,0% | 97,0% | 97,0% |
| `test_informal` (giọng đời thường) | 20 | 60,0% | 60,0% | 75,0% |
| `test_synth` (sinh từ khuôn) | 800 | không đo | 99,8% | 100% |

**Lưu ý:**

- Dữ liệu huấn luyện sinh từ khuôn câu, và hai tập viết tay do **cùng một người** viết (cùng phong cách với khuôn), nên 97% **cao hơn chất lượng thật**. Trên 20 câu giọng khác chỉ còn 75%, và 20 câu thì quá ít để tin chắc. `test_synth` sinh từ cùng khuôn nên 100% không có ý nghĩa đánh giá.
- Số đáng tin cậy sẽ là số đo trên **tập kiểm tra mù do người khác viết** (xem `python evaluate.py`).
- Cột "bộ luật" đo bằng `tools/rules_baseline.js` (cần cả repo Remi).

**Đối chiếu độ đúng của bản tự cài:** `python train.py --sklearn-check` (cần cài scikit-learn) cho thấy hồi quy softmax tự cài **đoán giống scikit-learn 100% số câu** trên cả ba tập, và `tests/` kiểm tra gradient bằng đạo hàm số.

## Cấu trúc thư mục

```
remi-ai/
├── README.md             tài liệu này
├── requirements.txt      numpy (và tuỳ chọn matplotlib, scikit-learn)
├── run_demo.bat          bấm đúp để chạy demo (Windows)
├── run_demo.command      bấm đúp để chạy demo (Mac)
├── demo.py               demo gõ câu trên terminal
├── train.py              huấn luyện, đánh giá, lưu mô hình
├── evaluate.py           đo mô hình đã lưu trên một tệp CSV bất kỳ (ví dụ tập mù)
├── remi_ai/              mã mô hình (text, tfidf, naive_bayes, softmax, metrics, pipeline, remi_actions, data)
├── data/                 train.csv, test_hand.csv, test_informal.csv, test_synth.csv, make_data.py
├── models/               mô hình đã huấn luyện (softmax.json, naive_bayes.json)
├── tests/                test của phần Python
├── fixtures/             dữ liệu để test JavaScript trong app khớp với Python
└── tools/                rules_baseline.js (đo bộ luật hiện có của Remi; cần cả repo)
```

## Các lệnh

| Việc | Lệnh |
|---|---|
| Chạy demo | `python demo.py` |
| Huấn luyện lại, in từng bước | `python train.py` |
| Thêm kiểm tra chéo, vẽ đồ thị, đối chiếu scikit-learn | `python train.py --cv --plot --sklearn-check` |
| Đo trên tập kiểm tra khác | `python evaluate.py --data đường/dẫn.csv` |
| Chạy test | `python -m unittest discover -s tests` |
| Sinh lại dữ liệu mẫu | `python data/make_data.py` (cảnh báo: ghi đè `train.csv` và `test_synth.csv`) |

Huấn luyện mất vài giây trên laptop và cho kết quả giống nhau mỗi lần chạy trên cùng máy.

## Dữ liệu

Hai cột `text,label`, nhãn là một trong bốn nhãn trên. `make_data.py` sinh 2400 câu huấn luyện từ khuôn câu (có không dấu, viết tắt, sai chính tả), `test_hand.csv` có 100 câu viết tay (25 mỗi nhãn), `test_informal.csv` có 20 câu giọng đời thường. Muốn thêm dữ liệu của riêng bạn, tạo `data/train_nhom.csv` (mọi `train*.csv` được gộp tự động). Quy tắc gán nhãn và cách làm tập kiểm tra mù ở `../docs/HUONG-DAN-MODEL.md`.

## Hạn chế

- Không có nhãn "không thuộc loại nào": câu như "xin chào bạn" vẫn bị xếp vào một nhãn.
- Mô hình tuyến tính không biết mình "không biết": có thể sai với độ tin cậy cao (ví dụ "nhớ hydrate cho da nha").
- Dữ liệu ít và đồng điệu, một người viết; chưa có dữ liệu người dùng thật.
- Chỉ nhận ra **ý định**; việc rút giờ, lượng nước, số lần là việc của bộ luật trong Remi.
- Chưa đo độ trễ trên điện thoại. Chưa thử nhiều phiên bản Python và numpy.

## Nối với app Remi

Khi chạy `train.py` trong repo Remi, mô hình được xuất sang `web/data/intent-model.json` và `web/js/intent-model.js` đọc nó ngay trong trình duyệt, không gửi câu nói đi đâu. Mô hình **chưa được nối vào giao diện**; các mức nối gợi ý ở `../docs/HUONG-DAN-MODEL.md`.
