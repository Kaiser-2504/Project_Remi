"""Bước 2: biến câu thành vector số bằng TF-IDF (tự cài).

Ý tưởng: mỗi đặc trưng (từ, cặp từ, nhóm ký tự) là một chiều của vector.
  TF  (term frequency): đặc trưng xuất hiện bao nhiêu lần trong CÂU này (lấy 1 + ln để câu lặp chữ không áp đảo).
  IDF (inverse document frequency): đặc trưng "hiếm" thế nào trong CẢ TẬP dữ liệu.
        ln((1 + n) / (1 + df)) + 1, với n là số câu, df là số câu chứa đặc trưng đó.
        Đặc trưng có ở mọi câu thì IDF thấp (ít thông tin); đặc trưng hiếm thì IDF cao.
  Giá trị = TF x IDF, rồi chia cho độ dài vector (chuẩn L2) để mọi câu có độ dài 1.
"""
import math
from collections import Counter

import numpy as np

from .text import analyze


class TfidfVectorizer:
    def __init__(self, min_df: int = 2, max_features: int = 4000):
        self.min_df = min_df              # bỏ đặc trưng xuất hiện ở ít hơn min_df câu (thường là nhiễu)
        self.max_features = max_features  # giữ tối đa bấy nhiêu đặc trưng phổ biến nhất
        self.vocab = {}                   # đặc trưng -> chỉ số cột
        self.idf = np.zeros(0)

    def fit(self, docs):
        n = len(docs)
        df, total = Counter(), Counter()
        for d in docs:
            c = Counter(analyze(d))
            total.update(c)
            df.update(c.keys())
        terms = [t for t, v in df.items() if v >= self.min_df]
        terms.sort(key=lambda t: (-total[t], t))
        terms = sorted(terms[: self.max_features])
        self.vocab = {t: i for i, t in enumerate(terms)}
        self.idf = np.array([math.log((1 + n) / (1 + df[t])) + 1.0 for t in terms])
        return self

    def fit_transform(self, docs):
        return self.fit(docs).transform(docs)

    def transform_one(self, text):
        """Vector thưa của một câu: (danh sách chỉ số cột, danh sách giá trị đã chuẩn hoá)."""
        counts = Counter(f for f in analyze(text) if f in self.vocab)
        idx = sorted(self.vocab[f] for f in counts)
        by_idx = {self.vocab[f]: c for f, c in counts.items()}
        vals = np.array([(1.0 + math.log(by_idx[i])) * self.idf[i] for i in idx])
        norm = float(np.sqrt((vals ** 2).sum()))
        if norm > 0:
            vals = vals / norm
        return idx, vals

    def transform(self, docs):
        X = np.zeros((len(docs), len(self.vocab)))
        for r, d in enumerate(docs):
            idx, vals = self.transform_one(d)
            X[r, idx] = vals
        return X

    def feature_name(self, i):
        if not hasattr(self, "_names"):
            self._names = {v: k for k, v in self.vocab.items()}
        return self._names[i]
