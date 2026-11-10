#!/usr/bin/env python3
"""DEMO: gõ một câu, mô hình cho biết Remi sẽ hiểu nó là gì.

    python demo.py                    chế độ gõ câu liên tục (thoát bằng :quit hoặc Ctrl+C)
    python demo.py --auto             tự chạy một loạt câu mẫu (tiện khi trình bày)
    python demo.py --text "câu"       chỉ phân loại một câu
    python demo.py --algo nb          dùng Naive Bayes thay cho hồi quy softmax
    python demo.py --json --text ".." in kết quả dạng JSON

Trong chế độ gõ câu có các lệnh: :help  :examples  :auto  :algo  :explain  :quit
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

try:
    import numpy  # noqa: F401
except ImportError:
    sys.exit("Thiếu thư viện numpy. Cài bằng:  pip install -r requirements.txt")

from remi_ai import IntentModel  # noqa: E402
from remi_ai.console import fix_stdio  # noqa: E402
from remi_ai.pipeline import ALGO_NAMES  # noqa: E402
from remi_ai.remi_actions import CONFIDENCE_THRESHOLD  # noqa: E402
from remi_ai.text import LABELS  # noqa: E402

MODEL_FILES = {"softmax": "softmax.json", "nb": "naive_bayes.json"}

# (câu, nhãn đúng hoặc None). Có cả ca khó và ca mô hình làm sai: trình bày trung thực tốt hơn chỉ chọn câu đẹp.
EXAMPLES = [
    ("uống nước 2 lít mỗi ngày", "nuoc"),
    ("lên lịch hẹn uống 1 lít nước chia làm 4 lần từ 1h-5h", "nuoc"),
    ("nhắc tôi uống 2 ly nước mỗi ngày", "nuoc"),
    ("uong nuoc 2 lit moi ngay", "nuoc"),
    ("mua nước mắm và hành tây", "di_cho"),
    ("mua nước hoa tặng mẹ nhân sinh nhật", "viec"),
    ("uống thuốc lúc 8h tối", "viec"),
    ("uống thuốc mỗi tối", "habit_khac"),
    ("đi bộ 30 phút mỗi sáng", "habit_khac"),
    ("mai 9h họp nhóm", "viec"),
    ("đi chợ nấu cà ri", "di_cho"),
    ("nhớ hydrate cho da nha", "nuoc"),   # mô hình sai, và sai với độ tin cậy cao
    ("xin chào bạn", None),               # không thuộc loại nào
]


class Style:
    def __init__(self, color):
        enc = (sys.stdout.encoding or "").lower()
        self.unicode = enc.startswith("utf")
        self.color = color and sys.stdout.isatty() and not os.environ.get("NO_COLOR")
        if self.color and os.name == "nt":
            os.system("")  # bật mã màu ANSI trên Windows 10 trở lên
        self.full, self.empty = ("█", "░") if self.unicode else ("#", ".")

    def c(self, text, code):
        return f"\033[{code}m{text}\033[0m" if self.color else text

    def bold(self, t): return self.c(t, "1")
    def green(self, t): return self.c(t, "32")
    def red(self, t): return self.c(t, "31")
    def yellow(self, t): return self.c(t, "33")
    def dim(self, t): return self.c(t, "2")
    def cyan(self, t): return self.c(t, "36")


def load_model(algo, quiet=False):
    path = os.path.join(HERE, "models", MODEL_FILES[algo])
    if not os.path.exists(path):
        if not quiet:
            print("Chưa có mô hình đã lưu, đang huấn luyện (vài giây)...")
        from remi_ai.data import load_tests, load_train, remove_overlap
        X, y = load_train(os.path.join(HERE, "data"))
        X, y, _ = remove_overlap(X, y, load_tests(os.path.join(HERE, "data")))
        params = {"softmax": {"l2": 1e-4, "lr": 0.1, "epochs": 200}, "nb": {"alpha": 0.1}}[algo]
        m = IntentModel(algo=algo, **params).fit(X, y)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        m.save(path)
        return m
    return IntentModel.load(path)


def show(r, st, explain=True, expected=None):
    p = r["probs"]
    conf = r["confidence"]
    print()
    print(st.bold(f'  Câu: "{r["text"]}"'))
    verdict = ""
    if expected:
        ok = r["label"] == expected
        verdict = "   " + (st.green(f"đúng (nhãn mong đợi: {expected})") if ok else st.red(f"SAI (nhãn mong đợi: {expected})"))
    colr = st.green if conf >= CONFIDENCE_THRESHOLD else st.yellow
    print(f"  Mô hình đoán:  {st.bold(colr(r['label']))}   độ tin cậy {colr(f'{conf * 100:.1f}%')}{verdict}")
    print("  Xác suất từng nhãn:")
    for l in sorted(LABELS, key=lambda l: -p[l]):
        n = int(round(p[l] * 28))
        bar = st.full * n + st.empty * (28 - n)
        mark = "  <== chọn" if l == r["label"] else ""
        print(f"    {l:<11} {bar} {p[l] * 100:5.1f}%{mark}")
    if explain:
        if r["known_features"] == 0:
            print(st.yellow("  Vì sao: mô hình KHÔNG nhận ra đặc trưng nào trong câu này, nên đây chỉ là đoán theo nhãn phổ biến."))
        else:
            feats = ", ".join(f"{n.replace('_', ' ')}" if not n.startswith("#") else f"«{n[1:].strip()}»" for n, _ in r["because"])
            print(f"  Vì sao: các đặc trưng đẩy về {r['label']} (so với {r['second']}), mạnh nhất trước: {feats}")
            print(st.dim(f"          (câu đã bỏ dấu khi xử lý; «..» là nhóm ký tự; mô hình nhận ra {r['known_features']} đặc trưng trong câu)"))
    a = r["action"]
    print(f"  Remi hiểu là:  {json.dumps(a['remi_intent'], ensure_ascii=False)}")
    print(f"  Remi sẽ làm:   {st.yellow(a['ket_luan']) if a['hoi_lai'] else a['ket_luan']}")


def run_examples(model, st, explain):
    right = known = 0
    for text, exp in EXAMPLES:
        r = model.predict_one(text)
        show(r, st, explain, exp)
        if exp:
            known += 1
            right += r["label"] == exp
    print(f"\n  Tóm tắt: đúng {right}/{known} câu có nhãn mong đợi. Mẫu nhỏ, chỉ để minh hoạ, không phải số đo chất lượng.")


HELP = """
  Gõ một câu tiếng Việt rồi Enter. Có dấu hay không dấu đều được.
  Lệnh:
    :examples       xem các câu mẫu (gõ số thứ tự để chạy câu đó)
    :auto           chạy tất cả câu mẫu
    :algo softmax   dùng hồi quy softmax        :algo nb   dùng Naive Bayes
    :explain        bật/tắt phần giải thích "vì sao"
    :quit           thoát (hoặc Ctrl+C)
"""


def repl(models, algo, st, explain):
    print(st.bold("\n  REMI: BỘ PHÂN LOẠI Ý ĐỊNH CÂU NÓI"))
    print(f"  Thuật toán: {ALGO_NAMES[algo]}   |   4 nhãn: {', '.join(LABELS)}")
    print(st.dim("  Gõ :help để xem lệnh, :quit để thoát."))
    while True:
        try:
            line = input(st.cyan("\nNhập câu > ")).strip()
        except (EOFError, KeyboardInterrupt):
            print("\n  Tạm biệt!")
            return
        if not line:
            continue
        low = line.lower()
        if low in (":quit", ":q", "quit", "exit", "thoat", "thoát"):
            print("  Tạm biệt!")
            return
        if low in (":help", ":h", "help", "?"):
            print(HELP)
        elif low == ":examples":
            for i, (t, e) in enumerate(EXAMPLES, 1):
                print(f"    {i:>2}. {t}" + (f"   [{e}]" if e else "   [không thuộc loại nào]"))
            print("  Gõ số để chạy câu đó.")
        elif low == ":auto":
            run_examples(models[algo], st, explain)
        elif low == ":explain":
            explain = not explain
            print(f"  Phần giải thích: {'bật' if explain else 'tắt'}")
        elif low.startswith(":algo"):
            arg = low.split()[1] if len(low.split()) > 1 else ""
            if arg in MODEL_FILES:
                algo = arg
                models.setdefault(algo, load_model(algo))
                print(f"  Đã chuyển sang: {ALGO_NAMES[algo]}")
            else:
                print("  Dùng :algo softmax hoặc :algo nb")
        elif low.isdigit() and 1 <= int(low) <= len(EXAMPLES):
            t, e = EXAMPLES[int(low) - 1]
            show(models[algo].predict_one(t), st, explain, e)
        elif low.startswith(":"):
            print("  Không hiểu lệnh. Gõ :help để xem.")
        else:
            show(models[algo].predict_one(line), st, explain)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--algo", choices=list(MODEL_FILES), default="softmax")
    ap.add_argument("--text", help="chỉ phân loại câu này rồi thoát")
    ap.add_argument("--auto", action="store_true", help="chạy các câu mẫu rồi thoát")
    ap.add_argument("--json", action="store_true", help="in kết quả dạng JSON (dùng với --text)")
    ap.add_argument("--no-explain", action="store_true")
    ap.add_argument("--no-color", action="store_true")
    a = ap.parse_args()
    fix_stdio()
    st = Style(not a.no_color)
    models = {a.algo: load_model(a.algo, quiet=a.json)}
    explain = not a.no_explain
    if a.text is not None:
        r = models[a.algo].predict_one(a.text)
        if a.json:
            print(json.dumps(r, ensure_ascii=False, indent=2))
        else:
            show(r, st, explain)
    elif a.auto:
        print(st.bold(f"\n  Chạy câu mẫu bằng {ALGO_NAMES[a.algo]}"))
        run_examples(models[a.algo], st, explain)
    else:
        repl(models, a.algo, st, explain)


if __name__ == "__main__":
    main()
