import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, refusalOf, type TestDatabase } from './testing/test-db.js';
import { legalAcceptances } from './schema/index.js';

/**
 * `legal_acceptances` is append-only, proved by attempting the writes rather
 * than by reading the DDL.
 *
 * Inspecting the schema would only prove that somebody wrote a trigger. What
 * has to hold is that an UPDATE and a DELETE actually fail against the engine
 * this ships on — and that the one delete that is legitimate, the cascade from
 * erasing the whole vendor account, still gets through. All three are
 * attempted here rather than read off the DDL.
 */
const USER = '44444444-4444-4444-8444-444444444444';
const VENDOR = '55555555-5555-4555-8555-555555555555';

let testDb: TestDatabase;

async function acceptanceCount(): Promise<number> {
  const result = await testDb.db.execute(
    sql.raw('SELECT count(*)::int AS n FROM legal_acceptances'),
  );

  return (result.rows[0] as unknown as { n: number }).n;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();

  await testDb.db.execute(
    sql.raw(`INSERT INTO users (id, clerk_user_id, email, role, first_name, last_name)
             VALUES ('${USER}', 'user_agreement', 'agreement@example.com', 'vendor', 'June', 'Harlow')`),
  );
  await testDb.db.execute(
    sql.raw(`INSERT INTO vendor_profiles (id, user_id, business_name, slug)
             VALUES ('${VENDOR}', '${USER}', 'June Harlow Photography', 'june-harlow')`),
  );
  await testDb.db.insert(legalAcceptances).values({
    vendorId: VENDOR,
    document: 'vendor_agreement',
    version: 'v1.0',
    acceptedByUserId: USER,
    acceptedByName: 'June Harlow',
    businessName: 'June Harlow Photography',
    ip: '203.0.113.7',
    userAgent: 'Mozilla/5.0',
  });
});

afterAll(async () => {
  await testDb.close();
});

describe('legal_acceptances is append-only', () => {
  it('accepts an insert, which is the only supported way it changes', async () => {
    expect(await acceptanceCount()).toBe(1);
  });

  it('refuses an update', async () => {
    const message = await refusalOf(
      testDb.db,
      `UPDATE legal_acceptances SET version = 'v9.9' WHERE vendor_id = '${VENDOR}'`,
    );

    expect(message).toContain('append-only');
    expect(message).toContain('UPDATE');
  });

  it('refuses a delete', async () => {
    const message = await refusalOf(
      testDb.db,
      `DELETE FROM legal_acceptances WHERE vendor_id = '${VENDOR}'`,
    );

    expect(message).toContain('append-only');
    expect(message).toContain('DELETE');
  });

  /**
   * The way out a row trigger never sees. `TRUNCATE` fires no `FOR EACH ROW`
   * trigger at all, so without a statement trigger the table could be emptied
   * by exactly the person this rule is written about.
   */
  it('refuses a truncate', async () => {
    const message = await refusalOf(testDb.db, 'TRUNCATE legal_acceptances');

    expect(message).toContain('append-only');
    expect(message).toContain('TRUNCATE');
  });

  /**
   * The way out that a test which never touches `search_path` cannot see.
   *
   * The trigger asks "is this vendor still here" by reading `vendor_profiles`.
   * A `SECURITY INVOKER` function resolves that name against the **caller's**
   * path, so an empty shadow table on the path makes the answer "no" for every
   * row and the guard waves the delete through — three statements, from any
   * role that can create a schema, and every acceptance record is gone while
   * the vendors are all still trading.
   *
   * The whole suite above ran on the default path and was green over this. It
   * is the reason `SET search_path` is on both functions rather than left to
   * convention.
   */
  it('refuses a delete made under a shadow schema', async () => {
    await testDb.db.execute(sql.raw('CREATE SCHEMA evil'));
    await testDb.db.execute(sql.raw('CREATE TABLE evil.vendor_profiles (id uuid)'));
    await testDb.db.execute(sql.raw('CREATE TABLE evil.users (id uuid)'));
    await testDb.db.execute(sql.raw('SET search_path = evil, public'));

    try {
      const message = await refusalOf(testDb.db, 'DELETE FROM public.legal_acceptances');

      expect(message).toContain('append-only');
    } finally {
      await testDb.db.execute(sql.raw('SET search_path = public'));
      await testDb.db.execute(sql.raw('DROP SCHEMA evil CASCADE'));
    }
  });

  it('leaves the row exactly as it was written', async () => {
    const [row] = await testDb.db.select().from(legalAcceptances);

    expect(row).toBeDefined();
    expect({
      version: row?.version,
      document: row?.document,
      acceptedByName: row?.acceptedByName,
      businessName: row?.businessName,
      ip: row?.ip,
    }).toEqual({
      version: 'v1.0',
      document: 'vendor_agreement',
      acceptedByName: 'June Harlow',
      businessName: 'June Harlow Photography',
      ip: '203.0.113.7',
    });
  });

  /**
   * A second acceptance of the same version does not overwrite the first —
   * acceptance 9. There is no unique key to collide on and no upsert path: the
   * table simply grows, and the newest row is the one a surface reads.
   */
  it('records a second acceptance of the same version as a second row', async () => {
    await testDb.db.insert(legalAcceptances).values({
      vendorId: VENDOR,
      document: 'vendor_agreement',
      version: 'v1.0',
      acceptedByUserId: USER,
      acceptedByName: 'June Harlow',
      businessName: 'June Harlow Photography',
    });

    expect(await acceptanceCount()).toBe(2);
  });

  /**
   * The exact shape of the rule: not "no deletes ever", but "no row leaves
   * while the vendor it is about is still here". Erasing the account takes the
   * acceptances with it, because an acceptance with no vendor behind it records
   * nothing — and that is the only delete that succeeds.
   */
  it('lets the cascade through when the whole vendor account is erased', async () => {
    expect(await acceptanceCount()).toBe(2);

    await testDb.db.execute(sql.raw(`DELETE FROM users WHERE id = '${USER}'`));

    expect(await acceptanceCount()).toBe(0);
  });
});
