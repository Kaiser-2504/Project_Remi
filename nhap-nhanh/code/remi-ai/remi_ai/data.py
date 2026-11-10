"""Đọc dữ liệu CSV (hai cột: text, label) và kiểm tra."""
import csv
import glob
import os
import sys

from .text import LABELS


def load_csv(path):
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    bad = sorted({r["label"] for r in rows if r["label"] not in LABELS})
    if bad:
        sys.exit(f"{path}: nhãn lạ {bad}; chỉ được dùng {LABELS}")
    empty = [i for i, r in enumerate(rows, 2) if not r["text"].strip()]
    if empty:
        sys.exit(f"{path}: câu trống ở dòng {empty[:5]}")
    return [r["text"] for r in rows], [r["label"] for r in rows]


def load_train(data_dir):
    """Gộp mọi tệp train*.csv (nhóm có thể thêm train_nhom.csv mà không bị make_data.py ghi đè)."""
    X, y = [], []
    for p in sorted(glob.glob(os.path.join(data_dir, "train*.csv"))):
        xs, ys = load_csv(p)
        print(f"  đọc {os.path.basename(p)}: {len(xs)} câu")
        X += xs
        y += ys
    if not X:
        sys.exit(f"Không thấy train*.csv trong {data_dir}. Chạy: python data/make_data.py")
    return X, y


def load_tests(data_dir):
    """Mỗi tệp test_*.csv là một tập kiểm tra riêng."""
    return {os.path.basename(p)[:-4]: load_csv(p) for p in sorted(glob.glob(os.path.join(data_dir, "test_*.csv")))}


def remove_overlap(X, y, tests):
    """Chống rò rỉ dữ liệu: câu nào đã nằm trong tập kiểm tra thì bỏ khỏi tập huấn luyện."""
    seen = {t.lower() for xs, _ in tests.values() for t in xs}
    keep = [i for i, t in enumerate(X) if t.lower() not in seen]
    return [X[i] for i in keep], [y[i] for i in keep], len(X) - len(keep)
