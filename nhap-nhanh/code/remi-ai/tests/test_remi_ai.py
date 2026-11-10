"""Kiểm thử bộ phân loại tự cài. Chạy:  python -m unittest discover -s tests -v   (trong thư mục remi-ai)"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from remi_ai import IntentModel, analyze, fold, metrics  # noqa: E402
from remi_ai.data import load_csv  # noqa: E402
from remi_ai.naive_bayes import MultinomialNB, softmax  # noqa: E402
from remi_ai.softmax import SoftmaxRegression  # noqa: E402
from remi_ai.text import LABELS  # noqa: E402
from remi_ai.tfidf import TfidfVectorizer  # noqa: E402


class TextTests(unittest.TestCase):
    def test_fold(self):
        self.assertEqual(fold("Uống nước 2,5 lít!"), "uong nuoc 0 0 lit")
        self.assertEqual(fold("Đi chợ"), "di cho")
        self.assertEqual(fold("  "), "")
        self.assertEqual(fold("😀"), "")

    def test_analyze_has_words_pairs_and_chars(self):
        f = analyze("uống nước")
        self.assertIn("uong", f)
        self.assertIn("uong_nuoc", f)
        self.assertIn("#uon", f)
        self.assertEqual(analyze(""), [])


class TfidfTests(unittest.TestCase):
    def test_idf_formula_and_normalisation(self):
        docs = ["uong nuoc", "uong thuoc", "di cho"]
        v = TfidfVectorizer(min_df=1).fit(docs)
        # "nuoc" xuất hiện ở 1 trong 3 câu: idf = ln((1+3)/(1+1)) + 1
        self.assertAlmostEqual(v.idf[v.vocab["nuoc"]], np.log(4 / 2) + 1)
        # "uong" ở 2 trong 3 câu: idf = ln((1+3)/(1+2)) + 1
        self.assertAlmostEqual(v.idf[v.vocab["uong"]], np.log(4 / 3) + 1)
        X = v.transform(docs + [""])
        for row in X[:3]:
            self.assertAlmostEqual(float(np.linalg.norm(row)), 1.0)
        self.assertEqual(float(np.linalg.norm(X[3])), 0.0)

    def test_min_df_and_max_features(self):
        docs = ["aaa bbb", "aaa ccc", "aaa ddd"]
        v = TfidfVectorizer(min_df=2).fit(docs)
        self.assertIn("aaa", v.vocab)
        self.assertNotIn("bbb", v.vocab)
        v2 = TfidfVectorizer(min_df=1, max_features=5).fit(docs)
        self.assertEqual(len(v2.vocab), 5)

    def test_unknown_words_give_zero_vector(self):
        v = TfidfVectorizer(min_df=1).fit(["uong nuoc"])
        self.assertEqual(float(np.linalg.norm(v.transform(["zzzqqq"])[0])), 0.0)


class ModelTests(unittest.TestCase):
    def test_softmax_function(self):
        p = softmax(np.array([[1.0, 2.0, 3.0], [1000.0, 1000.0, 1000.0]]))
        np.testing.assert_allclose(p.sum(axis=1), 1.0)
        np.testing.assert_allclose(p[1], 1 / 3)  # không tràn số với điểm rất lớn

    def test_gradient_matches_numeric_gradient(self):
        """Công thức đạo hàm trong softmax.py phải khớp đạo hàm số (kiểm tra gradient)."""
        rng = np.random.default_rng(0)
        X = rng.normal(size=(7, 5))
        y = np.array([0, 1, 2, 0, 1, 2, 1])
        Y = np.zeros((7, 3))
        Y[np.arange(7), y] = 1
        m = SoftmaxRegression(3, l2=0.01)
        W = rng.normal(size=(5, 3))
        b = rng.normal(size=3)
        _, dW, db, _ = m.loss_and_grad(X, Y, W, b)
        eps = 1e-6
        for (i, j) in [(0, 0), (2, 1), (4, 2), (1, 0)]:
            Wp, Wm = W.copy(), W.copy()
            Wp[i, j] += eps
            Wm[i, j] -= eps
            num = (m.loss_and_grad(X, Y, Wp, b)[0] - m.loss_and_grad(X, Y, Wm, b)[0]) / (2 * eps)
            self.assertAlmostEqual(dW[i, j], num, places=6)
        for k in range(3):
            bp, bm = b.copy(), b.copy()
            bp[k] += eps
            bm[k] -= eps
            num = (m.loss_and_grad(X, Y, W, bp)[0] - m.loss_and_grad(X, Y, W, bm)[0]) / (2 * eps)
            self.assertAlmostEqual(db[k], num, places=6)

    def test_softmax_learns_separable_data_and_loss_drops(self):
        rng = np.random.default_rng(1)
        X = np.vstack([rng.normal([2, 0], 0.3, (30, 2)), rng.normal([0, 2], 0.3, (30, 2)), rng.normal([-2, -2], 0.3, (30, 2))])
        y = np.repeat([0, 1, 2], 30)
        m = SoftmaxRegression(3, l2=1e-4, lr=0.1, epochs=150).fit(X, y)
        self.assertEqual(float((m.predict_proba(X).argmax(axis=1) == y).mean()), 1.0)
        self.assertLess(m.history[-1][1], m.history[0][1] * 0.3)
        np.testing.assert_allclose(m.predict_proba(X).sum(axis=1), 1.0)

    def test_naive_bayes_on_toy_counts(self):
        X = np.array([[3, 0], [2, 1], [0, 3], [1, 2.0]])
        y = np.array([0, 0, 1, 1])
        m = MultinomialNB(2, alpha=1.0).fit(X, y)
        self.assertEqual(list(m.predict_proba(X).argmax(axis=1)), [0, 0, 1, 1])
        # P(đặc trưng | nhãn) của mỗi nhãn cộng lại bằng 1
        np.testing.assert_allclose(np.exp(m.log_prob).sum(axis=1), 1.0)


class MetricTests(unittest.TestCase):
    def test_known_confusion(self):
        cm = metrics.confusion_matrix([0, 0, 1, 1, 1], [0, 1, 1, 1, 0], 2)
        self.assertEqual(cm.tolist(), [[1, 1], [1, 2]])
        pc = metrics.per_class(cm)
        self.assertAlmostEqual(pc[0][0], 0.5)
        self.assertAlmostEqual(pc[0][1], 0.5)
        self.assertAlmostEqual(pc[1][2], 2 / 3)
        self.assertAlmostEqual(metrics.accuracy(cm), 0.6)
        self.assertAlmostEqual(metrics.macro_f1(cm), (0.5 + 2 / 3) / 2)

    def test_selective_table(self):
        probs = np.array([[0.9, 0.1], [0.55, 0.45], [0.2, 0.8]])
        rows = metrics.selective_table([0, 1, 1], probs, thresholds=(0.0, 0.6))
        self.assertAlmostEqual(rows[0][1], 1.0)
        self.assertAlmostEqual(rows[1][1], 2 / 3)   # chỉ 2 trong 3 câu đủ tin cậy
        self.assertAlmostEqual(rows[1][2], 1.0)


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        X, y = load_csv(os.path.join(ROOT, "data", "train.csv"))
        cls.X, cls.y = X[:500], y[:500]

    def test_fit_predict_save_load_roundtrip(self):
        for algo, kw in (("softmax", {"epochs": 40}), ("nb", {})):
            m = IntentModel(algo=algo, **kw).fit(self.X, self.y)
            p = m.predict_proba(self.X[:20])
            np.testing.assert_allclose(p.sum(axis=1), 1.0)
            with tempfile.TemporaryDirectory() as d:
                path = os.path.join(d, "m.json")
                m.save(path)
                m2 = IntentModel.load(path)
            np.testing.assert_allclose(m2.predict_proba(self.X[:20]), p, atol=1e-8)
            self.assertEqual(m2.predict(self.X[:20]), m.predict(self.X[:20]))

    def test_predict_one_shape_and_explanation(self):
        m = IntentModel(algo="softmax", epochs=60).fit(self.X, self.y)
        r = m.predict_one("uống nước 2 lít mỗi ngày")
        self.assertIn(r["label"], LABELS)
        self.assertAlmostEqual(sum(r["probs"].values()), 1.0)
        self.assertTrue(0 < r["confidence"] <= 1)
        self.assertIn("intent", r["action"]["remi_intent"])
        self.assertLessEqual(len(r["because"]), 5)
        empty = m.predict_one("zzzqqqxxx")
        self.assertEqual(empty["known_features"] >= 0, True)

    def test_export_for_app_is_consistent(self):
        m = IntentModel(algo="softmax", epochs=40).fit(self.X, self.y)
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "app.json")
            m.export_for_app(path)
            with open(path, encoding="utf-8") as f:
                o = json.load(f)
        F, K = len(o["vocab"]), len(o["labels"])
        self.assertEqual(o["labels"], LABELS)
        self.assertEqual(len(o["idf"]), F)
        self.assertEqual(len(o["coef"]), F * K)
        self.assertEqual(len(o["intercept"]), K)

    def test_unknown_label_in_csv_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "x.csv")
            with open(p, "w", encoding="utf-8") as f:
                f.write("text,label\nxin chao,khong_co\n")
            with self.assertRaises(SystemExit):
                load_csv(p)


class DemoTests(unittest.TestCase):
    def run_demo(self, *args, stdin=None):
        return subprocess.run([sys.executable, os.path.join(ROOT, "demo.py"), "--no-color", *args], input=stdin,
                              capture_output=True, text=True, encoding="utf-8", timeout=120)

    def test_single_sentence_json(self):
        r = self.run_demo("--text", "uống nước 2 lít mỗi ngày", "--json")
        self.assertEqual(r.returncode, 0, r.stderr)
        o = json.loads(r.stdout)
        self.assertEqual(o["label"], "nuoc")
        self.assertEqual(o["action"]["remi_intent"], {"intent": "habit", "shopping": False})

    def test_interactive_session_through_stdin(self):
        r = self.run_demo(stdin="đi chợ nấu cà ri\n:algo nb\nmai 9h họp nhóm\n:quit\n")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("di_cho", r.stdout)
        self.assertIn("Naive Bayes", r.stdout)
        self.assertIn("viec", r.stdout)

    def test_windows_style_console_encoding(self):
        """Giả lập Windows: bảng mã mặc định cp1252 + đường ống + tiếng Việt có chữ "ọ" (byte 0x8d). Từng làm demo sập."""
        env = dict(os.environ, PYTHONIOENCODING="cp1252", PYTHONUTF8="0")
        r = subprocess.run([sys.executable, os.path.join(ROOT, "demo.py"), "--no-color", "--no-explain"],
                           input="mai 9h họp nhóm\nđi chợ nấu cà ri\n:quit\n".encode("utf-8"), capture_output=True, env=env, timeout=120)
        out, err = r.stdout.decode("utf-8"), r.stderr.decode("utf-8")
        self.assertEqual(r.returncode, 0, err)
        self.assertIn("viec", out)
        self.assertIn("di_cho", out)

    def test_auto_mode_runs(self):
        r = self.run_demo("--auto", "--no-explain")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("Tóm tắt", r.stdout)

    def test_end_of_input_exits_cleanly(self):
        r = self.run_demo(stdin="")
        self.assertEqual(r.returncode, 0, r.stderr)


class SklearnAgreement(unittest.TestCase):
    """Đối chiếu với scikit-learn (bỏ qua nếu chưa cài): TF-IDF tự cài phải cho cùng ma trận."""

    def test_tfidf_matches_sklearn(self):
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer as SkTfidf
        except ImportError:
            self.skipTest("chưa cài scikit-learn")
        X, _ = load_csv(os.path.join(ROOT, "data", "train.csv"))
        X = X[:300]
        ours = TfidfVectorizer(min_df=2, max_features=1000).fit(X)
        sk = SkTfidf(analyzer=analyze, vocabulary=ours.vocab, sublinear_tf=True)
        A = sk.fit_transform(X).toarray()
        np.testing.assert_allclose(ours.transform(X), A, atol=1e-9)
        np.testing.assert_allclose(ours.idf, sk.idf_, atol=1e-9)


if __name__ == "__main__":
    unittest.main()
