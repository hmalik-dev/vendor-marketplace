import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * `0054` adds `users.auth_provider` and `0055` backfills it (VEN-450).
 *
 * The backfill is the only place the shape of an id still decides a provider,
 * once, for rows that predate the column. A Neon Auth id that merely resembles
 * a Clerk one must stay `neon_auth` after it, which is why the pattern is the
 * full Clerk shape and not the bare `user_` prefix.
 */
const ADD_COLUMN = '0054_organic_elektra';
const BACKFILL = '0055_backfill_auth_provider';

const ROWS = [
  ['seed_mkt_vendor_ada', 'seed'],
  ['user_2abcdefghijklmnopqrstuvwxyz', 'legacy_clerk'],
  ['user_short', 'neon_auth'],
  ['0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', 'neon_auth'],
] as const;

let testDb: TestDatabase;

async function apply(name: string) {
  const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${name}.sql`), 'utf8');
  for (const statement of body.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) {
      await testDb.db.execute(sql.raw(statement));
    }
  }
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.migrateUpTo(ADD_COLUMN);
});

afterAll(async () => {
  await testDb.close();
});

describe('0054 and 0055 record who issued each existing identity', () => {
  it('backfills seed and Clerk-shaped rows and leaves everything else on neon_auth', async () => {
    for (const [index, [authUserId]] of ROWS.entries()) {
      await testDb.db.execute(
        sql.raw(`INSERT INTO users (auth_user_id, email, role, first_name, last_name)
          VALUES ('${authUserId}', 'row${index}@example.com', 'customer', 'A', 'B')`),
      );
    }
    await apply(ADD_COLUMN);
    await apply(BACKFILL);

    const result = await testDb.db.execute<{ auth_user_id: string; auth_provider: string }>(
      sql.raw('SELECT auth_user_id, auth_provider FROM users'),
    );
    const byId = Object.fromEntries(result.rows.map((r) => [r.auth_user_id, r.auth_provider]));

    expect(byId).toEqual(Object.fromEntries(ROWS));
  });
});
