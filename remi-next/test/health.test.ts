import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHealth, type HealthSql, type HealthSqlOptions } from '../lib/health.ts';

function fakeSql(run: (strings: TemplateStringsArray) => PromiseLike<unknown>) {
  let closed = false;
  const sql: HealthSql = (strings) => run(strings);
  sql.end = async () => { closed = true; };
  return { sql, wasClosed: () => closed };
}

test('health trả DB ok khi probe thành công và luôn đóng SQL client', async () => {
  let query = '';
  let receivedUrl = '';
  let receivedOptions: HealthSqlOptions | undefined;
  const fake = fakeSql(async (strings) => {
    query = strings.join('');
    return [];
  });
  const result = await checkHealth('postgres://test.invalid/remi', (url, options) => {
    receivedUrl = url;
    receivedOptions = options;
    return fake.sql;
  });

  assert.deepEqual(result, { status: 200, body: { ok: true, db: 'ok' } });
  assert.equal(query, 'select 1');
  assert.equal(receivedUrl, 'postgres://test.invalid/remi');
  assert.deepEqual(receivedOptions, {
    prepare: false,
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
  });
  assert.equal(fake.wasClosed(), true);
});

test('health trả DB error khi probe lỗi và vẫn đóng SQL client', async () => {
  const fake = fakeSql(async () => { throw new Error('connection details must stay private'); });
  const result = await checkHealth('postgres://test.invalid/remi', () => fake.sql);

  assert.deepEqual(result, { status: 503, body: { ok: false, db: 'error' } });
  assert.equal(fake.wasClosed(), true);
});

test('health báo DB chưa cấu hình mà không kết nối', async () => {
  let factoryCalled = false;
  const result = await checkHealth(undefined, () => {
    factoryCalled = true;
    throw new Error('must not try to connect');
  });

  assert.deepEqual(result, { status: 200, body: { ok: true, db: 'not_configured' } });
  assert.equal(factoryCalled, false);
});
