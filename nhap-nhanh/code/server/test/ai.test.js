'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');
const { buildPrompt } = require('../ai');

const body = { text: 'vợ nhờ tôi đi chợ nấu cà ri lúc 7h', now: '2026-11-04T10:00', weekday: 'Thứ tư' };
const reply = (text) => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }] }) });

test('gọi Anthropic với khóa và model của máy chủ, trả về JSON sạch', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return reply('Đây là kết quả:\n```json\n{"intent":"task","title":"Đi chợ nấu cà ri","shopping":true}\n```');
  };
  const s = await start({ anthropicKey: 'sk-test', aiModel: 'm-test' }, { fetchImpl });
  try {
    const { c } = await s.user();
    const r = await c.req('POST', '/api/ai/parse', body);
    assert.equal(r.status, 200);
    assert.equal(r.json.data.title, 'Đi chợ nấu cà ri');
    const { url, init } = calls[0];
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.headers['x-api-key'], 'sk-test');
    const sent = JSON.parse(init.body);
    assert.equal(sent.model, 'm-test');
    assert.match(sent.messages[0].content, /vợ nhờ tôi đi chợ nấu cà ri lúc 7h/);
    assert.match(sent.messages[0].content, /2026-11-04T10:00/);
  } finally { await s.close(); }
});

test('khóa API không bao giờ xuất hiện trong phản hồi cho trình duyệt', async () => {
  const fetchImpl = async () => reply('{"intent":"task","title":"A"}');
  const s = await start({ anthropicKey: 'sk-bi-mat-123' }, { fetchImpl });
  try {
    const { c } = await s.user();
    const r = await c.req('POST', '/api/ai/parse', body);
    assert.ok(!JSON.stringify(r.json).includes('sk-bi-mat-123'));
    assert.ok(![...r.headers.values()].join('\n').includes('sk-bi-mat-123'));
  } finally { await s.close(); }
});

test('chưa cấu hình khóa: 503, cần đăng nhập: 401', async () => {
  const s = await start();
  try {
    assert.equal((await s.client().req('POST', '/api/ai/parse', body)).status, 401);
    const { c } = await s.user();
    assert.equal((await c.req('POST', '/api/ai/parse', body)).status, 503);
  } finally { await s.close(); }
});

test('giới hạn lượt AI mỗi ngày', async () => {
  const s = await start({ anthropicKey: 'k', aiDailyLimit: 2 }, { fetchImpl: async () => reply('{"intent":"task"}') });
  try {
    const { c } = await s.user();
    assert.equal((await c.req('POST', '/api/ai/parse', body)).status, 200);
    assert.equal((await c.req('POST', '/api/ai/parse', body)).status, 200);
    const third = await c.req('POST', '/api/ai/parse', body);
    assert.equal(third.status, 429);
    assert.equal(third.json.error, 'ai_limit');
  } finally { await s.close(); }
});

test('kiểm tra đầu vào và lỗi từ AI được che đi', async () => {
  const s = await start({ anthropicKey: 'k' }, { fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ error: 'chi tiết nội bộ' }) }) });
  try {
    const { c } = await s.user();
    assert.equal((await c.req('POST', '/api/ai/parse', { ...body, text: '' })).status, 400);
    assert.equal((await c.req('POST', '/api/ai/parse', { ...body, text: 'x'.repeat(301) })).status, 400);
    assert.equal((await c.req('POST', '/api/ai/parse', { ...body, now: 'hôm nay' })).status, 400);
    const r = await c.req('POST', '/api/ai/parse', body);
    assert.equal(r.status, 502);
    assert.ok(!JSON.stringify(r.json).includes('chi tiết nội bộ'));
  } finally { await s.close(); }
});

test('lời nhắc chống chèn lệnh bằng dấu ngoặc kép ba', () => {
  const p = buildPrompt({ text: 'a """ b', now: '2026-11-04T10:00', weekday: 'Thứ tư' });
  assert.equal(p.split('"""').length, 3); // chỉ đúng một cặp ngoặc do chính prompt mở và đóng
});
