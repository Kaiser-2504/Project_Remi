#!/usr/bin/env python3
"""Huấn luyện, đánh giá và lưu bộ phân loại ý định câu nói của Remi.

    python train.py                 chạy toàn bộ (vài giây)
    python train.py --cv            thêm kiểm tra chéo 5 phần để so sánh hai thuật toán
    python train.py --plot          vẽ đường mất mát và ma trận nhầm lẫn (cần matplotlib)
    python train.py --sklearn-check đối chiếu với scikit-learn (cần scikit-learn)
    python train.py --blind FILE    đo thêm trên tập kiểm tra mù của nhóm (chỉ dùng một lần ở bước cuối)

Mô hình được lưu ở models/. Nếu thư mục này nằm trong repo Remi, mô hình cũng được xuất cho app (web/data/intent-model.json).
"""
import argparse
import hashlib
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from remi_ai import metrics  # noqa: E402
from remi_ai.console import fix_stdio  # noqa: E402
from remi_ai.data import load_csv, load_tests, load_train, remove_overlap  # noqa: E402
from remi_ai.pipeline import ALGO_NAMES, IntentModel  # noqa: E402
from remi_ai.text import LABELS, fold  # noqa: E402

DEFAULTS = {"softmax": {"l2": 1e-4, "lr": 0.1, "epochs": 200}, "nb": {"alpha": 0.1}}


def head(title):
    print(f"\n{'=' * 8} {title} {'=' * max(3, 66 - len(title))}")


def stratified_folds(y, k, seed=0):
    rng = np.random.default_rng(seed)
    folds = [[] for _ in range(k)]
    for c in sorted(set(y)):
        idx = [i for i, v in enumerate(y) if v == c]
        rng.shuffle(idx)
        for j, i in enumerate(idx):
            folds[j % k].append(i)
    return folds


def cross_validate(algo, X, y, k=5):
    folds = stratified_folds(y, k)
    scores = []
    for f in range(k):
        test = set(folds[f])
        tr = [i for i in range(len(X)) if i not in test]
        m = IntentModel(algo=algo, **DEFAULTS[algo]).fit([X[i] for i in tr], [y[i] for i in tr])
        pred = m.predict_proba([X[i] for i in sorted(test)]).argmax(axis=1)
        true = [LABELS.index(y[i]) for i in sorted(test)]
        scores.append(metrics.macro_f1(metrics.confusion_matrix(true, pred, len(LABELS))))
    return float(np.mean(scores)), float(np.std(scores))


def main():
    fix_stdio()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=os.path.join(HERE, "data"))
    ap.add_argument("--out", default=os.path.join(HERE, "models"))
    ap.add_argument("--epochs", type=int, help="số vòng học của hồi quy softmax (mặc định 200)")
    ap.add_argument("--l2", type=float, help="độ mạnh điều chuẩn L2 (mặc định 1e-4)")
    ap.add_argument("--lr", type=float, help="tốc độ học (mặc định 0.1)")
    ap.add_argument("--cv", action="store_true")
    ap.add_argument("--plot", action="store_true")
    ap.add_argument("--sklearn-check", action="store_true")
    ap.add_argument("--blind", help="tập kiểm tra mù (chỉ chạy một lần, đừng chỉnh mô hình theo kết quả này)")
    ap.add_argument("--no-export", action="store_true", help="không xuất mô hình cho app Remi")
    a = ap.parse_args()
    for k, v in (("epochs", a.epochs), ("l2", a.l2), ("lr", a.lr)):
        if v is not None:
            DEFAULTS["softmax"][k] = v

    # ---------------------------------------------------------------- 1
    head("BƯỚC 1: Đọc dữ liệu")
    X, y = load_train(a.data)
    tests = load_tests(a.data)
    if a.blind:
        tests["blind"] = load_csv(a.blind)
    X, y, removed = remove_overlap(X, y, tests)
    if removed:
        print(f"  Bỏ {removed} câu khỏi tập huấn luyện vì trùng với tập kiểm tra (chống rò rỉ dữ liệu).")
    print(f"  Tập huấn luyện: {len(X)} câu, theo nhãn: " + ", ".join(f"{l}={y.count(l)}" for l in LABELS))
    for n, (xs, _) in tests.items():
        print(f"  Tập kiểm tra {n}: {len(xs)} câu")

    # ---------------------------------------------------------------- 2
    head("BƯỚC 2: Biến câu thành số (TF-IDF)")
    probe = IntentModel(algo="nb").fit(X, y)
    print(f"  Từ điển có {len(probe.vec.vocab)} đặc trưng (từ, cặp từ, nhóm ký tự); đã bỏ đặc trưng xuất hiện ở dưới {probe.vec.min_df} câu, giữ tối đa {probe.vec.max_features}")
    sample = "Uống nước 2 lít mỗi ngày"
    idx, vals = probe.vec.transform_one(sample)
    top = sorted(zip(idx, vals), key=lambda t: -t[1])[:6]
    print(f'  Ví dụ câu: "{sample}"')
    print(f"    sau chuẩn hoá: \"{fold(sample)}\"")
    print(f"    có {len(idx)} đặc trưng khác 0; 6 đặc trưng giá trị cao nhất: " + ", ".join(f"{probe.vec.feature_name(i)}={v:.2f}" for i, v in top))

    # ---------------------------------------------------------------- 3
    head("BƯỚC 3: Huấn luyện hai thuật toán")
    models = {}
    for algo in ("nb", "softmax"):
        print(f"  {ALGO_NAMES[algo]}   tham số: {DEFAULTS[algo]}")
        models[algo] = IntentModel(algo=algo, **DEFAULTS[algo]).fit(X, y, verbose=40 if algo == "softmax" else 0)
        if algo == "nb":
            print("    (Naive Bayes chỉ đếm, không có vòng lặp học)")
    if a.cv:
        print("\n  Kiểm tra chéo 5 phần trên tập huấn luyện (macro-F1, trung bình ± độ lệch):")
        for algo in ("nb", "softmax"):
            m, s = cross_validate(algo, X, y)
            print(f"    {ALGO_NAMES[algo]:<46} {m:.3f} ± {s:.3f}")
        print("    Lưu ý: dữ liệu mẫu sinh từ khuôn câu nên số này cao ảo; số đáng tin là trên tập viết tay độc lập.")

    # ---------------------------------------------------------------- 4
    head("BƯỚC 4: Đánh giá trên các tập kiểm tra")
    print(f"  {'tập kiểm tra':<16}{'số câu':>8}  {'Naive Bayes':>22}  {'Softmax':>22}")
    print(f"  {'':<16}{'':>8}  {'chính xác / macro-F1':>22}  {'chính xác / macro-F1':>22}")
    results = {}
    for n, (xs, ys) in tests.items():
        yy = [LABELS.index(l) for l in ys]
        row = f"  {n:<16}{len(xs):>8}  "
        for algo in ("nb", "softmax"):
            pr = models[algo].predict_proba(xs)
            cm = metrics.confusion_matrix(yy, pr.argmax(axis=1), len(LABELS))
            results[(n, algo)] = (cm, pr)
            row += f"{metrics.accuracy(cm):>12.3f} /{metrics.macro_f1(cm):>7.3f}   "
        print(row)
    main_set = "test_hand" if "test_hand" in tests else next(iter(tests))
    print(f"\n  Chi tiết hồi quy softmax trên {main_set}:")
    cm, pr = results[(main_set, "softmax")]
    print(metrics.report(cm, LABELS))
    print("\n  Ma trận nhầm lẫn (hàng: nhãn thật, cột: nhãn mô hình đoán):")
    print(metrics.confusion_text(cm, LABELS))
    os.makedirs(os.path.join(HERE, "reports"), exist_ok=True)
    for n, (xs, ys) in tests.items():
        pr = results[(n, "softmax")][1]
        errs = [(t, l, LABELS[int(p.argmax())], float(p.max())) for t, l, p in zip(xs, ys, pr) if LABELS[int(p.argmax())] != l]
        with open(os.path.join(HERE, "reports", f"loi_{n}.csv"), "w", encoding="utf-8", newline="") as f:
            import csv
            w = csv.writer(f)
            w.writerow(["text", "nhan_dung", "mo_hinh_doan", "do_tin_cay"])
            w.writerows(errs)
        if n == main_set or n == "test_informal":
            print(f"\n  Các câu softmax đoán sai trên {n}: {len(errs)}/{len(xs)}  (đủ danh sách ở reports/loi_{n}.csv)")
            for t, l, p, c in errs[:6]:
                print(f"    - \"{t}\"  đúng: {l}, đoán: {p} (tin cậy {c:.2f})")

    # ---------------------------------------------------------------- 5
    head("BƯỚC 5: Khi nào nên tin dự đoán? (ngưỡng độ tin cậy)")
    xs, ys = tests[main_set]
    yy = [LABELS.index(l) for l in ys]
    print(f"  Trên {main_set}, nếu chỉ tin dự đoán khi độ tin cậy từ ngưỡng trở lên (còn lại Remi hỏi lại người dùng):")
    print(f"    {'ngưỡng':>8}{'tin được':>12}{'đúng trong số đó':>20}")
    for th, cover, acc in metrics.selective_table(yy, results[(main_set, 'softmax')][1]):
        print(f"    {th:>8.1f}{cover * 100:>11.0f}%{acc * 100:>19.1f}%")

    # ---------------------------------------------------------------- 6
    head("BƯỚC 6: Lưu mô hình")
    os.makedirs(a.out, exist_ok=True)
    models["softmax"].save(os.path.join(a.out, "softmax.json"))
    models["nb"].save(os.path.join(a.out, "naive_bayes.json"))
    print(f"  Đã lưu {a.out}/softmax.json và naive_bayes.json (demo.py đọc các tệp này)")
    app_dir = os.path.join(HERE, "..", "web", "data")
    if not a.no_export and os.path.isdir(app_dir):
        out = os.path.join(app_dir, "intent-model.json")
        models["softmax"].export_for_app(out)
        with open(out, "rb") as f:
            digest = hashlib.sha256(f.read().replace(b"\r\n", b"\n")).hexdigest()
        probe_texts = list(tests.get("test_hand", ([], []))[0][:40]) + ["", "...", "constructor __proto__ toString", "uống nước " * 40, "Đ Ư Ơ Ă 123 456"]
        P = models["softmax"].predict_proba(probe_texts)
        fx = [{"text": t, "probs": [round(float(v), 9) for v in row]} for t, row in zip(probe_texts, P)]
        os.makedirs(os.path.join(HERE, "fixtures"), exist_ok=True)
        with open(os.path.join(HERE, "fixtures", "parity.json"), "w", encoding="utf-8") as f:
            json.dump({"labels": LABELS, "model_sha256": digest, "cases": fx}, f, ensure_ascii=False, indent=1)
        print(f"  Đã xuất cho app Remi: {os.path.relpath(out)} ({os.path.getsize(out) // 1024} KB) và fixtures/parity.json")
    elif not a.no_export:
        print("  (Không thấy thư mục web/ cạnh đây nên bỏ qua bước xuất cho app Remi.)")

    # ---------------------------------------------------------------- tuỳ chọn
    if a.sklearn_check:
        head("ĐỐI CHIẾU VỚI SCIKIT-LEARN")
        try:
            from sklearn.linear_model import LogisticRegression
        except ImportError:
            print("  Chưa cài scikit-learn (pip install scikit-learn) nên bỏ qua.")
        else:
            m = models["softmax"]
            Xtr = m.vec.transform(X)
            ytr = [LABELS.index(l) for l in y]
            C = 1.0 / (DEFAULTS["softmax"]["l2"] * len(X))
            sk = LogisticRegression(C=C, max_iter=3000).fit(Xtr, ytr)
            print(f"  Cùng đặc trưng TF-IDF, cùng độ mạnh điều chuẩn (C = {C:.1f}):")
            for n, (xs, ys) in tests.items():
                Xt = m.vec.transform(xs)
                mine = m.predict_proba(xs).argmax(axis=1)
                theirs = sk.predict(Xt)
                yy = np.array([LABELS.index(l) for l in ys])
                print(f"    {n:<14} tự cài {np.mean(mine == yy):.3f}   scikit-learn {np.mean(theirs == yy):.3f}   hai bên đoán giống nhau {np.mean(mine == theirs) * 100:.1f}% số câu")

    if a.plot:
        head("VẼ ĐỒ THỊ")
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
        except ImportError:
            print("  Chưa cài matplotlib (pip install matplotlib) nên bỏ qua.")
        else:
            h = models["softmax"].clf.history
            fig, ax = plt.subplots(1, 2, figsize=(11, 4))
            ax[0].plot([t for t, _, _ in h], [l for _, l, _ in h])
            ax[0].set(title="Mất mát giảm dần khi học", xlabel="vòng học", ylabel="cross-entropy")
            cm = results[(main_set, "softmax")][0]
            ax[1].imshow(cm, cmap="Blues")
            ax[1].set(title=f"Ma trận nhầm lẫn ({main_set})", xticks=range(4), yticks=range(4), xticklabels=LABELS, yticklabels=LABELS, xlabel="mô hình đoán", ylabel="nhãn thật")
            for i in range(4):
                for j in range(4):
                    ax[1].text(j, i, cm[i, j], ha="center", va="center", color="white" if cm[i, j] > cm.max() / 2 else "black")
            fig.tight_layout()
            p = os.path.join(HERE, "reports", "do_thi.png")
            fig.savefig(p, dpi=130)
            print(f"  Đã vẽ {os.path.relpath(p)}")
    print("\nXong. Chạy `python demo.py` để thử gõ câu vào mô hình.")


if __name__ == "__main__":
    main()
