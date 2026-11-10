"""Thuật toán 1: Naive Bayes (tự cài).

Ý tưởng (định lý Bayes): xác suất nhãn k cho câu x
    P(k | x)  tỉ lệ với  P(k) * tích over đặc trưng f của  P(f | k)^(x_f)
"Naive" (ngây thơ) vì giả định các đặc trưng độc lập với nhau khi đã biết nhãn, điều thường không đúng
nhưng vẫn cho kết quả tốt. Làm việc trong log để tránh số quá nhỏ:
    log P(k | x) = log P(k) + tổng over f của  x_f * log P(f | k)
P(f | k) ước lượng từ dữ liệu, có làm mượt Laplace (alpha) để đặc trưng chưa từng thấy ở nhãn k không làm xác suất bằng 0.
"""
import numpy as np


def softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


class MultinomialNB:
    def __init__(self, n_classes: int, alpha: float = 0.1):
        self.k = n_classes
        self.alpha = alpha
        self.log_prior = None
        self.log_prob = None  # hình (số nhãn, số đặc trưng)

    def fit(self, X, y, **_):
        n, f = X.shape
        Y = np.zeros((n, self.k))
        Y[np.arange(n), y] = 1.0
        counts = Y.sum(axis=0)
        self.log_prior = np.log(counts / n)
        feat = Y.T @ X + self.alpha                      # tổng giá trị đặc trưng theo từng nhãn, đã làm mượt
        self.log_prob = np.log(feat) - np.log(feat.sum(axis=1, keepdims=True))
        return self

    def decision(self, X):
        return X @ self.log_prob.T + self.log_prior

    def predict_proba(self, X):
        return softmax(self.decision(X))

    def weights(self):
        """Ma trận (đặc trưng x nhãn) dùng để giải thích: log P(f | k)."""
        return self.log_prob.T

    def bias(self):
        return self.log_prior
