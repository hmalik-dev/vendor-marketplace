import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, refusalOf, type TestDatabase } from './testing/test-db.js';
import { adminActions } from './schema/index.js';

/**
 * `admin_actions` is append-only, proved by attempting the writes rather than
 * by reading the DDL — acceptance 2 of #434.
 *
 * Inspecting the schema would only prove that somebody wrote a trigger. What
 * has to hold is that an UPDATE, a DELETE and a TRUNCATE actually fail against
 * the engine this ships on, and that the one delete that is legitimate — the
 * cascade from erasing the operator's whole account — still gets through. All
 * four are attempted here.
 *
 * The same shape as `legal-acceptance-immutability.test.ts`, deliberately: this
 * table copies `0029_sad_storm.sql`'s rule, so it copies its proof.
 */
const ACTOR = '66666666-6666-4666-8666-666666666666';
const SUBJECT = '77777777-7777-4777-8777-777777777777';

let testDb: TestDatabase;

async function actionCount(): Promise<number> {
  const result = await testDb.db.execute(sql.raw('SELECT count(*)::int AS n FROM admin_actions'));

  return (result.rows[0] as unknown as { n: number }).n;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();

  await testDb.db.execute(
    sql.raw(`INSERT INTO users (id, clerk_user_id, email, role, first_name, last_name)
             VALUES ('${ACTOR}', 'user_operator', 'operator@example.com', 'admin', 'Dana', 'Okafor')`),
  );
  await testDb.db.insert(adminActions).values({
    actorId: ACTOR,
    action: 'user_banned',
    subjectType: 'user',
    subjectId: SUBJECT,
    detail: { refundsIssued: 2, refundsFailed: 0 },
  });
});

afterAll(async () => {
  await testDb.close();
});

describe('admin_actions is append-only', () => {
  it('accepts an insert, which is the only supported way it changes', async () => {
    expect(await actionCount()).toBe(1);
  });

  it('refuses an update', async () => {
    const message = await refusalOf(
      testDb.db,
      `UPDATE admin_actions SET action = 'user_unbanned' WHERE actor_id = '${ACTOR}'`,
    );

    expect(message).toContain('append-only');
    expect(message).toContain('UPDATE');
    expect(await actionCount()).toBe(1);
  });

  it('refuses a delete while the operator it names is still here', async () => {
    const message = await refusalOf(
      testDb.db,
      `DELETE FROM admin_actions WHERE actor_id = '${ACTOR}'`,
    );

    expect(message).toContain('append-only');
    expect(message).toContain('DELETE');
    expect(await actionCount()).toBe(1);
  });

  /**
   * The way out a row trigger never sees. `TRUNCATE` fires no `FOR EACH ROW`
   * trigger at all, so without a statement trigger the table could be emptied
   * by exactly the person this rule is written about.
   */
  it('refuses a truncate', async () => {
    const message = await refusalOf(testDb.db, 'TRUNCATE admin_actions');

    expect(message).toContain('append-only');
    expect(message).toContain('TRUNCATE');
    expect(await actionCount()).toBe(1);
  });

  /**
   * The way out that a test which never touches `search_path` cannot see.
   *
   * The trigger asks "is this operator still here" by reading `users`. A
   * `SECURITY INVOKER` function resolves that name against the **caller's**
   * path, so an empty shadow table on the path makes the answer "no" for every
   * row and the guard waves the delete through — three statements, from any
   * role that can create a schema, and the whole record of what the console did
   * is gone while every operator is still serving.
   *
   * Every test above ran on the default path and is green either way. This is
   * the reason `SET search_path` is on both functions rather than left to
   * convention.
   */
  it('refuses a delete made under a shadow schema', async () => {
    await testDb.db.execute(sql.raw('CREATE SCHEMA evil'));
    await testDb.db.execute(sql.raw('CREATE TABLE evil.users (id uuid)'));
    await testDb.db.execute(sql.raw('SET search_path = evil, public'));

    try {
      const message = await refusalOf(testDb.db, 'DELETE FROM public.admin_actions');

      expect(message).toContain('append-only');
    } finally {
      await testDb.db.execute(sql.raw('SET search_path = public'));
      await testDb.db.execute(sql.raw('DROP SCHEMA evil CASCADE'));
    }

    expect(await actionCount()).toBe(1);
  });

  it('leaves the row exactly as it was written', async () => {
    const [row] = await testDb.db.select().from(adminActions);

    expect(row).toBeDefined();
    expect({
      actorId: row?.actorId,
      action: row?.action,
      subjectType: row?.subjectType,
      subjectId: row?.subjectId,
      detail: row?.detail,
    }).toEqual({
      actorId: ACTOR,
      action: 'user_banned',
      subjectType: 'user',
      subjectId: SUBJECT,
      detail: { refundsIssued: 2, refundsFailed: 0 },
    });
  });

  /**
   * The subject is the thing most likely to be deleted next, and the record has
   * to survive it — which is why `subject_id` carries no foreign key.
   *
   * Written as a `users` row here because that is the shape a ban records: the
   * banned account can later be erased, and the evidence that it was banned
   * must not go with it. The row above already names `SUBJECT` and nothing in
   * `users` has ever backed that id, which is exactly the point.
   */
  it('keeps a row whose subject does not exist', async () => {
    const rows = await testDb.db.select().from(adminActions);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.subjectId).toBe(SUBJECT);
  });

  /**
   * The one delete the rule allows, and the last test because it empties the
   * table: erasing the operator's whole account takes their rows with it,
   * because a recorded action with nobody behind it names nobody.
   *
   * Unreachable from the product — a `users` row is retired via `deleted_at`
   * rather than removed — so this proves the exception is exact rather than
   * that anything uses it.
   */
  it('lets the cascade through when the operator account itself is erased', async () => {
    await testDb.db.execute(sql.raw(`DELETE FROM users WHERE id = '${ACTOR}'`));

    expect(await actionCount()).toBe(0);
  });
});
