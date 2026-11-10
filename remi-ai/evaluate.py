#!/usr/bin/env python3
"""Đo mô hình đã lưu trên MỘT tệp CSV bất kỳ (ví dụ tập kiểm tra mù của nhóm).

    python evaluate.py --data data/test_hand.csv
    python evaluate.py --data blind/blind.csv --algo nb

Tệp CSV có hai cột: text,label (label là một trong di_cho, habit_khac, nuoc, viec).
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from remi_ai import metrics  # noqa: E402
from remi_ai.console import fix_stdio  # noqa: E402
from remi_ai.data import load_csv  # noqa: E402
from remi_ai.pipeline import ALGO_NAMES, IntentModel  # noqa: E402
from remi_ai.text import LABELS  # noqa: E402

FILES = {"softmax": "softmax.json", "nb": "naive_bayes.json"}


def main():
    fix_stdio()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True)
    ap.add_argument("--algo", choices=list(FILES), default="softmax")
    a = ap.parse_args()
    path = os.path.join(HERE, "models", FILES[a.algo])
    if not os.path.exists(path):
        sys.exit("Chưa có mô hình. Chạy: python train.py")
    model = IntentModel.load(path)
    X, y = load_csv(a.data)
    P = model.predict_proba(X)
    yy = [LABELS.index(l) for l in y]
    pred = P.argmax(axis=1)
    cm = metrics.confusion_matrix(yy, pred, len(LABELS))
    print(f"\n{ALGO_NAMES[a.algo]} trên {a.data} ({len(X)} câu)\n")
    print(metrics.report(cm, LABELS))
    print("\n  Ma trận nhầm lẫn (hàng: nhãn thật, cột: đoán):")
    print(metrics.confusion_text(cm, LABELS))
    wrong = [(t, l, LABELS[p], float(P[i].max())) for i, (t, l, p) in enumerate(zip(X, y, pred)) if LABELS[p] != l]
    print(f"\n  {len(wrong)} câu sai:")
    for t, l, p, c in wrong:
        print(f"    - \"{t}\"  đúng: {l}, đoán: {p} (tin cậy {c:.2f})")


if __name__ == "__main__":
    main()
