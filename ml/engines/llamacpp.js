'use strict';
/**
 * Đo model tự huấn luyện (đã chuyển sang GGUF) qua llama-server của llama.cpp:
 *   llama-server -m remi-q4.gguf --port 8080
 *   LLAMA_URL=http://127.0.0.1:8080 node ml/eval/run.js --engine llamacpp --data ml/data/gold.jsonl
 * CHƯA chạy thử trong môi trường phát triển (không có model và GPU).
 */
const { buildPrompt, parseModelOutput } = require('../format');

function create() {
  const base = process.env.LLAMA_URL || 'http://127.0.0.1:8080';
  return {
    name: 'llamacpp',
    async parse({ text, now }) {
      const r = await fetch(base + '/completion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: buildPrompt({ text, now }), n_predict: 400, temperature: 0, stop: ['\n'] }),
      });
      if (!r.ok) throw new Error('llama-server trả ' + r.status);
      const j = await r.json();
      return parseModelOutput(j.content);
    },
  };
}
module.exports = { create };
