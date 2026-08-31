import { eq } from 'drizzle-orm';
import {
  bookingRequests,
  bookings,
  categories,
  notifications,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const ADMIN = 'user_admin';
const OTHER_ADMIN = 'user_admin_two';
const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';

describe('admin routes', () => {
  let harness: TestHarness;
  let photographyId: string;

  /**
   * `normalizeRole` refuses `admin` from Clerk metadata on purpose, so an admin
   * cannot be minted through sync. Sign in to create the row, then promote it —
   * the same recipe `uploads.routes.test.ts` uses.
   */
  async function signIn(clerkUserId: string, promoteToAdmin = false): Promise<string> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(clerkUserId),
    });
    expect(response.statusCode).toBe(200);

    if (promoteToAdmin) {
      await harness.database.db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.clerkUserId, clerkUserId));
    }

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    return rows[0]!.id;
  }

  async function createVendorProfile(
    overrides: { isPublished?: boolean; stripeOnboarded?: boolean } = {},
  ): Promise<{ profileId: string; userId: string }> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });
    expect(created.statusCode).toBe(201);

    const rows = await harness.database.db
      .select({ id: vendorProfiles.id, userId: vendorProfiles.userId })
      .from(vendorProfiles)
      .limit(1);
    const row = rows[0]!;

    if (overrides.isPublished !== undefined || overrides.stripeOnboarded !== undefined) {
      await harness.database.db
        .update(vendorProfiles)
        .set({
          ...(overrides.isPublished === undefined ? {} : { isPublished: overrides.isPublished }),
          ...(overrides.stripeOnboarded === undefined
            ? {}
            : { stripeOnboarded: overrides.stripeOnboarded }),
        })
        .where(eq(vendorProfiles.id, row.id));
    }

    return { profileId: row.id, userId: row.userId };
  }

  /** A confirmed, paid booking in the future — what a ban has to unwind. */
  async function createFutureBooking(customerId: string, vendorProfileId: string): Promise<string> {
    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendorProfileId,
        eventDate: '2099-06-01',
        status: 'accepted',
        finalPriceCents: 120_000,
      })
      .returning({ id: bookingRequests.id });

    const bookingRows = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestRows[0]!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate: '2099-06-01',
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        stripePaymentIntentId: 'pi_test_ban',
      })
      .returning({ id: bookings.id });

    return bookingRows[0]!.id;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [ADMIN, 'customer'],
      [OTHER_ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
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
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.stripe.refunds.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('authorization', () => {
    const routes = [
      { method: 'GET', url: '/admin/vendors' },
      { method: 'PUT', url: `/admin/users/${'0'.repeat(8)}-0000-4000-8000-000000000000/ban` },
      { method: 'PUT', url: `/admin/users/${'0'.repeat(8)}-0000-4000-8000-000000000000/unban` },
    ] as const;

    it('refuses every admin route without a session', async () => {
      for (const route of routes) {
        const response = await harness.app.inject({ method: route.method, url: route.url });

        expect(response.statusCode, route.url).toBe(401);
      }
    });

    it('refuses every admin route to a customer', async () => {
      await signIn(CUSTOMER);

      for (const route of routes) {
        const response = await harness.app.inject({
          method: route.method,
          url: route.url,
          headers: bearer(CUSTOMER),
        });

        expect(response.statusCode, route.url).toBe(403);
      }
    });

    it('refuses every admin route to a vendor', async () => {
      await signIn(VENDOR);

      for (const route of routes) {
        const response = await harness.app.inject({
          method: route.method,
          url: route.url,
          headers: bearer(VENDOR),
        });

        expect(response.statusCode, route.url).toBe(403);
      }
    });

    /*
     * The 403-before-400 guard. Fastify parses the body before `preHandler`, so
     * a role-only route declared with `preHandler` answers a malformed payload
     * with a validation error and never reaches the denial.
     */
    it('answers 403, not 400, when a customer sends a malformed ban payload', async () => {
      await signIn(CUSTOMER);
      const target = await signIn(VENDOR);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${target}/ban`,
        headers: { ...bearer(CUSTOMER), 'content-type': 'application/json' },
        payload: '{',
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /admin/vendors', () => {
    it('derives the four statuses from the columns that record state', async () => {
      await signIn(ADMIN, true);
      const vendor = await createVendorProfile({ isPublished: true });

      const live = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors',
        headers: bearer(ADMIN),
      });
      expect(live.statusCode).toBe(200);
      expect(live.json().items[0]).toMatchObject({
        businessName: 'Sunlit Studio',
        slug: expect.any(String),
        categoryName: 'Photography',
        city: 'Austin',
        state: 'TX',
        status: 'live',
      });

      await harness.database.db
        .update(vendorProfiles)
        .set({ isPublished: false, stripeOnboarded: true })
        .where(eq(vendorProfiles.id, vendor.profileId));
      const paused = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors',
        headers: bearer(ADMIN),
      });
      expect(paused.json().items[0].status).toBe('paused');

      await harness.database.db
        .update(vendorProfiles)
        .set({ stripeOnboarded: false })
        .where(eq(vendorProfiles.id, vendor.profileId));
      const review = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors',
        headers: bearer(ADMIN),
      });
      expect(review.json().items[0].status).toBe('review');

      await harness.database.db
        .update(users)
        .set({ isBanned: true })
        .where(eq(users.id, vendor.userId));
      const flagged = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors',
        headers: bearer(ADMIN),
      });
      expect(flagged.json().items[0].status).toBe('flagged');
    });

    it('counts the awaiting-review badge over the unfiltered set, so it survives a status filter', async () => {
      await signIn(ADMIN, true);
      await createVendorProfile({ isPublished: false, stripeOnboarded: false });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors?status=live',
        headers: bearer(ADMIN),
      });

      const body = response.json();
      expect(body.items).toHaveLength(0);
      expect(body.total).toBe(0);
      expect(body.awaitingReview).toBe(1);
    });

    it('filters by search term across name, slug and owner email', async () => {
      await signIn(ADMIN, true);
      await createVendorProfile({ isPublished: true });

      const hit = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors?q=sunlit',
        headers: bearer(ADMIN),
      });
      expect(hit.json().items).toHaveLength(1);

      const byEmail = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors?q=user_vendor%40example.com',
        headers: bearer(ADMIN),
      });
      expect(byEmail.json().items).toHaveLength(1);

      const miss = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors?q=nothing-matches-this',
        headers: bearer(ADMIN),
      });
      expect(miss.json().items).toHaveLength(0);
      expect(miss.json().total).toBe(0);
    });

    it('filters by payout connection', async () => {
      await signIn(ADMIN, true);
      await createVendorProfile({ isPublished: true, stripeOnboarded: false });

      const connected = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors?payouts=connected',
        headers: bearer(ADMIN),
      });
      expect(connected.json().items).toHaveLength(0);

      const notConnected = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors?payouts=not-connected',
        headers: bearer(ADMIN),
      });
      expect(notConnected.json().items).toHaveLength(1);
    });

    /*
     * A vendor holding two categories must appear once. `vendor_categories` is
     * many-to-many, and joining it rather than using EXISTS duplicates the row
     * and makes both the total and the page window wrong.
     */
    it('returns one row for a vendor holding several categories', async () => {
      await signIn(ADMIN, true);
      const vendor = await createVendorProfile({ isPublished: true });

      const other = await harness.database.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, 'catering'))
        .limit(1);
      await harness.database.db
        .insert(vendorCategories)
        .values({ vendorId: vendor.profileId, categoryId: other[0]!.id });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors',
        headers: bearer(ADMIN),
      });

      expect(response.json().items).toHaveLength(1);
      expect(response.json().total).toBe(1);
    });

    it('renders zero rows and a zero count on an empty platform', async () => {
      await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors',
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ items: [], total: 0, awaitingReview: 0, page: 1 });
    });
  });

  describe('PUT /admin/users/:userId/ban', () => {
    it('refuses to ban the caller’s own account', async () => {
      const adminId = await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${adminId}/ban`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe('You cannot ban your own account');
    });

    it('bans another admin, so one operator is not unremovable', async () => {
      await signIn(ADMIN, true);
      const other = await signIn(OTHER_ADMIN, true);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${other}/ban`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().isBanned).toBe(true);
    });

    it('unpublishes the storefront, declines open requests, and refunds future bookings in full', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile({ isPublished: true });
      const bookingId = await createFutureBooking(customerId, vendor.profileId);

      await harness.database.db.insert(bookingRequests).values({
        customerId,
        vendorId: vendor.profileId,
        eventDate: '2099-07-01',
        status: 'pending',
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        isBanned: true,
        bookingsCancelled: 1,
        refundsIssued: 1,
        profileUnpublished: true,
      });
      expect(response.json().requestsDeclined).toBeGreaterThanOrEqual(1);

      // The refund is the full amount, not a D3 cancellation tier.
      expect(harness.stripe.refunds).toEqual([
        { paymentIntentId: 'pi_test_ban', amountCents: 120_000, reason: undefined },
      ]);

      const [banned] = await harness.database.db
        .select({ isBanned: users.isBanned, bannedAt: users.bannedAt })
        .from(users)
        .where(eq(users.id, vendor.userId));
      expect(banned!.isBanned).toBe(true);
      expect(banned!.bannedAt).not.toBeNull();

      const [profile] = await harness.database.db
        .select({ isPublished: vendorProfiles.isPublished })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendor.profileId));
      expect(profile!.isPublished).toBe(false);

      const [booking] = await harness.database.db
        .select({ status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      expect(booking!.status).toBe('cancelled');

      // The counterparty is told; the banned account is not.
      const notified = await harness.database.db
        .select({ userId: notifications.userId, type: notifications.type })
        .from(notifications);
      expect(notified).toHaveLength(1);
      expect(notified[0]).toMatchObject({ userId: customerId, type: 'booking_cancelled' });
    });

    it('refuses a second ban on an account already banned', async () => {
      await signIn(ADMIN, true);
      const target = await signIn(CUSTOMER);

      const first = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${target}/ban`,
        headers: bearer(ADMIN),
      });
      expect(first.statusCode).toBe(200);

      const second = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${target}/ban`,
        headers: bearer(ADMIN),
      });
      expect(second.statusCode).toBe(409);
    });

    it('answers 404 for an id that is not an account', async () => {
      await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/admin/users/00000000-0000-4000-8000-000000000000/ban',
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /admin/users/:userId/unban', () => {
    it('clears the flag but does not republish the storefront', async () => {
      await signIn(ADMIN, true);
      const vendor = await createVendorProfile({ isPublished: true });

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/unban`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ isBanned: false, profileUnpublished: false });

      const [row] = await harness.database.db
        .select({ isBanned: users.isBanned, bannedAt: users.bannedAt })
        .from(users)
        .where(eq(users.id, vendor.userId));
      expect(row!.isBanned).toBe(false);
      expect(row!.bannedAt).toBeNull();

      const [profile] = await harness.database.db
        .select({ isPublished: vendorProfiles.isPublished })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendor.profileId));
      expect(profile!.isPublished).toBe(false);
    });

    it('refuses to unban an account that is not banned', async () => {
      await signIn(ADMIN, true);
      const target = await signIn(CUSTOMER);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${target}/unban`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(409);
    });
  });
});
