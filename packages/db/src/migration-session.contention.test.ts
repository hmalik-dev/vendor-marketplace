import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDatabase } from './client.js';
import { isLockTimeout, MIGRATION_SESSION_SETTINGS } from './migration-session.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from './testing/postgres-test-db.js';

/**
 * VEN-650 — the migrate connection gives up on a held lock instead of queueing
 * the live release's queries behind it for ever. Only a second real connection
 * can hold the lock.
 */
let database: PostgresTestDatabase;
let migrator: ReturnType<typeof createDatabase>;

/** Longer than the lock timeout, so only the timeout can end the wait early. */
const HOLD_SECONDS = 8;

beforeAll(async () => {
  database = await createPostgresTestDatabase({ poolSize: 2 });
  migrator = createDatabase({
    max: 1,
    connectionString: database.url,
    connection: MIGRATION_SESSION_SETTINGS,
  });
});

afterAll(async () => {
  await migrator?.client.end();
  await database?.close();
});

describe('the migrate connection', () => {
  it('starts every session with the lock and statement timeouts', async () => {
    const [row] = await migrator.client`
      select current_setting('lock_timeout') as lock, current_setting('statement_timeout') as statement`;

    expect(row).toEqual({ lock: '5s', statement: '1min' });
  });

  it('abandons DDL queued behind a lock the live release holds', async () => {
    const holder = database.db.transaction(async (tx) => {
      await tx.execute(sql`lock table categories in access share mode`);
      await tx.execute(sql`select pg_sleep(${HOLD_SECONDS})`);
    });
    // The holder has its lock before the DDL asks for one.
    await vi.waitFor(async () => {
      const held = await migrator.client`
        select count(*)::int as n from pg_locks
        where relation = 'categories'::regclass and mode = 'AccessShareLock' and granted`;
      expect(held[0]?.n).toBe(1);
    });

    const started = Date.now();
    const blocked = await migrator.db
      .execute(sql`alter table categories add column probe_ven_650 int`)
      .then(
        () => null,
        (error: unknown) => error,
      );
    const waitedMs = Date.now() - started;
    await holder;

    expect(isLockTimeout(blocked)).toBe(true);
    expect(waitedMs).toBeGreaterThanOrEqual(4_900);
    expect(waitedMs).toBeLessThan(HOLD_SECONDS * 1_000);
  }, 20_000);
});
