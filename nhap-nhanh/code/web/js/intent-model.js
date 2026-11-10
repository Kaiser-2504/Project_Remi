/**
 * Bộ phân loại ý định câu nói chạy trên máy (không gọi mạng): đọc mô hình JSON do remi-ai/train.py xuất ra.
 * Đặc trưng PHẢI giống hệt remi-ai/remi_ai/text.py; test (server/test/intent.test.js) so với mô hình Python.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RemiIntent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function fold(text) {
    return String(text == null ? '' : text).toLowerCase().replace(/đ/g, 'd')
      .normalize('NFD').replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, ' ').replace(/[0-9]+/g, '0').replace(/ +/g, ' ').trim();
  }

  function featurize(text) {
    const f = fold(text);
    const words = f ? f.split(' ') : [];
    const feats = words.slice();
    for (let i = 0; i + 1 < words.length; i++) feats.push(words[i] + '_' + words[i + 1]);
    for (const w of words) {
      const p = ' ' + w + ' ';
      for (const n of [3, 4]) for (let i = 0; i + n <= p.length; i++) feats.push('#' + p.slice(i, i + n));
    }
    return feats;
  }

  /** @param {{labels:string[],vocab:Object,idf:number[],coef:number[],intercept:number[]}} m */
  function createIntentModel(m) {
    const K = m.labels.length;
    const vocab = new Map(Object.entries(m.vocab)); // Map, không dùng object: "constructor" không được lọt vào
    function probs(text) {
      const counts = new Map();
      for (const f of featurize(text)) {
        const i = vocab.get(f);
        if (i !== undefined) counts.set(i, (counts.get(i) || 0) + 1);
      }
      let norm = 0;
      const vals = [];
      for (const [i, c] of counts) { const v = (1 + Math.log(c)) * m.idf[i]; vals.push([i, v]); norm += v * v; }
      norm = Math.sqrt(norm);
      const z = m.intercept.slice();
      if (norm > 0) for (const [i, v] of vals) { const x = v / norm; for (let k = 0; k < K; k++) z[k] += x * m.coef[i * K + k]; }
      const mx = Math.max(...z);
      const e = z.map((a) => Math.exp(a - mx));
      const s = e.reduce((a, b) => a + b, 0);
      return e.map((a) => a / s);
    }
    function predict(text) {
      const p = probs(text);
      let best = 0;
      for (let k = 1; k < K; k++) if (p[k] > p[best]) best = k;
      const byLabel = {};
      m.labels.forEach((l, k) => { byLabel[l] = p[k]; });
      return { label: m.labels[best], confidence: p[best], probs: byLabel };
    }
    return { labels: m.labels.slice(), probs, predict };
  }

  return { createIntentModel, fold, featurize };
});
