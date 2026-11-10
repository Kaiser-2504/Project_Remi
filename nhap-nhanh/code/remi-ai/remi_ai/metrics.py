"""Các số đo chất lượng, tự cài (không dùng scikit-learn)."""
import numpy as np


def confusion_matrix(y_true, y_pred, k):
    """cm[i][j] = số câu có nhãn thật là i mà bị đoán thành j."""
    cm = np.zeros((k, k), dtype=int)
    for t, p in zip(y_true, y_pred):
        cm[t, p] += 1
    return cm


def per_class(cm):
    """Precision, recall, F1 cho từng nhãn.

    precision = đoán là nhãn này thì đúng bao nhiêu     = TP / (TP + FP)
    recall    = nhãn này thật thì tìm ra bao nhiêu       = TP / (TP + FN)
    F1        = trung bình điều hoà của hai số trên      = 2PR / (P + R)
    """
    k = cm.shape[0]
    out = []
    for i in range(k):
        tp = cm[i, i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        p = tp / (tp + fp) if tp + fp else 0.0
        r = tp / (tp + fn) if tp + fn else 0.0
        f = 2 * p * r / (p + r) if p + r else 0.0
        out.append((p, r, f, int(cm[i, :].sum())))
    return out


def accuracy(cm):
    return float(np.trace(cm) / cm.sum()) if cm.sum() else 0.0


def macro_f1(cm):
    return float(np.mean([f for _, _, f, _ in per_class(cm)]))


def report(cm, labels):
    lines = [f"    {'nhãn':<12}{'precision':>10}{'recall':>9}{'F1':>8}{'số câu':>9}"]
    for l, (p, r, f, n) in zip(labels, per_class(cm)):
        lines.append(f"    {l:<12}{p:>10.3f}{r:>9.3f}{f:>8.3f}{n:>9}")
    lines.append(f"    {'độ chính xác':<12}{accuracy(cm):>27.3f}")
    lines.append(f"    {'macro-F1':<12}{macro_f1(cm):>27.3f}")
    return "\n".join(lines)


def confusion_text(cm, labels):
    w = max(len(l) for l in labels) + 2
    lines = ["    đúng \\ đoán " + "".join(l.rjust(w) for l in labels)]
    for l, row in zip(labels, cm):
        lines.append("    " + l.ljust(12) + "".join(str(v).rjust(w) for v in row))
    return "\n".join(lines)


def selective_table(y_true, probs, thresholds=(0.0, 0.5, 0.6, 0.7, 0.8, 0.9)):
    """Nếu chỉ tin dự đoán khi độ tin cậy >= ngưỡng thì: tin được bao nhiêu câu, và trong số đó đúng bao nhiêu?
    Đây là cách Remi quyết định khi nào "hỏi lại người dùng" thay vì đoán."""
    y_true = np.asarray(y_true)
    conf = probs.max(axis=1)
    pred = probs.argmax(axis=1)
    rows = []
    for th in thresholds:
        m = conf >= th
        n = int(m.sum())
        acc = float((pred[m] == y_true[m]).mean()) if n else float("nan")
        rows.append((th, n / len(y_true), acc))
    return rows
