import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  MIGRATIONS_FOLDER,
  refusalOf,
  type TestDatabase,
} from './testing/test-db.js';

/**
 * `0087` refuses to run over two live accounts whose addresses differ only by
 * case, and lowercases the rest; `0088` makes the address unique up to case,
 * requires it stored lowered, and turns the other party's history FKs to
 * `restrict` (VEN-649).
 *
 * `migrateUpTo` cannot replay `0077`, which grants on the migrator's own
 * schema, so the suite migrates to head. `0088` is asserted there; `0087` is
 * re-applied after putting back the two constraints it runs ahead of.
 */
const COLLISION_CHECK = '0087_users_email_case_collisions';

let testDb: TestDatabase;

async function apply(name: string) {
  const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${name}.sql`), 'utf8');
  for (const statement of body.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) {
      await testDb.db.execute(sql.raw(statement));
    }
  }
}

function run(statement: string) {
  return testDb.db.execute(sql.raw(statement));
}

function insertUser(authUserId: string, email: string, deleted = false) {
  return `INSERT INTO users (auth_user_id, email, role, first_name, last_name, deleted_at)
    VALUES ('${authUserId}', '${email}', 'customer', 'A', 'B', ${deleted ? 'now()' : 'NULL'})`;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
});

afterAll(async () => {
  await testDb.close();
});

describe('0088: one person is one account', () => {
  it('refuses an address stored with capitals', async () => {
    expect(await refusalOf(testDb.db, insertUser('mixed', 'Bob@example.com'))).toContain(
      'users_email_lowercase',
    );
  });

  it('refuses a second live account for the address, and lets a retired one share it', async () => {
    await run(insertUser('first', 'ada@example.com'));

    expect(await refusalOf(testDb.db, insertUser('again', 'ada@example.com'))).toContain(
      'users_email_key',
    );
    await run(insertUser('gone', 'ada@example.com', true));
  });

  it("makes a hard delete of a user refuse rather than wipe the other party's history", async () => {
    const actions = await testDb.db.execute<{ conname: string; confdeltype: string }>(
      sql.raw(`SELECT conname, confdeltype FROM pg_constraint
        WHERE conname IN ('conversations_customer_id_users_id_fk', 'messages_sender_id_users_id_fk',
          'reviews_reviewer_id_users_id_fk', 'review_tombstones_reviewer_id_users_id_fk')
        ORDER BY conname`),
    );

    expect(actions.rows).toEqual([
      { conname: 'conversations_customer_id_users_id_fk', confdeltype: 'r' },
      { conname: 'messages_sender_id_users_id_fk', confdeltype: 'r' },
      { conname: 'review_tombstones_reviewer_id_users_id_fk', confdeltype: 'r' },
      { conname: 'reviews_reviewer_id_users_id_fk', confdeltype: 'r' },
    ]);
  });
});

describe('0087: the collision check that runs first', () => {
  beforeAll(async () => {
    // The schema as it stood before 0088: a case-sensitive index and no CHECK.
    await run('DELETE FROM users');
    await run('ALTER TABLE users DROP CONSTRAINT users_email_lowercase');
    await run('DROP INDEX users_email_key');
    await run('CREATE UNIQUE INDEX users_email_key ON users (email) WHERE deleted_at IS NULL');
  });

  it('refuses to run over two live accounts that differ only by case, naming both', async () => {
    await run(insertUser('upper', 'Ada@Example.com'));
    await run(insertUser('lower', 'ada@example.com'));
    const ids = await testDb.db.execute<{ id: string }>(sql.raw('SELECT id FROM users'));

    // Drizzle wraps the failed statement; Postgres's own message is the cause.
    const refusal = await apply(COLLISION_CHECK).then(
      () => 'applied',
      (error: { cause?: Error }) => error.cause?.message ?? 'no cause',
    );

    expect(refusal).toContain('share an email address up to case');
    expect(ids.rows).toHaveLength(2);
    for (const { id } of ids.rows) {
      expect(refusal).toContain(id);
    }
  });

  it('runs once the collision is retired, lowering live and retired addresses alike', async () => {
    await run(`UPDATE users SET deleted_at = now() WHERE auth_user_id = 'upper'`);
    await run(insertUser('retired', 'Grace@Example.com', true));

    await apply(COLLISION_CHECK);

    const rows = await testDb.db.execute<{ auth_user_id: string; email: string }>(
      sql.raw('SELECT auth_user_id, email FROM users ORDER BY auth_user_id'),
    );
    expect(rows.rows).toEqual([
      { auth_user_id: 'lower', email: 'ada@example.com' },
      { auth_user_id: 'retired', email: 'grace@example.com' },
      { auth_user_id: 'upper', email: 'ada@example.com' },
    ]);
  });
});
