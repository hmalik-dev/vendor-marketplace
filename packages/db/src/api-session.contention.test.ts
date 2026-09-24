import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isDatabaseTimeout } from './api-session.js';
import { createApiDatabase, createDatabase } from './client.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from './testing/postgres-test-db.js';

/**
 * VEN-607 — a slow statement or a held lock fails the request instead of
 * holding a pool slot. Only a real server enforces either.
 */
let database: PostgresTestDatabase;
let api: ReturnType<typeof createApiDatabase>;
let script: ReturnType<typeof createDatabase>;

beforeAll(async () => {
  database = await createPostgresTestDatabase({ poolSize: 2 });
  api = createApiDatabase({ max: 2, connectionString: database.url });
  script = createDatabase({ max: 1, connectionString: database.url });
});

afterAll(async () => {
  await api?.client.end();
  await script?.client.end();
  await database?.close();
});

interface Failure {
  error: unknown;
  ms: number;
}

async function failureOf(run: () => Promise<unknown>): Promise<Failure> {
  const started = Date.now();
  const error = await run().then(
    () => null,
    (thrown: unknown) => thrown,
  );

  return { error, ms: Date.now() - started };
}

const sqlStateOf = (error: unknown): string | undefined =>
  (error as { cause?: { code?: string } }).cause?.code;

describe('the API connection', () => {
  it('starts every session with the three timeouts', async () => {
    const [row] = await api.client`
      select current_setting('statement_timeout') as statement,
             current_setting('lock_timeout') as lock,
             current_setting('idle_in_transaction_session_timeout') as idle`;

    expect(row).toEqual({ statement: '10s', lock: '5s', idle: '2min' });
  });

  it('cancels a statement that runs past ten seconds', async () => {
    const { error, ms } = await failureOf(() => api.db.execute(sql`select pg_sleep(15)`));

    expect(isDatabaseTimeout(error)).toBe(true);
    expect(sqlStateOf(error)).toBe('57014');
    expect(ms).toBeGreaterThanOrEqual(9_900);
    expect(ms).toBeLessThan(13_000);
  }, 20_000);

  it('abandons a write queued behind a row lock after five seconds', async () => {
    await api.client`create table ven_607_probe (id int primary key, n int)`;
    await api.client`insert into ven_607_probe values (1, 0)`;

    const holder = script.db.transaction(async (tx) => {
      await tx.execute(sql`select * from ven_607_probe where id = 1 for update`);
      await tx.execute(sql`select pg_sleep(8)`);
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { error, ms } = await failureOf(() =>
      api.db.execute(sql`update ven_607_probe set n = 1 where id = 1`),
    );
    await holder;

    expect(sqlStateOf(error)).toBe('55P03');
    expect(ms).toBeGreaterThanOrEqual(4_500);
    expect(ms).toBeLessThan(8_000);
  }, 20_000);
});

describe('a client made without the API settings (the migrator, seeds and scripts)', () => {
  it('has no statement or lock bound of its own', async () => {
    const [row] = await script.client`
      select current_setting('statement_timeout') as statement, current_setting('lock_timeout') as lock`;

    expect(row).toEqual({ statement: '0', lock: '0' });
  });
});
