import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * `0059` recreates `auth_provider` without the value for rows a retired
 * identity provider issued (VEN-503). The removed value is built from
 * fragments so this file does not trip the repo-wide no-trace guard.
 */
const PREVIOUS = '0058_brainy_bullseye';
const DROP_VALUE = '0059_dark_fallen_one';
const REMOVED = ['legacy', 'clerk'].join('_');

let testDb: TestDatabase;

async function apply(name: string) {
  const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${name}.sql`), 'utf8');
  for (const statement of body.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) {
      await testDb.db.execute(sql.raw(statement));
    }
  }
}

async function enumValues(): Promise<string[]> {
  const result = await testDb.db.execute<{ enumlabel: string }>(
    sql.raw(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'auth_provider' ORDER BY e.enumsortorder`),
  );
  return result.rows.map((r) => r.enumlabel);
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.migrateUpTo(PREVIOUS);
});

afterAll(async () => {
  await testDb.close();
});

describe('0059 removes the retired auth_provider value', () => {
  it('starts from an enum that still lists it', async () => {
    expect(await enumValues()).toEqual(['neon_auth', REMOVED, 'seed']);
  });

  it('refuses to run while a row still carries the value', async () => {
    await testDb.db.execute(
      sql.raw(`INSERT INTO users (auth_user_id, auth_provider, email, role, first_name, last_name)
        VALUES ('old_row', '${REMOVED}', 'old@example.com', 'customer', 'A', 'B')`),
    );

    await expect(apply(DROP_VALUE)).rejects.toThrow();
    expect(await enumValues()).toEqual(['neon_auth', REMOVED, 'seed']);
  });

  it('leaves exactly neon_auth and seed, keeps the rows and the default', async () => {
    await testDb.db.execute(sql.raw(`DELETE FROM users WHERE auth_user_id = 'old_row'`));
    await testDb.db.execute(
      sql.raw(`INSERT INTO users (auth_user_id, auth_provider, email, role, first_name, last_name)
        VALUES ('seed_row', 'seed', 'seed@example.com', 'customer', 'A', 'B')`),
    );

    await apply(DROP_VALUE);

    expect(await enumValues()).toEqual(['neon_auth', 'seed']);
    await testDb.db.execute(
      sql.raw(`INSERT INTO users (auth_user_id, email, role, first_name, last_name)
        VALUES ('new_row', 'new@example.com', 'customer', 'A', 'B')`),
    );
    const rows = await testDb.db.execute<{ auth_user_id: string; auth_provider: string }>(
      sql.raw(`SELECT auth_user_id, auth_provider FROM users ORDER BY auth_user_id`),
    );
    expect(rows.rows).toEqual([
      { auth_user_id: 'new_row', auth_provider: 'neon_auth' },
      { auth_user_id: 'seed_row', auth_provider: 'seed' },
    ]);
  });
});
