"""Ghép các bước thành một mô hình hoàn chỉnh: câu -> TF-IDF -> thuật toán -> nhãn.

    model = IntentModel(algo="softmax")
    model.fit(danh_sách_câu, danh_sách_nhãn)
    model.predict_one("uống nước 2 lít mỗi ngày")
"""
import json

import numpy as np

from .naive_bayes import MultinomialNB, softmax
from .remi_actions import action_for
from .softmax import SoftmaxRegression
from .text import LABELS
from .tfidf import TfidfVectorizer

ALGOS = {"softmax": SoftmaxRegression, "nb": MultinomialNB}
ALGO_NAMES = {"softmax": "Hồi quy softmax (tự cài, giảm gradient)", "nb": "Naive Bayes (tự cài)"}


class IntentModel:
    def __init__(self, algo="softmax", min_df=2, max_features=4000, **params):
        if algo not in ALGOS:
            raise ValueError(f"algo phải là một trong {list(ALGOS)}")
        self.algo = algo
        self.params = params
        self.vec = TfidfVectorizer(min_df=min_df, max_features=max_features)
        self.clf = None
        self.meta = {}

    # ---------- huấn luyện ----------
    def fit(self, texts, labels, verbose=0):
        y = np.array([LABELS.index(l) for l in labels])
        X = self.vec.fit_transform(texts)
        self.clf = ALGOS[self.algo](len(LABELS), **self.params)
        self.clf.fit(X, y, verbose=verbose)
        self.meta = {"trained_on": len(texts), "features": len(self.vec.vocab)}
        return self

    # ---------- dự đoán ----------
    def predict_proba(self, texts):
        return self.clf.predict_proba(self.vec.transform(list(texts)))

    def predict(self, texts):
        return [LABELS[i] for i in self.predict_proba(texts).argmax(axis=1)]

    def explain(self, text, top_k=5):
        """Những đặc trưng trong câu đẩy mô hình về nhãn đã chọn (so với nhãn đứng thứ hai), nhiều nhất trước.

        Đóng góp của đặc trưng f = giá trị TF-IDF của f x (trọng số của f cho nhãn chọn - trọng số của f cho nhãn thứ hai).
        Với softmax đó là đóng góp vào khoảng cách điểm giữa hai nhãn; với Naive Bayes là chênh lệch log xác suất.
        """
        idx, vals = self.vec.transform_one(text)
        p = self.clf.predict_proba(self.vec.transform([text]))[0]
        order = np.argsort(-p)
        best, second = int(order[0]), int(order[1])
        W = self.clf.weights()
        contrib = [(self.vec.feature_name(i), float(v * (W[i, best] - W[i, second]))) for i, v in zip(idx, vals)]
        contrib = [c for c in contrib if c[1] > 0]
        contrib.sort(key=lambda c: -c[1])
        words = [c for c in contrib if not c[0].startswith("#")]
        chars = [c for c in contrib if c[0].startswith("#")]
        shown = (words + chars)[:top_k] if len(words) < 3 else words[:top_k]
        return {"known_features": len(idx), "second": LABELS[second], "because": shown}

    def predict_one(self, text, top_k=5):
        p = self.clf.predict_proba(self.vec.transform([text]))[0]
        k = int(p.argmax())
        label, conf = LABELS[k], float(p[k])
        ex = self.explain(text, top_k)
        return {
            "text": text,
            "label": label,
            "confidence": conf,
            "probs": {l: float(v) for l, v in zip(LABELS, p)},
            "second": ex["second"],
            "known_features": ex["known_features"],
            "because": ex["because"],
            "action": action_for(label, conf),
        }

    # ---------- lưu và đọc ----------
    def _linear(self):
        """Cả hai thuật toán đều có dạng: xác suất = softmax(X @ W + b). Lưu W, b là đủ để dự đoán lại."""
        return self.clf.weights(), self.clf.bias()

    def save(self, path):
        W, b = self._linear()
        obj = {
            "format": 2,
            "algo": self.algo,
            "labels": LABELS,
            "params": self.params,
            "vocab": self.vec.vocab,
            "idf": [float(v) for v in self.vec.idf],
            "weights": [round(float(v), 10) for v in W.flatten()],  # theo từng đặc trưng: [đặc trưng][nhãn]
            "bias": [round(float(v), 10) for v in b],
            "meta": self.meta,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as f:
            o = json.load(f)
        m = cls(algo=o["algo"], **o["params"])
        m.vec.vocab = o["vocab"]
        m.vec.idf = np.array(o["idf"])
        F, K = len(o["vocab"]), len(o["labels"])
        W = np.array(o["weights"]).reshape(F, K)
        b = np.array(o["bias"])
        m.clf = ALGOS[o["algo"]](K, **o["params"])
        if o["algo"] == "softmax":
            m.clf.W, m.clf.b = W, b
        else:
            m.clf.log_prob, m.clf.log_prior = W.T, b
        m.meta = o.get("meta", {})
        return m

    def export_for_app(self, path):
        """Ghi mô hình theo định dạng mà web/js/intent-model.js (app Remi) đọc được."""
        W, b = self._linear()
        obj = {
            "version": 1,
            "labels": LABELS,
            "vocab": self.vec.vocab,
            "idf": [round(float(v), 8) for v in self.vec.idf],
            "coef": [round(float(v), 8) for v in W.flatten()],
            "intercept": [round(float(v), 8) for v in b],
            "meta": {"features": len(self.vec.vocab), "trained_on": self.meta.get("trained_on"), "algo": self.algo},
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
