"""Bộ phân loại ý định câu nói của Remi, tự cài đặt bằng numpy (không dùng scikit-learn).

Các thành phần, theo thứ tự dữ liệu đi qua:
  text.py         chuẩn hoá câu (bỏ dấu, ...) và rút đặc trưng
  tfidf.py        biến câu thành vector số (TF-IDF)
  naive_bayes.py  thuật toán 1: Naive Bayes
  softmax.py      thuật toán 2: hồi quy softmax, học bằng giảm gradient (Adam)
  metrics.py      độ chính xác, precision, recall, F1, ma trận nhầm lẫn
  pipeline.py     ghép các bước thành một mô hình: huấn luyện, dự đoán, giải thích, lưu/đọc
  remi_actions.py nhãn nào thì Remi làm gì
"""
from .text import LABELS, fold, analyze  # noqa: F401
from .pipeline import IntentModel  # noqa: F401
