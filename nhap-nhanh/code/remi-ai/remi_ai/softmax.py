"""Thuật toán 2: hồi quy softmax (hồi quy logistic nhiều nhãn), học bằng giảm gradient (tự cài).

Mô hình: mỗi nhãn k có một vector trọng số W[:, k] và một hằng số b[k].
    điểm   z = X @ W + b                         (một điểm cho mỗi nhãn)
    xác suất p = softmax(z) = exp(z_k) / tổng exp(z)   (cộng lại bằng 1)
Học: tìm W, b làm giảm "mất mát" cross-entropy (phạt nặng khi gán xác suất thấp cho nhãn đúng):
    L = - trung bình over câu của  ln p[nhãn đúng]  +  (lambda / 2) * ||W||^2
Số hạng cuối là điều chuẩn hoá L2: giữ trọng số nhỏ để mô hình không học thuộc lòng dữ liệu.
Gradient (đạo hàm của L) có dạng rất gọn:
    dL/dW = X^T @ (p - Y) / n + lambda * W        dL/db = trung bình của (p - Y)
với Y là nhãn đúng dạng one-hot. Mỗi vòng ta đi ngược hướng gradient một chút (bước Adam).
Công thức gradient được kiểm tra bằng đạo hàm số trong tests/test_models.py.
"""
import numpy as np

from .naive_bayes import softmax


class SoftmaxRegression:
    def __init__(self, n_classes: int, l2: float = 1e-4, lr: float = 0.1, epochs: int = 300, seed: int = 0):
        self.k = n_classes
        self.l2 = l2          # lambda: độ mạnh của điều chuẩn L2
        self.lr = lr          # tốc độ học
        self.epochs = epochs  # số vòng lặp qua toàn bộ dữ liệu
        self.seed = seed
        self.W = None
        self.b = None
        self.history = []     # (vòng, mất mát, độ chính xác trên tập huấn luyện)

    # --- hàm mất mát và gradient: tách riêng để kiểm tra bằng đạo hàm số ---
    def loss_and_grad(self, X, Y, W, b):
        n = X.shape[0]
        P = softmax(X @ W + b)
        loss = -np.log(np.clip((P * Y).sum(axis=1), 1e-12, None)).mean() + 0.5 * self.l2 * (W ** 2).sum()
        G = (P - Y) / n
        return loss, X.T @ G + self.l2 * W, G.sum(axis=0), P

    def fit(self, X, y, verbose: int = 0, **_):
        n, f = X.shape
        Y = np.zeros((n, self.k))
        Y[np.arange(n), y] = 1.0
        self.W = np.zeros((f, self.k))
        self.b = np.zeros(self.k)
        mW, vW = np.zeros_like(self.W), np.zeros_like(self.W)
        mb, vb = np.zeros_like(self.b), np.zeros_like(self.b)
        b1, b2, eps = 0.9, 0.999, 1e-8
        self.history = []
        for t in range(1, self.epochs + 1):
            loss, dW, db, P = self.loss_and_grad(X, Y, self.W, self.b)
            # Adam: giảm gradient có "đà" (m) và tự chỉnh bước theo độ lớn gradient (v)
            mW = b1 * mW + (1 - b1) * dW
            vW = b2 * vW + (1 - b2) * dW ** 2
            mb = b1 * mb + (1 - b1) * db
            vb = b2 * vb + (1 - b2) * db ** 2
            self.W -= self.lr * (mW / (1 - b1 ** t)) / (np.sqrt(vW / (1 - b2 ** t)) + eps)
            self.b -= self.lr * (mb / (1 - b1 ** t)) / (np.sqrt(vb / (1 - b2 ** t)) + eps)
            acc = float((P.argmax(axis=1) == y).mean())
            self.history.append((t, float(loss), acc))
            if verbose and (t == 1 or t % verbose == 0 or t == self.epochs):
                print(f"    vòng {t:>4}   mất mát {loss:.4f}   chính xác (huấn luyện) {acc:.3f}")
        return self

    def decision(self, X):
        return X @ self.W + self.b

    def predict_proba(self, X):
        return softmax(self.decision(X))

    def weights(self):
        return self.W

    def bias(self):
        return self.b
