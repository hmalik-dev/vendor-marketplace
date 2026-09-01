import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  reviews,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { addDays, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const OTHER_VENDOR = 'user_vendor_two';
const CUSTOMER = 'user_customer';
const OTHER_CUSTOMER = 'user_customer_two';

const EVENT_DATE = toDateString(addDays(new Date(), 30));

interface ProfileBody {
  visibility: 'limited' | 'full';
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  completionRate: number | null;
  totalBookingsCount: number;
  recentReviews: { rating: number; vendorBusinessName: string }[];
}

describe('/customers', () => {
  let harness: TestHarness;
  let photographyId: string;

  /**
   * The local row is created lazily on the identity's first authenticated
   * request, so this makes one rather than assuming the row is already there.
   */
  async function idOf(clerkUserId: string): Promise<string> {
    const me = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(clerkUserId),
    });
    expect(me.statusCode).toBe(200);

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId));

    return rows[0]!.id;
  }

  async function createVendor(
    clerkUserId: string,
    businessName: string,
  ): Promise<{ vendorId: string; packageId: string }> {
    const profile = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(clerkUserId),
      payload: {
        businessName,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
      },
    });
    expect(profile.statusCode).toBe(201);
    const vendorId: string = profile.json().id;

    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(clerkUserId),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
        priceType: 'fixed',
        inclusions: ['6 hours'],
      },
    });
    expect(created.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    return { vendorId, packageId: created.json().id };
  }

  async function request(vendorId: string, packageId: string): Promise<string> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: { vendorId, packageId, eventDate: EVENT_DATE, eventType: 'wedding' },
    });
    expect(created.statusCode).toBe(201);

    return created.json().id;
  }

  async function readProfile(
    actor: string,
    customerId: string,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method: 'GET',
      url: `/customers/${customerId}/profile`,
      headers: bearer(actor),
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [OTHER_VENDOR, 'vendor', 'ada@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
      [OTHER_CUSTOMER, 'customer', 'edsger@example.com'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(reviews);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('visibility', () => {
    it('rejects an unauthenticated read', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/customers/11111111-1111-4111-8111-111111111111/profile',
      });

      expect(response.statusCode).toBe(401);
    });

    it('refuses a caller who holds no vendor profile', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await request(vendorId, packageId);

      const response = await readProfile(CUSTOMER, await idOf(CUSTOMER));

      expect(response.statusCode).toBe(403);
    });

    /*
     * The whole point of the tier: the same request, before and after the
     * vendor accepts, returns different shapes — and the caller never asks for
     * one. A vendor cannot request the full tier, only earn it.
     */
    it('returns the limited tier before acceptance and the full tier after', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const requestId = await request(vendorId, packageId);
      const customerId = await idOf(CUSTOMER);

      const before = await readProfile(VENDOR, customerId);
      expect(before.statusCode).toBe(200);
      const limited = before.json() as ProfileBody;
      expect(limited.visibility).toBe('limited');
      expect(limited.firstName).toBe('Test');
      expect(limited).not.toHaveProperty('lastName');
      expect(limited).not.toHaveProperty('email');
      expect(limited).not.toHaveProperty('phone');
      expect(limited).not.toHaveProperty('avatarUrl');

      const accepted = await harness.app.inject({
        method: 'POST',
        url: `/booking-requests/${requestId}/accept`,
        headers: bearer(VENDOR),
      });
      expect(accepted.statusCode).toBe(200);

      const after = await readProfile(VENDOR, customerId);
      const full = after.json() as ProfileBody;
      expect(full.visibility).toBe('full');
      expect(full.lastName).toBe('User');
      expect(full.email).toBe('alan@example.com');
      expect(full).toHaveProperty('phone');
      expect(full).toHaveProperty('avatarUrl');
    });

    it('gives a vendor with no booking relationship neither tier', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await createVendor(OTHER_VENDOR, 'Northside Film');
      await request(vendorId, packageId);

      const response = await readProfile(OTHER_VENDOR, await idOf(CUSTOMER));

      // 404, not 403: a stranger must not be able to confirm the account exists.
      expect(response.statusCode).toBe(404);
    });

    it('does not leak one customer through another customer relationship', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await request(vendorId, packageId);

      const response = await readProfile(VENDOR, await idOf(OTHER_CUSTOMER));

      expect(response.statusCode).toBe(404);
    });
  });

  describe('stats', () => {
    it('reports no completion rate when nothing has settled either way', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await request(vendorId, packageId);

      const body = (await readProfile(VENDOR, await idOf(CUSTOMER))).json() as ProfileBody;

      // Not 0 — a customer who has finished nothing has no rate, and 0% reads
      // as a bad one rather than an absent one.
      expect(body.completionRate).toBeNull();
      expect(body.totalBookingsCount).toBe(0);
    });

    it('computes the rate from settled bookings once there are some', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await request(vendorId, packageId);
      const customerId = await idOf(CUSTOMER);

      await harness.database.db
        .update(users)
        .set({ completedBookingsCount: 3, cancelledBookingsCount: 1, totalBookingsCount: 4 })
        .where(eq(users.id, customerId));

      const body = (await readProfile(VENDOR, customerId)).json() as ProfileBody;

      expect(body.completionRate).toBeCloseTo(0.75);
    });
  });

  describe('reviews', () => {
    /** A completed booking with one vendor-to-customer review attached. */
    async function reviewCustomer(
      vendorId: string,
      customerId: string,
      options: { isPublic?: boolean; rating?: number } = {},
    ): Promise<void> {
      const requestId = await request(vendorId, (await ownPackageId(vendorId)) ?? '');

      const booking = await harness.database.db
        .insert(bookings)
        .values({
          requestId,
          customerId,
          vendorId,
          eventDate: EVENT_DATE,
          totalAmountCents: 145_000,
          platformFeeCents: 17_400,
          vendorPayoutCents: 127_600,
          status: 'completed',
        })
        .returning();

      await harness.database.db.insert(reviews).values({
        bookingId: booking[0]!.id,
        reviewerId: await idOf(VENDOR),
        vendorId,
        type: 'vendor_to_customer',
        rating: options.rating ?? 5,
        content: 'Clear about what they wanted and ready on the day.',
        isPublic: options.isPublic ?? true,
      });
    }

    async function ownPackageId(vendorId: string): Promise<string | null> {
      const rows = await harness.app.inject({
        method: 'GET',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
      });
      const list = rows.json() as { id: string; vendorId: string }[];

      return list.find((row) => row.vendorId === vendorId)?.id ?? null;
    }

    it('carries the vendor business name, never the reviewer identity', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const customerId = await idOf(CUSTOMER);
      await reviewCustomer(vendorId, customerId);

      const body = (await readProfile(VENDOR, customerId)).json() as ProfileBody;

      expect(body.recentReviews).toHaveLength(1);
      expect(body.recentReviews[0]?.vendorBusinessName).toBe('Sunlit Studio');
      expect(body.recentReviews[0]?.rating).toBe(5);
    });

    it("keeps a vendor's private note out of another vendor's view", async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const customerId = await idOf(CUSTOMER);
      await reviewCustomer(vendorId, customerId, { isPublic: false });

      const body = (await readProfile(VENDOR, customerId)).json() as ProfileBody;

      expect(body.recentReviews).toEqual([]);
    });

    it('lets a customer read their own review history without a vendor profile', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      await reviewCustomer(vendorId, await idOf(CUSTOMER));

      const response = await harness.app.inject({
        method: 'GET',
        url: '/customers/me/reviews',
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(1);
    });

    it('is empty for a customer nobody has reviewed', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/customers/me/reviews',
        headers: bearer(OTHER_CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it('gates the full review list behind the same relationship as the profile', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      await createVendor(OTHER_VENDOR, 'Northside Film');
      await reviewCustomer(vendorId, await idOf(CUSTOMER));

      const response = await harness.app.inject({
        method: 'GET',
        url: `/customers/${await idOf(CUSTOMER)}/reviews`,
        headers: bearer(OTHER_VENDOR),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
