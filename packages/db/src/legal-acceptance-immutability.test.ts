import { eq, sql } from 'drizzle-orm';
import { legalDocumentSha256 } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, refusalOf, type TestDatabase } from './testing/test-db.js';
import { legalAcceptances } from './schema/index.js';

/**
 * `legal_acceptances` is append-only, proved by attempting the writes rather
 * than by reading the DDL.
 *
 * Inspecting the schema would only prove that somebody wrote a trigger. What
 * has to hold is that an UPDATE and a DELETE actually fail against the engine
 * this ships on — and that the deletes that are legitimate, the cascades from
 * erasing an account or a vendor profile, still get through.
 *
 * **#429 moved the anchor from the vendor to the user, and the rule with it.**
 * A Terms acceptance carries `vendor_id IS NULL`, and the old discriminator —
 * "no vendor exists with `OLD.vendor_id`" — is true of every such row. So the
 * customer-side tests below are not extra coverage of the same rule: they are
 * the cases where the previous rule silently permitted a direct delete of the
 * one record this table exists to keep.
 */
const VENDOR_USER = '44444444-4444-4444-8444-444444444444';
const VENDOR = '55555555-5555-4555-8555-555555555555';
const CUSTOMER_USER = '66666666-6666-4666-8666-666666666666';

/*
 * Whatever a writer would actually send. These are inputs to an insert, not the
 * subject of any assertion here — the subject is what the table refuses — so
 * they come from the manifest rather than being pinned, and a version bump does
 * not leave a stale literal behind.
 */
const AGREEMENT_SHA = legalDocumentSha256('vendor_agreement');
const TERMS_SHA = legalDocumentSha256('terms_of_service');

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
             VALUES ('${VENDOR_USER}', 'user_agreement', 'agreement@example.com', 'vendor', 'June', 'Harlow'),
                    ('${CUSTOMER_USER}', 'user_terms', 'terms@example.com', 'customer', 'Ada', 'Reyes')`),
  );
  await testDb.db.execute(
    sql.raw(`INSERT INTO vendor_profiles (id, user_id, business_name, slug)
             VALUES ('${VENDOR}', '${VENDOR_USER}', 'June Harlow Photography', 'june-harlow')`),
  );
  await testDb.db.insert(legalAcceptances).values({
    vendorId: VENDOR,
    document: 'vendor_agreement',
    version: 'v1.0',
    documentSha256: AGREEMENT_SHA,
    acceptanceMethod: 'clickwrap_checkbox',
    acceptedByUserId: VENDOR_USER,
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

  /**
   * The shape that had nowhere to go before #429: a customer accepting the
   * Terms on behalf of nobody. `business_name` is null rather than `''`,
   * because an empty string in that column is a claim about a business rather
   * than the absence of one.
   */
  it('records a Terms acceptance with no vendor and no business name', async () => {
    await testDb.db.insert(legalAcceptances).values({
      vendorId: null,
      document: 'terms_of_service',
      version: 'v1.0',
      documentSha256: TERMS_SHA,
      acceptanceMethod: 'clickwrap_checkbox',
      acceptedByUserId: CUSTOMER_USER,
      acceptedByName: 'Ada Reyes',
      businessName: null,
      ip: '198.51.100.4',
      userAgent: 'Mozilla/5.0',
    });

    const [row] = await testDb.db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.acceptedByUserId, CUSTOMER_USER));

    expect({
      document: row?.document,
      vendorId: row?.vendorId,
      businessName: row?.businessName,
      documentSha256: row?.documentSha256,
      acceptanceMethod: row?.acceptanceMethod,
      acceptedByName: row?.acceptedByName,
      ip: row?.ip,
    }).toEqual({
      document: 'terms_of_service',
      vendorId: null,
      businessName: null,
      documentSha256: TERMS_SHA,
      acceptanceMethod: 'clickwrap_checkbox',
      acceptedByName: 'Ada Reyes',
      ip: '198.51.100.4',
    });
  });

  it('refuses an update', async () => {
    const message = await refusalOf(
      testDb.db,
      `UPDATE legal_acceptances SET version = 'v9.9' WHERE vendor_id = '${VENDOR}'`,
    );

    expect(message).toContain('append-only');
    expect(message).toContain('UPDATE');
  });

  /** The same refusal on the row whose `vendor_id` is null. */
  it('refuses an update of a Terms row', async () => {
    const message = await refusalOf(
      testDb.db,
      `UPDATE legal_acceptances SET document_sha256 = '${AGREEMENT_SHA}' WHERE vendor_id IS NULL`,
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
   * **The case the nullable column opened.**
   *
   * `0029` allowed a delete when no vendor existed with `OLD.vendor_id`, and a
   * null names no vendor — so every Terms row satisfied it. This assertion is
   * the difference between a customer's acceptance being a record and being a
   * row anybody with a psql prompt can drop.
   */
  it('refuses a direct delete of a Terms row whose vendor_id is null', async () => {
    const message = await refusalOf(
      testDb.db,
      'DELETE FROM legal_acceptances WHERE vendor_id IS NULL',
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
   * The trigger asks "is this person still here" by reading `users`, and "is
   * this vendor still here" by reading `vendor_profiles`. A `SECURITY INVOKER`
   * function resolves those names against the **caller's** path, so empty
   * shadow tables on the path make both answers "no" for every row and the
   * guard waves the delete through — three statements, from any role that can
   * create a schema, and every acceptance record is gone.
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
    const [row] = await testDb.db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.vendorId, VENDOR));

    expect(row).toBeDefined();
    expect({
      version: row?.version,
      document: row?.document,
      acceptedByName: row?.acceptedByName,
      businessName: row?.businessName,
      documentSha256: row?.documentSha256,
      acceptanceMethod: row?.acceptanceMethod,
      ip: row?.ip,
    }).toEqual({
      version: 'v1.0',
      document: 'vendor_agreement',
      acceptedByName: 'June Harlow',
      businessName: 'June Harlow Photography',
      documentSha256: AGREEMENT_SHA,
      acceptanceMethod: 'clickwrap_checkbox',
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
      documentSha256: AGREEMENT_SHA,
      acceptanceMethod: 'clickwrap_checkbox',
      acceptedByUserId: VENDOR_USER,
      acceptedByName: 'June Harlow',
      businessName: 'June Harlow Photography',
    });

    expect(await acceptanceCount()).toBe(3);
  });

  /**
   * Branch 2 of the rule, unchanged from `0029` in behaviour: erasing the
   * vendor profile takes the acceptances made on its behalf, because an
   * agreement with no vendor behind it records nothing about anybody.
   *
   * The vendor's own **Terms** acceptance is a different row about a person who
   * is still here, so it survives — which is the whole reason the two branches
   * ask different questions.
   */
  it('lets the cascade through when the vendor profile is erased, and keeps that person’s Terms row', async () => {
    await testDb.db.insert(legalAcceptances).values({
      vendorId: null,
      document: 'terms_of_service',
      version: 'v1.0',
      documentSha256: TERMS_SHA,
      acceptanceMethod: 'clickwrap_checkbox',
      acceptedByUserId: VENDOR_USER,
      acceptedByName: 'June Harlow',
      businessName: null,
    });

    expect(await acceptanceCount()).toBe(4);

    await testDb.db.execute(sql.raw(`DELETE FROM vendor_profiles WHERE id = '${VENDOR}'`));

    const remaining = await testDb.db.select().from(legalAcceptances);

    expect(remaining.map((row) => `${row.document}:${row.acceptedByUserId}`).sort()).toEqual(
      [`terms_of_service:${VENDOR_USER}`, `terms_of_service:${CUSTOMER_USER}`].sort(),
    );
  });

  /**
   * Branch 1: the person is erased. `accepted_by_user_id` is `ON DELETE
   * CASCADE`, so this is the delete the rule has to *permit* rather than one it
   * merely tolerates — refusing it would make erasing an account impossible
   * instead of making the record safer.
   */
  it('lets the cascade through when the person is erased', async () => {
    await testDb.db.execute(sql.raw(`DELETE FROM users WHERE id = '${CUSTOMER_USER}'`));
    await testDb.db.execute(sql.raw(`DELETE FROM users WHERE id = '${VENDOR_USER}'`));

    expect(await acceptanceCount()).toBe(0);
  });
});
