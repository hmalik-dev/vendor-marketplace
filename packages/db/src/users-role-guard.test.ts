import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, refusalOf, type TestDatabase } from './testing/test-db.js';

/**
 * `users.role` changes only inside a transaction that names the admin-grant
 * setting, proved by attempting the writes against the engine rather than by
 * reading the DDL.
 */
const USER = '77777777-7777-4777-8777-777777777777';

let testDb: TestDatabase;

async function roleOf(): Promise<string> {
  const result = await testDb.db.execute(sql.raw(`SELECT role FROM users WHERE id = '${USER}'`));

  return (result.rows[0] as unknown as { role: string }).role;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
  await testDb.db.execute(
    sql.raw(`INSERT INTO users (id, auth_user_id, email, role, first_name, last_name)
             VALUES ('${USER}', 'user_role_guard', 'role-guard@example.com', 'customer', 'Rae', 'Guard')`),
  );
});

afterAll(async () => {
  await testDb.close();
});

describe('users.role guard', () => {
  it('refuses a plain UPDATE of the role and leaves the row as it was', async () => {
    const refusal = await refusalOf(
      testDb.db,
      `UPDATE users SET role = 'admin' WHERE id = '${USER}'`,
    );

    expect(refusal).toContain('users.role can only change through the operator grant path');
    expect(await roleOf()).toBe('customer');
  });

  it('refuses a role change bundled with another column update', async () => {
    await refusalOf(
      testDb.db,
      `UPDATE users SET role = 'vendor', first_name = 'Changed' WHERE id = '${USER}'`,
    );

    expect(await roleOf()).toBe('customer');
  });

  it('does not accept the request-identity settings as permission', async () => {
    await expect(
      testDb.db.transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL app.role = 'admin'`));
        await tx.execute(sql.raw(`SET LOCAL app.operator = 'true'`));
        await tx.execute(sql.raw(`UPDATE users SET role = 'admin' WHERE id = '${USER}'`));
      }),
    ).rejects.toThrow();

    expect(await roleOf()).toBe('customer');
  });

  it('does not accept the grant setting with any value but on', async () => {
    await expect(
      testDb.db.transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL app.operator_role_grant = 'off'`));
        await tx.execute(sql.raw(`UPDATE users SET role = 'admin' WHERE id = '${USER}'`));
      }),
    ).rejects.toThrow();

    expect(await roleOf()).toBe('customer');
  });

  it('permits a role change inside a transaction that sets the grant setting', async () => {
    await testDb.db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL app.operator_role_grant = 'on'`));
      await tx.execute(sql.raw(`UPDATE users SET role = 'admin' WHERE id = '${USER}'`));
    });

    expect(await roleOf()).toBe('admin');

    // The setting was transaction-local: the next plain UPDATE is refused again.
    await refusalOf(testDb.db, `UPDATE users SET role = 'customer' WHERE id = '${USER}'`);
    expect(await roleOf()).toBe('admin');
  });

  it('leaves an UPDATE that keeps the role, and its other columns, alone', async () => {
    await testDb.db.execute(
      sql.raw(`UPDATE users SET first_name = 'Renamed', role = 'admin' WHERE id = '${USER}'`),
    );

    const result = await testDb.db.execute(
      sql.raw(`SELECT first_name FROM users WHERE id = '${USER}'`),
    );

    expect((result.rows[0] as unknown as { first_name: string }).first_name).toBe('Renamed');
  });

  it('leaves INSERT alone for every role', async () => {
    await testDb.db.execute(
      sql.raw(`INSERT INTO users (auth_user_id, email, role, first_name, last_name)
               VALUES ('user_ins_v', 'ins-v@example.com', 'vendor', 'V', 'V'),
                      ('user_ins_c', 'ins-c@example.com', 'customer', 'C', 'C')`),
    );

    const result = await testDb.db.execute(
      sql.raw(`SELECT count(*)::int AS n FROM users WHERE auth_user_id LIKE 'user_ins_%'`),
    );

    expect((result.rows[0] as unknown as { n: number }).n).toBe(2);
  });
});
