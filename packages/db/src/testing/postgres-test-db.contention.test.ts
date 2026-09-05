import postgres from 'postgres';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../load-env.js';
import { categories } from '../schema/index.js';
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-db.js';

// Vitest is not a package script, so nothing has read the repository's `.env`
// yet — and an empty connection string makes postgres.js fall back to the OS
// user rather than fail, which reads as an authentication bug.
loadEnv();

/**
 * The create/drop lifecycle, against the server `DATABASE_URL` names.
 *
 * The cleanup is the half worth pinning. Every contention suite leans on
 * `close()` actually dropping the database it made — without that, iterating on
 * a failing suite leaves a fully migrated database on the shared dev server on
 * every run, and nothing ever removes them.
 */
describe('the throwaway database', () => {
  const admin = postgres(process.env.DATABASE_URL ?? '', { max: 1 });

  /*
   * Everything this file opens, closed in `afterEach` whatever the test did. A
   * failing assertion between `create` and `close` is exactly how a database
   * gets stranded, and the suite that proves they are cleaned up must not be
   * the one that strands them.
   */
  const opened: PostgresTestDatabase[] = [];

  async function open(): Promise<PostgresTestDatabase> {
    const database = await createPostgresTestDatabase();
    opened.push(database);

    return database;
  }

  async function exists(name: string): Promise<boolean> {
    const rows = await admin`select 1 from pg_database where datname = ${name}`;

    return rows.length === 1;
  }

  afterEach(async () => {
    // Safe to repeat after a test closed one itself: `drop database if exists`
    // on a name already gone is a no-op, and an ended pool ends silently.
    await Promise.all(opened.splice(0).map((database) => database.close()));
  });

  afterAll(async () => {
    await admin.end();
  });

  it('is migrated while it is open, and gone once it is closed', async () => {
    const database = await open();

    expect(await exists(database.name)).toBe(true);
    // Migrated, not merely created: the tables the suites query are there.
    expect(await database.db.select().from(categories)).toEqual([]);

    await database.close();

    expect(await exists(database.name)).toBe(false);
  });

  it('gets a name of its own on every call', async () => {
    const [first, second] = await Promise.all([open(), open()]);

    expect(first.name).not.toBe(second.name);
    expect(first.name).toMatch(/^contention_test_[0-9a-f]{32}$/);

    await Promise.all([first.close(), second.close()]);

    expect(await exists(first.name)).toBe(false);
    expect(await exists(second.name)).toBe(false);
  });
});
