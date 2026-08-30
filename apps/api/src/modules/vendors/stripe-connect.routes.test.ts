import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The payout-setup half of frame `08`: a vendor cannot be paid, and therefore
 * cannot accept a booking, until Stripe says both that money can reach their
 * account and that it can leave it again. Driven through the real routes rather
 * than the service, because the guard that keeps a customer out of a vendor's
 * payout state lives on the route.
 */
describe('vendor Stripe Connect onboarding', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function seedVendorProfile(user: string, businessName = 'First Light'): Promise<void> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(user),
      payload: {
        businessName,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: `${businessName} does good work.`,
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);
  }

  function connect(user: string) {
    return harness.app.inject({
      method: 'POST',
      url: '/vendor/stripe/connect',
      headers: bearer(user),
    });
  }

  function status(user: string) {
    return harness.app.inject({
      method: 'GET',
      url: '/vendor/stripe/status',
      headers: bearer(user),
    });
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
    harness.clerkUsers.set('customer_a', {
      clerkUserId: 'customer_a',
      email: 'customer_a@example.com',
      firstName: 'Test',
      lastName: 'Customer',
      roleHint: 'customer',
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
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('POST /vendor/stripe/connect', () => {
    it('creates the connected account on the first call and stores its id', async () => {
      await seedVendorProfile('vendor_a');

      const response = await connect('vendor_a');

      expect(response.statusCode).toBe(200);
      expect(response.json().url).toMatch(/^https:\/\/connect\.stripe\.test\/setup\//);
      expect(harness.stripe.createdAccounts).toHaveLength(1);
      expect(harness.stripe.createdAccounts[0]?.contactEmail).toBe('vendor_a@example.com');

      expect((await status('vendor_a')).json().stripeAccountId).toBe('acct_test_1');
    });

    it('reuses the account on a second call and issues a new link', async () => {
      await seedVendorProfile('vendor_a');

      const first = await connect('vendor_a');
      const second = await connect('vendor_a');

      // One account, two links — the shape three impatient clicks must produce.
      expect(harness.stripe.createdAccounts).toHaveLength(1);
      expect(harness.stripe.createdLinks).toHaveLength(2);
      expect(harness.stripe.createdLinks.map((link) => link.accountId)).toEqual([
        'acct_test_1',
        'acct_test_1',
      ]);
      expect(second.json().url).not.toBe(first.json().url);
    });

    it('sends Stripe back to the payments return and resume paths', async () => {
      await seedVendorProfile('vendor_a');

      await connect('vendor_a');

      expect(harness.stripe.createdLinks[0]?.returnUrl).toBe(
        'http://localhost:3000/vendor/payments/return',
      );
      expect(harness.stripe.createdLinks[0]?.refreshUrl).toBe(
        'http://localhost:3000/vendor/payments?resume=1',
      );
    });

    it('refuses a vendor who has not created a profile yet', async () => {
      const response = await connect('vendor_a');

      expect(response.statusCode).toBe(404);
      expect(harness.stripe.createdAccounts).toHaveLength(0);
    });

    it('refuses a customer, who has no payouts to set up', async () => {
      const response = await connect('customer_a');

      expect(response.statusCode).toBe(403);
      expect(harness.stripe.createdAccounts).toHaveLength(0);
    });

    it('refuses an unauthenticated caller', async () => {
      const response = await harness.app.inject({ method: 'POST', url: '/vendor/stripe/connect' });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /vendor/stripe/status', () => {
    it('reports a vendor who has never started as unstarted', async () => {
      await seedVendorProfile('vendor_a');

      const response = await status('vendor_a');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ stripeAccountId: null, stripeOnboarded: false });
    });

    it('never calls Stripe — the dashboard reads this on every render', async () => {
      await seedVendorProfile('vendor_a');
      await connect('vendor_a');

      let reads = 0;
      const realRead = harness.stripe.readAccountStatus;
      harness.stripe.readAccountStatus = async (accountId) => {
        reads += 1;
        return realRead(accountId);
      };

      const response = await status('vendor_a');
      harness.stripe.readAccountStatus = realRead;

      expect(response.statusCode).toBe(200);
      expect(reads).toBe(0);
    });

    it('refuses a customer', async () => {
      const response = await status('customer_a');

      expect(response.statusCode).toBe(403);
    });
  });
});
