# Remi: AI chạy trên máy

> **Làm bài cuối kỳ Intro to AI?** Mô hình phân loại ý định tự huấn luyện nằm ở thư mục riêng [`remi-ai/`](../remi-ai/README.md), hướng dẫn từng bước ở [docs/HUONG-DAN-MODEL.md](../docs/HUONG-DAN-MODEL.md).

Mục tiêu: **câu nói của người dùng không rời khỏi máy** nhưng Remi vẫn hiểu được "mai 9h30 họp, nhắc trước 30 phút".
Thư mục này chứa nền tảng để làm điều đó: bộ hiểu câu chạy ngay, dữ liệu huấn luyện, bộ đo chất lượng và kịch bản tinh chỉnh model nhỏ.

## Hiện trạng

| Phần | Trạng thái |
|---|---|
| Bộ hiểu câu theo luật `web/js/local-parse.js` (chạy trên máy, không gọi mạng) | Có, đã đo, **chưa nối vào giao diện** |
| Kho món ăn `web/data/dishes.json` (15 món, 86 nguyên liệu, mẫu để mở rộng) | Có |
| Bộ sinh dữ liệu huấn luyện `ml/gen/generate.js` | Có, đã test |
| Bộ đo chất lượng `ml/eval/run.js` + 75 câu viết tay | Có, đã test |
| Kịch bản tinh chỉnh `ml/train/lora_finetune.py` | **Chưa chạy thử** (không có GPU) |
| Model tự huấn luyện | **Chưa có** |
| Chạy model trên điện thoại | **Chưa làm** |

## Số đo hiện tại (bộ luật, `npm run ml:eval`)

| Tập | Số mẫu | Đúng hoàn toàn |
|---|---|---|
| `gold.jsonl` (viết tay) | 45 | 100% (đã dùng để sửa luật, **không còn công bằng**) |
| `holdout.jsonl` (viết tay, chưa nhìn khi viết luật) | 30 | 90% ở lần đo đầu (27/30); sau khi sửa 3 lỗi lộ ra thì 100% (**cũng không còn công bằng**) |
| Dữ liệu sinh, seed chưa từng dùng | 4000 | ~99,6% |

Ba lỗi lộ ra ở lần đo đầu của `holdout` là thật: chưa hiểu "sau 20 phút", "2 tiếng nữa", và "mỗi tối 8h" bị đọc thành 8 giờ sáng.

**Đừng tin các con số này là chất lượng ngoài đời.** Tất cả tập đều do mình viết, theo cách mình nghĩ người ta nói. Số thật chỉ có khi đo trên câu của người dùng thật (có đồng ý). Lỗi đã biết còn lại: "dọn nhà" gõ không dấu bị cắt thành "dọn" (bộ luật không phân biệt "nhà" với "nha"), model học theo ngữ cảnh sẽ làm tốt hơn chỗ này.

## Kiến trúc đề xuất: lai

1. **Bộ luật** xử lý trước: nhanh, đoán được, không bịa giờ giấc.
2. **Kho món ăn** trả nguyên liệu và định lượng theo số người (không để model sinh ra kiến thức nấu ăn dễ sai).
3. **Model nhỏ** chỉ gọi khi bộ luật không chắc (câu lạ, tiếng lóng, không dấu). Bộ luật hiện chưa báo "không chắc"; đây là việc nên làm tiếp.
4. Ép đầu ra hợp lệ bằng ngữ pháp (llama.cpp hỗ trợ GBNF), để model **không thể** sinh JSON hỏng.

## Quy tắc gán nhãn

Mọi nhãn trong `generate.js`, `gold.jsonl`, `holdout.jsonl` theo cùng quy tắc, và bộ luật cũng vậy:

- **Giờ có từ chỉ buổi**: sáng giữ nguyên; chiều, tối cộng 12 nếu nhỏ hơn 12; trưa 1 đến 4h là 13 đến 16h; "tối nay 7h" là 19:00.
- **Giờ trần** ("7h"): từ 13h trở lên giữ nguyên; 12h là trưa; 6 đến 11h là sáng; 1 đến 5h là chiều. **Việc đi chợ hoặc nấu ăn**: 4 đến 9h là chiều tối.
- **Ngày**: không nói ngày thì hôm nay nếu giờ chưa qua, nếu qua rồi thì ngày mai. "Thứ X" là lần xuất hiện kế tiếp **sau hôm nay** (nói "thứ 4" vào thứ tư nghĩa là tuần sau). "Thứ X tuần sau" là thứ X của tuần bắt đầu từ thứ hai kế tiếp. "Ngày 20" là tháng này nếu chưa qua, không thì tháng sau; "ngày 5/1" nếu đã qua trong năm thì là năm sau. Không nói giờ: 09:00.
- **Nhắc trước**: chỉ khi người dùng nói rõ; riêng việc đi chợ mặc định 60 phút.
- **Lặp lại**: chỉ khi nói "mỗi ngày", "hằng tuần", "mỗi thứ 6"...; thói quen không nói lặp lại thì chỉ hôm nay.
- **Thói quen**: "mỗi sáng" 07:00, "mỗi trưa" 12:00, "mỗi chiều" 17:00, "mỗi tối" 21:00; nước thì chia theo lượng: 250 ml một lần.

## Dữ liệu

1. **Dữ liệu sinh** (`npm run ml:data`): mẫu câu do mình viết, nhãn đúng theo cấu tạo (biết ngày giờ trước rồi mới viết câu). Dùng để dạy khung, không dùng để đo.
2. **Tập đo viết tay** (`gold`, `holdout`): nên viết thêm, và mỗi lần chỉnh luật nên làm một tập mới chưa nhìn.
3. **Dữ liệu thật**: cặp "câu gõ, bản người dùng đã sửa" là nguồn quý nhất. Chỉ thu khi người dùng **đồng ý rõ ràng**, bỏ thông tin cá nhân (tên, địa chỉ, số điện thoại) trước khi lưu, và cho phép xoá.

**Điều khoản**: không dùng đầu ra của AI khác để tạo dữ liệu huấn luyện nếu điều khoản của họ cấm huấn luyện model cạnh tranh. Bộ sinh ở đây chỉ dùng mẫu tự viết nên không dính vấn đề này. Giấy phép của model nền cũng cần đọc kỹ (nhiều model cho dùng thương mại nhưng kèm điều kiện).

## Quy trình huấn luyện

```bash
npm run ml:data                                   # sinh dữ liệu, tạo ml/data/train.jsonl
pip install torch transformers peft
python ml/train/lora_finetune.py --base <model-nen> --train ml/data/train.jsonl

# gộp LoRA vào model rồi chuyển sang GGUF (đường dẫn và tên lệnh có thể đổi theo phiên bản llama.cpp)
python llama.cpp/convert_hf_to_gguf.py ml/out/merged --outfile remi-f16.gguf
llama.cpp/build/bin/llama-quantize remi-f16.gguf remi-q4.gguf Q4_K_M

# đo model trên đúng các tập đã dùng cho bộ luật
llama-server -m remi-q4.gguf --port 8080
node ml/eval/run.js --engine llamacpp --data ml/data/gold.jsonl,ml/data/holdout.jsonl --min 0.95
```

**Tiêu chí để dùng model** (chưa đạt thì không đưa vào app):
1. JSON hợp lệ 100% (có ép ngữ pháp).
2. Vượt bộ luật trên `gold`, `holdout` **và** tập dữ liệu thật.
3. Không sai giờ nhiều hơn bộ luật. Sai giờ là lỗi nặng nhất vì người dùng lỡ việc.
4. Đủ nhanh trên điện thoại đời thấp nhất bạn muốn hỗ trợ (cần tự đo).

## Chạy trên điện thoại

| Đường | Ưu | Nhược |
|---|---|---|
| Bộ luật trong PWA (đã có) | Vài chục KB, tức thì, mọi trình duyệt | Chỉ hiểu cách nói đã có luật |
| Model nhỏ trong trình duyệt (WebGPU hoặc WASM) | Vẫn là web app | Tải model hàng trăm MB, phụ thuộc trình duyệt hỗ trợ, chưa thử |
| App native (Capacitor hoặc Flutter) + llama.cpp hoặc MediaPipe | Nhanh và ổn định nhất | Phải làm app native, cần đo bộ nhớ và pin |

## Ảnh hưởng tới phần còn lại của Remi

Bản full stack hiện tại gửi **câu nói** lên máy chủ rồi sang Anthropic, và gửi **việc, thói quen, lịch nhắc** lên máy chủ để đồng bộ và đẩy thông báo. Nếu yêu cầu là *mọi dữ liệu không rời máy* thì cần:

- Chuyển AI sang chạy trên máy (thư mục này).
- **Bỏ đồng bộ qua máy chủ**, hoặc chỉ giữ bản sao lưu **mã hoá đầu cuối** (máy chủ chỉ thấy dữ liệu đã khoá, không đọc được).
- Thay thông báo đẩy từ máy chủ bằng **thông báo cục bộ** hẹn ngay trên máy. Theo hiểu biết của mình, trình duyệt chưa có cách đáng tin để hẹn thông báo khi đã đóng app, nên bản này cần app native (cần kiểm tra lại).

Nếu yêu cầu chỉ là *câu nói không rời máy* thì giữ nguyên đồng bộ và chỉ thay phần AI.
