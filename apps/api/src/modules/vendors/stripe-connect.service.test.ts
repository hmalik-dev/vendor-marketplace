import { users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { StripeAccountStatus, StripeConnectGateway } from '../../lib/stripe.js';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { applyAccountStatusChange } from './stripe-connect.service.js';

const ACCOUNT_ID = 'acct_interleaved';

const ACTIVE: StripeAccountStatus = {
  transfersActive: true,
  payoutsActive: true,
  disabledReason: null,
  requirementsDue: [],
};

/** What Stripe answered before the last capability turned active. */
const STALE: StripeAccountStatus = {
  transfersActive: true,
  payoutsActive: false,
  disabledReason: 'requirements.past_due',
  requirementsDue: ['external_account'],
};

/** A promise settled from outside, so a test decides which read lands last. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

/**
 * Concurrent `account.updated` and `capability.updated` handlers each read
 * Stripe and then write the row, with nothing ordering the two. Stripe does not
 * order its events, so the read that resolves *last* is not the newest one.
 */
describe('applyAccountStatusChange under interleaved handlers', () => {
  let harness: TestHarness;

  async function readProfile(): Promise<typeof vendorProfiles.$inferSelect> {
    const rows = await harness.database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.stripeAccountId, ACCOUNT_ID));

    return rows[0]!;
  }

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  async function seedVendor(): Promise<void> {
    const [owner] = await harness.database.db
      .insert(users)
      .values({
        authUserId: 'user_interleaved',
        email: 'interleaved@example.com',
        role: 'vendor',
        firstName: 'Ines',
        lastName: 'Vale',
      })
      .returning({ id: users.id });

    await harness.database.db.insert(vendorProfiles).values({
      userId: owner!.id,
      businessName: 'Interleaved Events',
      slug: 'interleaved-events',
      stripeAccountId: ACCOUNT_ID,
    });
  }

  it('does not write an older read over a newer one', async () => {
    await seedVendor();

    const staleRead = deferred<StripeAccountStatus>();
    const reads: Array<Promise<StripeAccountStatus>> = [
      staleRead.promise,
      Promise.resolve(ACTIVE),
      Promise.resolve(ACTIVE),
    ];
    let calls = 0;
    const stripe = {
      readAccountStatus: () => reads[calls++] ?? Promise.resolve(ACTIVE),
    } as unknown as StripeConnectGateway;
    const deps = { db: harness.database.db, stripe };

    // A reads the row, then waits on Stripe: this is the slow, older read.
    const stale = applyAccountStatusChange(deps, ACCOUNT_ID);
    await new Promise((settle) => setTimeout(settle, 50));
    expect(calls).toBe(1);

    // B reads afterwards, sees every capability active, and writes it.
    expect(await applyAccountStatusChange(deps, ACCOUNT_ID)).toBe('onboarded');
    expect((await readProfile()).stripeOnboarded).toBe(true);

    // A's stale answer finally arrives and must not be written over B's.
    staleRead.resolve(STALE);
    const outcome = await stale;

    const row = await readProfile();
    expect(row.stripeOnboarded).toBe(true);
    expect(row.stripeDisabledReason).toBeNull();
    expect(row.stripeRequirementsDue).toEqual([]);
    /*
     * Not `not-onboarded`: the route pages the operator on that word, and the
     * vendor is onboarded. The loser re-reads Stripe and finds nothing to do.
     */
    expect(outcome).toBe('unchanged');
    expect(calls).toBe(3);
  });
});
