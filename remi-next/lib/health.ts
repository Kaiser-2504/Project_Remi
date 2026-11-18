export interface HealthSqlOptions {
  prepare: false;
  max: 1;
  connect_timeout: 5;
  idle_timeout: 5;
}

export interface HealthSql {
  (strings: TemplateStringsArray): PromiseLike<unknown>;
  end(): Promise<void>;
}

export type MakeSql = (url: string, options: HealthSqlOptions) => HealthSql | Promise<HealthSql>;

export type HealthStatus =
  | { status: 200; body: { ok: true; db: 'ok' | 'not_configured' } }
  | { status: 503; body: { ok: false; db: 'error' } };

const SQL_OPTIONS: HealthSqlOptions = {
  prepare: false,
  max: 1,
  connect_timeout: 5,
  idle_timeout: 5,
};

async function makePostgresSql(url: string, options: HealthSqlOptions): Promise<HealthSql> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, options);
  const client = (strings: TemplateStringsArray) => sql(strings);
  client.end = () => sql.end();
  return client;
}

export async function checkDb(
  url: string,
  makeSql: MakeSql = makePostgresSql,
): Promise<{ db: 'ok' | 'error' }> {
  let result: 'ok' | 'error' = 'error';
  let sql: HealthSql | undefined;

  try {
    if (!url.trim()) return { db: 'error' };
    sql = await makeSql(url, SQL_OPTIONS);
    await sql`select 1`;
    result = 'ok';
  } catch {
    result = 'error';
  } finally {
    if (sql) {
      try {
        await sql.end();
      } catch {
        result = 'error';
      }
    }
  }

  return { db: result };
}

export async function checkHealth(url: string | undefined, makeSql?: MakeSql): Promise<HealthStatus> {
  if (!url?.trim()) return { status: 200, body: { ok: true, db: 'not_configured' } };

  const result = await checkDb(url, makeSql);
  if (result.db === 'ok') return { status: 200, body: { ok: true, db: 'ok' } };
  return { status: 503, body: { ok: false, db: 'error' } };
}
