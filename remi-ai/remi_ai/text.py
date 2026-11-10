"""Bước 1 của mô hình: chuẩn hoá câu và rút đặc trưng.

QUAN TRỌNG: phải giống hệt hàm featurize trong web/js/intent-model.js (phần chạy trong app Remi).
Nếu sửa ở đây thì sửa cả bên đó, rồi huấn luyện lại; `npm test` sẽ báo nếu hai bên lệch.
"""
import re
import unicodedata

# Bốn nhãn, theo thứ tự chữ cái (chỉ số của nhãn trong mọi mảng đều theo thứ tự này)
LABELS = ["di_cho", "habit_khac", "nuoc", "viec"]


def fold(text: str) -> str:
    """Chữ thường, bỏ dấu tiếng Việt, "đ" thành "d", mọi chuỗi số thành "0", ký tự lạ thành khoảng trắng.

    Ví dụ: "Uống nước 2,5 lít!" -> "uong nuoc 0 0 lit"
    Nhờ vậy "uống", "UỐNG", "uong" là một, và "2 lít" với "1,5 lít" cùng dạng "0 lit".
    """
    t = text.lower().replace("đ", "d")
    t = "".join(c for c in unicodedata.normalize("NFD", t) if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9]+", " ", t)
    t = re.sub(r"[0-9]+", "0", t)
    return re.sub(r" +", " ", t).strip()


def analyze(text: str):
    """Danh sách đặc trưng của một câu. Ba loại:

    1. từ đơn:               "uong", "nuoc"
    2. cặp từ liền nhau:     "uong_nuoc"
    3. nhóm 3-4 ký tự trong từng từ (bọc dấu cách hai đầu): "#uon", "#ong", ...
       Loại này giúp chịu được lỗi gõ sai và từ lạ có phần gốc quen.
    """
    f = fold(text)
    words = f.split(" ") if f else []
    feats = list(words)
    feats += [a + "_" + b for a, b in zip(words, words[1:])]
    for w in words:
        p = " " + w + " "
        for n in (3, 4):
            feats += ["#" + p[i:i + n] for i in range(len(p) - n + 1)]
    return feats
