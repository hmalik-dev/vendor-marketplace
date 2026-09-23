import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { CURRENT_VENDOR_AGREEMENT_VERSION } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { StripeAccountStatus, StripeConnectGateway } from '../../lib/stripe.js';
import { applyAccountStatusChange } from './stripe-connect.service.js';
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
      url: '/v1/vendor/profile',
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
      url: '/v1/vendor/agreement/accept',
      headers: bearer(VENDOR),
      payload: { version: CURRENT_VENDOR_AGREEMENT_VERSION },
    });
    expect(agreed.statusCode).toBe(200);

    const responses = await Promise.all(
      [1, 2].map(() =>
        harness!.app.inject({
          method: 'POST',
          url: '/v1/vendor/stripe/connect',
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

const ACCOUNT_ID = 'acct_flipped_back';

const ONBOARDED: StripeAccountStatus = {
  transfersActive: true,
  payoutsActive: true,
  disabledReason: null,
  requirementsDue: [],
};

/** Stripe restricted the account after the read above was taken. */
const RESTRICTED: StripeAccountStatus = {
  transfersActive: false,
  payoutsActive: false,
  disabledReason: 'requirements.past_due',
  requirementsDue: ['external_account'],
};

/**
 * Handler A reads Stripe (onboarded) and stalls; Stripe then restricts the
 * account; handler B snapshots the row (still false), reads Stripe (restricted)
 * and finds nothing to write; A then writes true, and its compare-and-set still
 * matches (VEN-547). Only a read *after* A's write can put Stripe's latest
 * answer back.
 */
describe('a Connect flag written from a read Stripe has since overtaken, against a real Postgres', () => {
  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });
  });

  afterAll(async () => {
    await harness?.database.db.delete(vendorProfiles);
    await harness?.database.db.delete(users);
    await harness?.close();
    await database?.close();
  });

  it('ends with the row equal to the latest read', async () => {
    const db = harness!.database.db;
    const [owner] = await db
      .insert(users)
      .values({
        authUserId: 'user_flipped_back',
        email: 'flipped-back@example.com',
        role: 'vendor',
        firstName: 'Flip',
        lastName: 'Back',
      })
      .returning({ id: users.id });
    await db.insert(vendorProfiles).values({
      userId: owner!.id,
      businessName: 'Flipped Back Events',
      slug: 'flipped-back-events',
      stripeAccountId: ACCOUNT_ID,
      // Already what Stripe says, so B has nothing to write.
      stripeDisabledReason: RESTRICTED.disabledReason,
      stripeRequirementsDue: RESTRICTED.requirementsDue,
    });

    let releaseA!: (status: StripeAccountStatus) => void;
    const aRead = new Promise<StripeAccountStatus>((resolve) => {
      releaseA = resolve;
    });
    let reads = 0;
    const stripe = {
      readAccountStatus: () => {
        reads += 1;

        return reads === 1 ? aRead : Promise.resolve(RESTRICTED);
      },
    } as unknown as StripeConnectGateway;
    const deps = { db, stripe };

    const a = applyAccountStatusChange(deps, ACCOUNT_ID);
    await until(() => reads === 1);
    // B snapshots the row (false), reads Stripe (restricted) and writes nothing.
    expect(await applyAccountStatusChange(deps, ACCOUNT_ID)).toBe('unchanged');
    expect(reads).toBe(2);

    releaseA(ONBOARDED);
    // A's write stood for a moment; the confirming read put Stripe's answer back.
    expect(await a).toBe('unchanged');

    const [row] = await db.select().from(vendorProfiles);
    expect(row).toMatchObject({
      stripeOnboarded: false,
      stripeDisabledReason: 'requirements.past_due',
      stripeRequirementsDue: ['external_account'],
    });
    expect(reads).toBe(3);
  });
});

/** Holds until `done` is true; the wait is on the call count, not on a timer's length. */
async function until(done: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (done()) {
      return;
    }
    await new Promise((settle) => setTimeout(settle, 10));
  }

  throw new Error('The awaited read never started');
}
