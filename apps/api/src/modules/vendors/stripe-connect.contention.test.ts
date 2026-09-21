import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { CURRENT_VENDOR_AGREEMENT_VERSION } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

/**
 * Two "Connect payouts" presses in flight at once, on a real Postgres (VEN-526).
 * The stub gateway answers a repeated idempotency key with the account it
 * already made, as Stripe does, so one effective account means both calls sent
 * the same key.
 */
describe('starting payout onboarding twice at once, against a real Postgres', () => {
  const VENDOR = 'user_vendor_connect_race';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });
    harness.authUsers.set(VENDOR, {
      authUserId: VENDOR,
      email: `${VENDOR}@example.com`,
      firstName: 'Test',
      lastName: 'Vendor',
      roleHint: 'vendor',
      avatarUrl: null,
    });
    await signInAs(harness, VENDOR);
  });

  beforeEach(async () => {
    await harness!.database.db.delete(vendorProfiles);
    harness!.stripe.createdAccounts.length = 0;
    harness!.stripe.recipientAccountKeys.length = 0;
    harness!.stripe.createdLinks.length = 0;
  });

  afterAll(async () => {
    await harness?.database.db.delete(users);
    await harness?.close();
    await database?.close();
  });

  it('creates one Stripe account, and both links target it', async () => {
    const [photography] = await harness!.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    const profile = await harness!.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Fernbank Studio',
        categoryIds: [photography!.id],
        city: 'Austin',
        state: 'TX',
        bio: 'Fernbank Studio photographs weddings across central Texas.',
        responseTimeHours: 24,
      },
    });
    expect(profile.statusCode).toBe(201);
    const agreed = await harness!.app.inject({
      method: 'POST',
      url: '/vendor/agreement/accept',
      headers: bearer(VENDOR),
      payload: { version: CURRENT_VENDOR_AGREEMENT_VERSION },
    });
    expect(agreed.statusCode).toBe(200);

    const responses = await Promise.all(
      [1, 2].map(() =>
        harness!.app.inject({
          method: 'POST',
          url: '/vendor/stripe/connect',
          headers: bearer(VENDOR),
        }),
      ),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const vendorId = profile.json().id;
    expect(harness!.stripe.recipientAccountKeys).toEqual([
      `recipient-account:${vendorId}:0`,
      `recipient-account:${vendorId}:0`,
    ]);
    expect(harness!.stripe.createdAccounts).toHaveLength(1);

    const [stored] = await harness!.database.db.select().from(vendorProfiles);
    expect(stored!.stripeAccountId).toBe('acct_test_1');
    expect(harness!.stripe.createdLinks.map((link) => link.accountId)).toEqual([
      'acct_test_1',
      'acct_test_1',
    ]);
  });
});
