import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * Accounts v2 emits thin events: the notification says *that* an account
 * changed, never what it changed to. Every assertion here therefore checks that
 * the handler re-read the account and wrote what Stripe actually reports — a
 * handler that trusted the payload would pass a happy-path test and still be
 * wrong under out-of-order delivery.
 */
describe('POST /webhooks/stripe', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function seedOnboardingVendor(): Promise<string> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer('vendor_a'),
      payload: {
        businessName: 'First Light',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'First Light does good work.',
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);

    const connected = await harness.app.inject({
      method: 'POST',
      url: '/vendor/stripe/connect',
      headers: bearer('vendor_a'),
    });
    expect(connected.statusCode).toBe(200);

    return harness.stripe.createdAccounts[0]!.accountId;
  }

  async function post(signature = 'valid-signature') {
    return harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_test', object: 'v2.core.event' }),
    });
  }

  async function readOnboarded(): Promise<boolean> {
    const rows = await harness.database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.businessName, 'First Light'));

    return rows[0]!.stripeOnboarded;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    harness.clerkUsers.set('vendor_a', {
      clerkUserId: 'vendor_a',
      email: 'vendor_a@example.com',
      firstName: 'Test',
      lastName: 'Vendor',
      roleHint: 'vendor',
      avatarUrl: null,
    });

    const rows = await harness.database.db.select().from(categories);
    photographyId = rows.find((row) => row.slug === 'photography')!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.stripe.createdAccounts.length = 0;
    harness.stripe.createdLinks.length = 0;
    harness.stripe.accountStatuses.clear();
    harness.stripe.nextEvent = { type: 'v2.core.account.updated', accountId: null };
  });

  afterAll(async () => {
    await harness.close();
  });

  it('marks the vendor onboarded once both capabilities are active', async () => {
    const accountId = await seedOnboardingVendor();
    harness.stripe.accountStatuses.set(accountId, {
      transfersActive: true,
      payoutsActive: true,
    });
    harness.stripe.nextEvent = {
      type: 'v2.core.account[configuration.recipient].capability_status_updated',
      accountId,
    };

    const response = await post();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true, outcome: 'onboarded' });
    expect(await readOnboarded()).toBe(true);
  });

  it('leaves the vendor unonboarded when only transfers are active', async () => {
    const accountId = await seedOnboardingVendor();
    harness.stripe.accountStatuses.set(accountId, {
      transfersActive: true,
      payoutsActive: false,
    });
    harness.stripe.nextEvent = { type: 'v2.core.account.updated', accountId };

    const response = await post();

    expect(response.json()).toEqual({ received: true, outcome: 'unchanged' });
    expect(await readOnboarded()).toBe(false);
  });

  it('leaves the vendor unonboarded when only payouts are active', async () => {
    const accountId = await seedOnboardingVendor();
    harness.stripe.accountStatuses.set(accountId, {
      transfersActive: false,
      payoutsActive: true,
    });
    harness.stripe.nextEvent = { type: 'v2.core.account.updated', accountId };

    await post();

    expect(await readOnboarded()).toBe(false);
  });

  it('flips a previously onboarded vendor back when Stripe disables the account', async () => {
    const accountId = await seedOnboardingVendor();
    harness.stripe.accountStatuses.set(accountId, { transfersActive: true, payoutsActive: true });
    harness.stripe.nextEvent = { type: 'v2.core.account.updated', accountId };
    await post();
    expect(await readOnboarded()).toBe(true);

    // The account is restricted after the fact — a dispute, a lapsed document.
    harness.stripe.accountStatuses.set(accountId, { transfersActive: false, payoutsActive: false });
    const response = await post();

    expect(response.json()).toEqual({ received: true, outcome: 'not-onboarded' });
    expect(await readOnboarded()).toBe(false);
  });

  it('rejects an unsigned request without reading the account', async () => {
    const accountId = await seedOnboardingVendor();
    harness.stripe.accountStatuses.set(accountId, { transfersActive: true, payoutsActive: true });
    harness.stripe.nextEvent = { type: 'v2.core.account.updated', accountId };

    const response = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });

    expect(response.statusCode).toBe(401);
    expect(await readOnboarded()).toBe(false);
  });

  it('rejects a request whose signature does not verify', async () => {
    const accountId = await seedOnboardingVendor();
    harness.stripe.accountStatuses.set(accountId, { transfersActive: true, payoutsActive: true });
    harness.stripe.nextEvent = { type: 'v2.core.account.updated', accountId };

    const response = await post('forged-signature');

    expect(response.statusCode).toBe(401);
    expect(await readOnboarded()).toBe(false);
  });

  it('ignores an event for an account no vendor owns', async () => {
    await seedOnboardingVendor();
    harness.stripe.nextEvent = { type: 'v2.core.account.updated', accountId: 'acct_someone_else' };

    const response = await post();

    expect(response.json()).toEqual({ received: true, outcome: 'ignored' });
    expect(await readOnboarded()).toBe(false);
  });

  it('ignores an event that is not about an account', async () => {
    const accountId = await seedOnboardingVendor();
    harness.stripe.accountStatuses.set(accountId, { transfersActive: true, payoutsActive: true });
    harness.stripe.nextEvent = { type: 'v2.billing.meter.updated', accountId };

    const response = await post();

    expect(response.json()).toEqual({ received: true, outcome: 'ignored' });
    expect(await readOnboarded()).toBe(false);
  });

  it('is idempotent — a redelivered event changes nothing the second time', async () => {
    const accountId = await seedOnboardingVendor();
    harness.stripe.accountStatuses.set(accountId, { transfersActive: true, payoutsActive: true });
    harness.stripe.nextEvent = { type: 'v2.core.account.updated', accountId };

    expect((await post()).json().outcome).toBe('onboarded');
    expect((await post()).json().outcome).toBe('unchanged');
    expect(await readOnboarded()).toBe(true);
  });
});
