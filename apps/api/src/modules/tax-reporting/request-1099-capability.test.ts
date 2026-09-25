import { categories, users, vendorCategories, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';
import { requestTaxCapabilityForVendors } from './request-1099-capability.js';

const OLD_VENDOR = 'user_cap_old';
const NEW_VENDOR = 'user_cap_new';
const NEVER_CONNECTED = 'user_cap_none';

/**
 * VEN-723 (D49): the one-off that asks Stripe to collect the tax ID and address
 * of every vendor account made before the capability was requested at creation.
 */
describe('requestTaxCapabilityForVendors', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function vendorWithAccount(authUserId: string, accountId: string | null): Promise<void> {
    await signInAs(harness, authUserId);
    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(authUserId),
      payload: {
        businessName: `Studio ${authUserId}`,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });

    expect(created.statusCode).toBe(201);
    await harness.database.db
      .update(vendorProfiles)
      .set({ stripeAccountId: accountId })
      .where(eq(vendorProfiles.id, created.json().id));
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const authUserId of [OLD_VENDOR, NEW_VENDOR, NEVER_CONNECTED]) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: 'vendor',
        avatarUrl: null,
      });
    }

    const [row] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = row!.id;
  });

  afterEach(async () => {
    harness.stripe.taxCapabilityAccounts.clear();
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('requests it on an account that lacks it, and a second run changes nothing', async () => {
    await vendorWithAccount(OLD_VENDOR, 'acct_cap_old');
    await vendorWithAccount(NEW_VENDOR, 'acct_cap_new');
    await vendorWithAccount(NEVER_CONNECTED, null);
    // The new vendor's account was made after the change, so it already carries the capability.
    harness.stripe.taxCapabilityAccounts.add('acct_cap_new');

    const first: string[] = [];
    const second: string[] = [];

    expect(
      await requestTaxCapabilityForVendors(harness.database.db, harness.stripe, (line) =>
        first.push(line),
      ),
    ).toEqual({ requested: 1, already: 1, failed: 0 });
    expect(
      await requestTaxCapabilityForVendors(harness.database.db, harness.stripe, (line) =>
        second.push(line),
      ),
    ).toEqual({ requested: 0, already: 2, failed: 0 });

    expect(first).toEqual(['acct_cap_old requested', 'acct_cap_new already']);
    expect(second).toEqual(['acct_cap_old already', 'acct_cap_new already']);
    expect([...harness.stripe.taxCapabilityAccounts].sort()).toEqual([
      'acct_cap_new',
      'acct_cap_old',
    ]);
  });

  it('reports an account Stripe refuses and carries on with the rest', async () => {
    await vendorWithAccount(OLD_VENDOR, 'acct_cap_refused');
    await vendorWithAccount(NEW_VENDOR, 'acct_cap_fine');

    const lines: string[] = [];
    const result = await requestTaxCapabilityForVendors(
      harness.database.db,
      {
        ensureTaxReportingCapability: async (accountId) => {
          if (accountId === 'acct_cap_refused') {
            throw new Error('No such account');
          }

          return harness.stripe.ensureTaxReportingCapability(accountId);
        },
      },
      (line) => lines.push(line),
    );

    expect(result).toEqual({ requested: 1, already: 0, failed: 1 });
    expect(lines).toEqual(['acct_cap_refused failed: No such account', 'acct_cap_fine requested']);
  });
});
