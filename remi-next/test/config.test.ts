import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FUNCTION_MAX_DURATION,
  FUNCTION_REGION,
  MINIMUM_NODE_VERSION,
  validateConfig,
} from '../lib/config.ts';

test('cấu hình hợp lệ khi Node đạt mức tối thiểu và có DATABASE_URL', () => {
  const config = validateConfig({ DATABASE_URL: 'postgres://localhost/remi' }, 'v22.13.0');

  assert.equal(config.ok, true);
  assert.deepEqual(config.errors, []);
  assert.equal(config.runtime, 'nodejs');
  assert.equal(config.region, FUNCTION_REGION);
  assert.equal(config.maxDuration, FUNCTION_MAX_DURATION);
});

test('báo lỗi khi thiếu DATABASE_URL nhưng không yêu cầu khóa AI tùy chọn', () => {
  const config = validateConfig({
    NODE_ENV: 'production',
    ANTHROPIC_API_KEY: '',
    VAPID_PUBLIC_KEY: '',
  }, '22.18.0');

  assert.equal(config.ok, false);
  assert.ok(config.errors.some((error) => error.includes('DATABASE_URL')));
  assert.equal(config.errors.some((error) => error.includes('ANTHROPIC_API_KEY')), false);
});

test('từ chối Node thấp hơn mức README yêu cầu', () => {
  const config = validateConfig({ DATABASE_URL: 'postgres://localhost/remi' }, '22.12.9');

  assert.equal(config.ok, false);
  assert.ok(config.errors.some((error) => error.includes(MINIMUM_NODE_VERSION)));
});

test('báo lỗi với phiên bản Node không hợp lệ', () => {
  const config = validateConfig({ DATABASE_URL: 'postgres://localhost/remi' }, 'not-a-version');

  assert.equal(config.ok, false);
  assert.ok(config.errors.some((error) => error.includes('phiên bản Node.js')));
});
