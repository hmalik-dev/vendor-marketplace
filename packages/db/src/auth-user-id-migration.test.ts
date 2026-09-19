import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * `0048` renames `users.clerk_user_id` to `auth_user_id` (VEN-447), against a
 * database that already holds accounts.
 *
 * What matters is the rows that were already there: a rename that dropped and
 * re-added the column would pass a schema read and lose every identity link.
 * So this migrates to just before it, writes a row under the old name, applies
 * `0048`, and reads the same value back under the new one — and checks the
 * unique index survived under its new name, because that index is what stops
 * two rows claiming one identity.
 */
const THIS_MIGRATION = '0048_spicy_jack_power';

const USER = '99999999-9999-4999-8999-999999999999';

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.migrateUpTo(THIS_MIGRATION);
});

afterAll(async () => {
  await testDb.close();
});

describe('0048 rename users.clerk_user_id to auth_user_id', () => {
  it('keeps the identity an existing row held, and the uniqueness on it', async () => {
    await testDb.db.execute(
      sql.raw(`INSERT INTO users (id, clerk_user_id, email, role, first_name, last_name)
        VALUES ('${USER}', 'user_existing_identity', 'existing@example.com', 'customer', 'Ex', 'Isting')`),
    );

    const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${THIS_MIGRATION}.sql`), 'utf8');
    for (const statement of body.split('--> statement-breakpoint')) {
      if (statement.trim().length > 0) {
        await testDb.db.execute(sql.raw(statement));
      }
    }

    const row = await testDb.db.execute<{ auth_user_id: string }>(
      sql.raw(`SELECT auth_user_id FROM users WHERE id = '${USER}'`),
    );
    expect(row.rows).toEqual([{ auth_user_id: 'user_existing_identity' }]);

    const old = await testDb.db.execute<{ n: number }>(
      sql.raw(
        `SELECT count(*)::int AS n FROM information_schema.columns
         WHERE table_name = 'users' AND column_name = 'clerk_user_id'`,
      ),
    );
    expect(old.rows).toEqual([{ n: 0 }]);

    const indexes = await testDb.db.execute<{ indexname: string }>(
      sql.raw(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'users' AND indexname LIKE '%auth_user_id%'`,
      ),
    );
    expect(indexes.rows).toEqual([{ indexname: 'users_auth_user_id_key' }]);

    await expect(
      testDb.db.execute(
        sql.raw(`INSERT INTO users (auth_user_id, email, role, first_name, last_name)
          VALUES ('user_existing_identity', 'second@example.com', 'customer', 'Sec', 'Ond')`),
      ),
    ).rejects.toThrow();
  });
});
