'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, validateConfig } = require('../config');

test('production không có khóa AI thì từ chối khởi động', () => {
  const problems = validateConfig(loadConfig({ NODE_ENV: 'production' }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /GEMINI_API_KEY hoặc ANTHROPIC_API_KEY/);
});

test('production có khóa AI thì hợp lệ', () => {
  assert.deepEqual(validateConfig(loadConfig({ NODE_ENV: 'production', ANTHROPIC_API_KEY: 'sk-x' })), []);
});

test('chạy thử ở máy cá nhân không cần khóa', () => {
  assert.deepEqual(validateConfig(loadConfig({})), []);
});
