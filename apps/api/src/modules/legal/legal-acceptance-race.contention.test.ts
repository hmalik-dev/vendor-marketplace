import { eq, inArray } from 'drizzle-orm';
import {
  categories,
  legalAcceptances,
  users,
  vendorApplications,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  CURRENT_TERMS_VERSION,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  legalDocumentSha256,
} from '@vendor-marketplace/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { findLatestAcceptance, insertAcceptance } from './legal-acceptance.dao.js';
import type { NewAcceptance } from './legal-acceptance.dao.js';

/**
 * Several acceptances of one document arriving at once, on a **real** Postgres.
 *
 * Both writers read whether the person already holds the version and return
 * early when they do — `acceptTerms` and `acceptVendorAgreement`, each under
 * the comment *"Already held: answer, do not write"*. That read is a
 * check-then-insert, so submissions racing from one session all read *not held*
 * and all insert, into the one table a trigger makes permanent: the duplicates
 * cannot be tidied up afterwards, and the window reopens at every version bump
 * (#442, D38).
 *
 * **PGlite cannot see this.** It is a single connection and runs each request
 * to completion before the next begins, so a `Promise.all` there passes whether
 * or not anything holds the invariant. The whole subject is two connections
 * reaching one row, so it runs here — against
 * `legal_acceptances_user_document_version_key` itself, never a mock of it.
 *
 * `acceptTerms: false`, because an un-accepted account is the starting state
 * every case here races from.
 */
describe('several acceptances of one document at once, against a real Postgres', () => {
  /**
   * Submissions fired at once. Two is the smallest race and it is not the most
   * honest one: the window between the read and the insert is a few
   * milliseconds wide, so a pair often misses it and the case then passes with
   * the index deleted — a guard that cannot fail is not a guard. Eight closes
   * it reliably. Measured with the index removed: two submissions left one row
   * on the vendor path, eight left **eight**.
   */
  const CONCURRENT = 8;

  const CUSTOMER = 'race_terms_customer';
  const VENDOR = 'race_agreement_vendor';

  let database!: PostgresTestDatabase;
  let harness!: TestHarness<PostgresTestDatabase>;
  let photographyId: string;

  function acceptTermsRequest(role: 'customer' | 'vendor' = 'customer', as = CUSTOMER) {
    return harness.app.inject({
      method: 'POST',
      url: '/legal/terms/accept',
      headers: bearer(as),
      payload: { version: CURRENT_TERMS_VERSION, accepted: true, role },
    });
  }

  function acceptAgreementRequest() {
    return harness.app.inject({
      method: 'POST',
      url: '/vendor/agreement/accept',
      headers: bearer(VENDOR),
      payload: { version: CURRENT_VENDOR_AGREEMENT_VERSION },
    });
  }

  function rowsOf(document: 'terms_of_service' | 'vendor_agreement') {
    return harness.database.db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.document, document));
  }

  /** The account row a sign-in would have written, for a suite that has no gate. */
  async function seedUser(authUserId: string, role: 'customer' | 'vendor'): Promise<string> {
    const [row] = await harness.database.db
      .insert(users)
      .values({
        authUserId,
        email: `${authUserId}@example.com`,
        role,
        firstName: 'Ada',
        lastName: 'Reyes',
      })
      .returning({ id: users.id });

    return row!.id;
  }

  /** One Terms acceptance, assembled once for the cases that write one. */
  function termsRow(userId: string, version = CURRENT_TERMS_VERSION): NewAcceptance {
    return {
      vendorId: null,
      document: 'terms_of_service',
      version,
      documentSha256: legalDocumentSha256('terms_of_service'),
      acceptanceMethod: 'clickwrap_checkbox',
      acceptedByUserId: userId,
      acceptedByName: 'Ada Reyes',
      businessName: null,
      ip: null,
      userAgent: null,
    };
  }

  /**
   * The vendor needs an account, its Terms row and a profile before the
   * agreement route is reachable at all. The Terms row goes through the DAO
   * rather than the accept route — the route is the subject of the other half
   * of this file, and setup that runs through the subject proves nothing.
   */
  async function seedVendorWithProfile(): Promise<void> {
    const userId = await seedUser(VENDOR, 'vendor');

    await insertAcceptance(harness.database.db, {
      ...termsRow(userId),
      acceptanceMethod: 'seed_fixture',
      acceptedByName: 'June Harlow',
    });

    const profile = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'June Harlow Photography',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'June Harlow photographs weddings across central Texas.',
        responseTimeHours: 24,
      },
    });

    expect(profile.statusCode).toBe(201);
  }

  beforeAll(async () => {
    // Four connections, so the requests are genuinely in flight at once.
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database, acceptTerms: false });

    for (const [authUserId, role] of [
      [CUSTOMER, 'customer'],
      [VENDOR, 'vendor'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Ada',
        lastName: 'Reyes',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    photographyId = photography!.id;
  });

  beforeEach(async () => {
    // The acceptances go with the account; the table refuses a direct delete.
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.database.db.delete(users);
    await harness.close();
    await database.close();
  });

  /**
   * Acceptance 1. The ruling being enforced is the one both services already
   * state: **one row per person, per document, per version.** Two rows here is
   * the defect, and it is unrepairable — nothing can delete either of them.
   */
  it('writes one Terms row however many acceptances arrive at once, and answers them all', async () => {
    const answers = await Promise.all(
      Array.from({ length: CONCURRENT }, () => acceptTermsRequest()),
    );

    expect(answers.map((answer) => answer.statusCode)).toEqual(Array(CONCURRENT).fill(200));
    expect(answers.map((answer) => answer.json().accepted)).toEqual(Array(CONCURRENT).fill(true));
    expect(await rowsOf('terms_of_service')).toHaveLength(1);
    // Exactly one account, too: this path creates the `users` row as it writes.
    expect(await harness.database.db.select().from(users)).toHaveLength(1);
  });

  /**
   * VEN-507 acceptance 4: two tabs for one new identity, one choosing
   * `customer` and one `vendor`. Whichever insert commits first stores its role
   * and the other reads it back: one `users` row, one acceptance, both answers
   * naming the **same** stored role, and no 500 from the loser's conflict.
   * Alternated so neither role is favoured by the request order.
   */
  it('stores one role when two tabs choose different ones, and both answers report it', async () => {
    const answers = await Promise.all(
      Array.from({ length: CONCURRENT }, (_, i) =>
        acceptTermsRequest(i % 2 ? 'vendor' : 'customer'),
      ),
    );

    expect(answers.map((answer) => answer.statusCode)).toEqual(Array(CONCURRENT).fill(200));
    const accounts = await harness.database.db.select().from(users);
    expect(accounts).toHaveLength(1);
    expect(await rowsOf('terms_of_service')).toHaveLength(1);
    expect(answers.map((answer) => answer.json().account)).toEqual(
      Array(CONCURRENT).fill({ exists: true, role: accounts[0]!.role }),
    );
  });

  /**
   * Acceptance 2. The identical shape has been live on the vendor agreement
   * since #427, so the losing insert has to lose the same way here — **200 and
   * one row**, not the 23505 that would surface as a 500 on the endpoint that
   * records a legal acceptance.
   */
  it('writes one agreement row however many acceptances arrive at once, and answers them all', async () => {
    await seedVendorWithProfile();

    const answers = await Promise.all(Array.from({ length: CONCURRENT }, acceptAgreementRequest));

    expect(answers.map((answer) => answer.statusCode)).toEqual(Array(CONCURRENT).fill(200));
    expect(answers.map((answer) => answer.json().isCurrent)).toEqual(Array(CONCURRENT).fill(true));
    expect(await rowsOf('vendor_agreement')).toHaveLength(1);
  });

  /**
   * Acceptance 3. The version is **in** the key, so re-accepting after a bump
   * still writes — the case the append-only table exists for, and the one a key
   * of `(user, document)` alone would have closed for ever.
   */
  it('still writes a row when the version changes', async () => {
    const userId = await seedUser(CUSTOMER, 'customer');

    const held = await insertAcceptance(harness.database.db, termsRow(userId));
    const bumped = await insertAcceptance(harness.database.db, termsRow(userId, 'v9.9'));

    expect(held?.version).toBe(CURRENT_TERMS_VERSION);
    expect(bumped?.version).toBe('v9.9');
    expect(await rowsOf('terms_of_service')).toHaveLength(2);
  });

  /**
   * The half of the key that is easy to get wrong, and the case that pins
   * `insertAcceptance` answering `null` rather than throwing.
   *
   * `vendor_id` is left out of the key, so a Terms row's `null` there never
   * makes one row distinct from another — every column of the index is
   * `NOT NULL`, and Postgres's rule that nulls are distinct in a unique index
   * simply does not reach it. Asserted by attempting the second write rather
   * than by reading the DDL: a key that carried `vendor_id` would leave this
   * insert succeeding, and the writer with the most traffic unprotected.
   */
  it('declines the second Terms row for one person, null vendor and all', async () => {
    const userId = await seedUser(CUSTOMER, 'customer');

    expect(await insertAcceptance(harness.database.db, termsRow(userId))).not.toBeNull();
    expect(await insertAcceptance(harness.database.db, termsRow(userId))).toBeNull();

    const held = await findLatestAcceptance(harness.database.db, userId, 'terms_of_service');

    expect(held?.version).toBe(CURRENT_TERMS_VERSION);
    expect(await rowsOf('terms_of_service')).toHaveLength(1);
  });

  /**
   * VEN-514's draft profile. `createDraftVendorProfile` checks `slugExists`
   * and inserts inside a `tx.transaction()` savepoint, caught around the whole
   * write, precisely so a lost race on `vendor_profiles_slug_key` cannot take
   * the surrounding `acceptTerms` transaction — the one that creates the
   * `users` row and writes the acceptance — down with it. Two different
   * vendors whose applications name the same business name compute the same
   * base slug, so accepting at once is the one scenario that can actually make
   * that insert fail after the check passed. **PGlite cannot see this**: one
   * connection runs each request's statements to completion before the next
   * begins, so the check and the insert never truly interleave there — the
   * race, and the savepoint it needs, only exist on a second connection.
   */
  describe('the draft profile two vendors race for', () => {
    const VENDOR_A = 'race_draft_vendor_a';
    const VENDOR_B = 'race_draft_vendor_b';

    beforeAll(() => {
      for (const authUserId of [VENDOR_A, VENDOR_B]) {
        harness.authUsers.set(authUserId, {
          authUserId,
          email: `${authUserId}@example.com`,
          firstName: 'Ada',
          lastName: 'Reyes',
          roleHint: 'vendor',
          avatarUrl: null,
        });
      }
    });

    beforeEach(async () => {
      await harness.database.db.delete(vendorApplications);
    });

    async function application(authUserId: string): Promise<void> {
      await harness.database.db.insert(vendorApplications).values({
        email: `${authUserId}@example.com`,
        businessName: 'Ada Photography',
        category: photographyId,
        city: 'Austin',
        state: 'TX',
        status: 'new',
      });
    }

    it('creates both accounts, with no crossed slug, when two same-named applications accept at once', async () => {
      await Promise.all([application(VENDOR_A), application(VENDOR_B)]);

      const answers = await Promise.all(
        [VENDOR_A, VENDOR_B].map((as) =>
          harness.app.inject({
            method: 'POST',
            url: '/legal/terms/accept',
            headers: bearer(as),
            payload: { version: CURRENT_TERMS_VERSION, accepted: true, role: 'vendor' },
          }),
        ),
      );

      // Neither request may 500: a lost slug race is the draft's problem to
      // swallow, never the account's or the acceptance's to fail on.
      expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200]);

      const accounts = await harness.database.db
        .select()
        .from(users)
        .where(inArray(users.email, [`${VENDOR_A}@example.com`, `${VENDOR_B}@example.com`]));
      expect(accounts).toHaveLength(2);
      expect(await rowsOf('terms_of_service')).toHaveLength(2);

      const profiles = await harness.database.db
        .select()
        .from(vendorProfiles)
        .where(
          inArray(
            vendorProfiles.userId,
            accounts.map((row) => row.id),
          ),
        );

      // Whichever of the two builds wins the slug, and whichever loses it and
      // is swallowed, no two rows ever share one.
      expect(new Set(profiles.map((row) => row.slug)).size).toBe(profiles.length);
    });
  });
});
