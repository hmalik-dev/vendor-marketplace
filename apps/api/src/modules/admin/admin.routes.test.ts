import { readFile } from 'node:fs/promises';
import { ADMIN_PAGE_SIZE, DEFAULT_PAGE_SIZE } from '@vendor-marketplace/shared';
import { eq, notInArray } from 'drizzle-orm';
import {
  bookingRequests,
  bookings,
  categories,
  notifications,
  reviews,
  tagSuggestions,
  tags,
  users,
  vendorCategories,
  vendorProfiles,
  vendorTags,
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
  /** The seeded vocabulary, so `afterEach` can drop only what a test created. */
  let seededTagIds: string[];

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
  /**
   * A confirmed booking on a future date.
   *
   * `overrides` exists so a suite can create a **second** one: the date is a
   * unique key per vendor in practice, and the intent id is what a test names
   * to make Stripe refuse that particular refund.
   */
  async function createFutureBooking(
    customerId: string,
    vendorProfileId: string,
    overrides: { eventDate?: string; stripePaymentIntentId?: string } = {},
  ): Promise<string> {
    const eventDate = overrides.eventDate ?? '2099-06-01';

    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendorProfileId,
        eventDate,
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
        eventDate,
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        stripePaymentIntentId: overrides.stripePaymentIntentId ?? 'pi_test_ban',
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

    const seeded = await harness.database.db.select({ id: tags.id }).from(tags);
    seededTagIds = seeded.map((row) => row.id);
  });

  afterEach(async () => {
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(reviews);
    await harness.database.db.delete(tagSuggestions);
    await harness.database.db.delete(vendorTags);
    /*
     * Only the tags a test minted. Wiping the table would take the seeded
     * vocabulary with it and leave every later test in this file running
     * against an empty tag list — which is not the state the product is ever in.
     */
    await harness.database.db.delete(tags).where(notInArray(tags.id, seededTagIds));
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.stripe.refunds.length = 0;
    // Shared across every test in this file, so a refusal one test installs
    // would silently break the next one's refund.
    harness.stripe.refundsToRefuse.clear();
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('authorization', () => {
    const NIL = `${'0'.repeat(8)}-0000-4000-8000-000000000000`;
    /*
     * **Every** route this plugin registers, not a sample. The acceptance
     * criterion is per-route, and a route added without a line here is exactly
     * the unguarded endpoint the list exists to catch — see the count assertion
     * below it.
     */
    const routes = [
      { method: 'GET', url: '/admin/vendors' },
      { method: 'GET', url: '/admin/vendors/facets' },
      { method: 'GET', url: '/admin/metrics' },
      { method: 'GET', url: '/admin/customers' },
      { method: 'GET', url: '/admin/bookings' },
      { method: 'GET', url: '/admin/payments' },
      { method: 'GET', url: '/admin/reviews' },
      { method: 'DELETE', url: `/admin/reviews/${NIL}` },
      { method: 'GET', url: '/admin/tag-suggestions' },
      { method: 'PUT', url: `/admin/tag-suggestions/${NIL}` },
      { method: 'GET', url: '/admin/tags' },
      { method: 'PUT', url: `/admin/tags/${NIL}` },
      { method: 'PUT', url: `/admin/users/${NIL}/ban` },
      { method: 'PUT', url: `/admin/users/${NIL}/unban` },
    ] as const;

    it('covers every route the admin plugin registers', async () => {
      /*
       * Read from the plugin source rather than from `printRoutes`, whose tree
       * output folds shared prefixes and adds a `HEAD` beside every `GET` — two
       * shapes that make a count either wrong or fragile. This fails the moment
       * a route is added to the plugin and not to `routes` above, which is the
       * only way an admin endpoint can ship unasserted.
       */
      const source = await readFile(new URL('./admin.routes.ts', import.meta.url).pathname, 'utf8');
      const registered = source.match(/^ {2}app\.(get|put|post|patch|delete)\(/gm) ?? [];

      expect(registered).toHaveLength(routes.length);
    });

    it('refuses every admin route without a session', async () => {
      for (const route of routes) {
        const response = await harness.app.inject({ method: route.method, url: route.url });

        expect(response.statusCode, route.url).toBe(401);
      }
    });

    /*
     * The same routes **with a query string**, which is a different test.
     *
     * `preHandler` runs after validation, so an anonymous
     * `GET /admin/vendors?status=bogus` answered 400 — with the enum's members
     * listed in `details.params.values` — where the same route without a query
     * answered 401. The test above passed throughout, because it sent no query.
     * Every route in this plugin is now guarded `onRequest`, and this is what
     * says so.
     */
    it('refuses them before validating a query, so no schema leaks to a stranger', async () => {
      for (const route of routes) {
        const response = await harness.app.inject({
          method: route.method,
          url: `${route.url}?status=bogus&page=0&pageSize=99999`,
        });

        expect(response.statusCode, route.url).toBe(401);
        expect(response.body, route.url).not.toContain('flagged');
      }
    });

    it('refuses a malformed body before parsing it', async () => {
      await signIn(CUSTOMER);

      for (const route of routes.filter((candidate) => candidate.method === 'PUT')) {
        const response = await harness.app.inject({
          method: 'PUT',
          url: route.url,
          headers: { ...bearer(CUSTOMER), 'content-type': 'application/json' },
          payload: '{"action":',
        });

        // 403 — the role refusal, not the 400 the JSON parser would have raised.
        expect(response.statusCode, route.url).toBe(403);
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
        .set({ isPublished: false, stripeOnboarded: true, stripeAccountId: 'acct_test_paused' })
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
        refundsFailed: 0,
        profileUnpublished: true,
      });
      expect(response.json().requestsDeclined).toBeGreaterThanOrEqual(1);

      // The refund is the full amount, not a D3 cancellation tier — and it
      // carries the key that stops a replayed ban issuing it twice.
      expect(harness.stripe.refunds).toEqual([
        {
          paymentIntentId: 'pi_test_ban',
          amountCents: 120_000,
          reason: undefined,
          idempotencyKey: expect.stringMatching(/^ban-refund:/) as unknown as string,
        },
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

    /*
     * #400: the ban swallowed a failed refund and reported success. The catch
     * logged and continued — right, because a booking whose money did not come
     * back must not be cancelled underneath the customer, and one failure must
     * not abandon the rest of the ban — but `AdminBanResult` had no field for
     * it, so the operator's table showed a clean suspension while a confirmed
     * booking stood on the account with neither party told and the money still
     * at Stripe.
     */
    it('reports a refund Stripe refused instead of counting the ban a clean success', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile({ isPublished: true });
      await createFutureBooking(customerId, vendor.profileId);
      harness.stripe.refundsToRefuse.add('pi_test_ban');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        isBanned: true,
        refundsFailed: 1,
        refundsIssued: 0,
        // Not cancelled: the money did not come back, so the booking stands
        // and a person has to finish it.
        bookingsCancelled: 0,
      });

      const [booking] = await harness.database.db.select().from(bookings);
      expect(booking?.status).toBe('confirmed');
    });

    /*
     * One failure must not abandon the rest of the unwind — which needs **two**
     * bookings, one refusable and one not. A first version of this test refused
     * `pi_test_ban`, which `createFutureBooking` writes on every row, so there
     * was no second booking and the assertion never exercised the property its
     * name claimed.
     */
    it('still unwinds the bookings it can refund', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile({ isPublished: true });
      const refusable = await createFutureBooking(customerId, vendor.profileId);
      await createFutureBooking(customerId, vendor.profileId, {
        eventDate: '2099-08-01',
        stripePaymentIntentId: 'pi_test_ban_second',
      });

      const [refused] = await harness.database.db
        .select({ intentId: bookings.stripePaymentIntentId })
        .from(bookings)
        .where(eq(bookings.id, refusable));
      harness.stripe.refundsToRefuse.add(refused!.intentId!);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });

      expect(response.json()).toMatchObject({
        isBanned: true,
        profileUnpublished: true,
        refundsFailed: 1,
        // The other one was refunded and cancelled: one failure did not stop it.
        refundsIssued: 1,
        bookingsCancelled: 1,
      });

      const rows = await harness.database.db
        .select({ id: bookings.id, status: bookings.status })
        .from(bookings);
      expect(rows.find((row) => row.id === refusable)?.status).toBe('confirmed');
      expect(rows.filter((row) => row.status === 'cancelled')).toHaveLength(1);
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

  describe('overview metrics', () => {
    it('answers zeros and a full window with no data at all', async () => {
      await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/metrics',
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.totalRevenueCents).toBe(0);
      expect(body.bookingsCount).toBe(0);
      expect(body.activeVendorsCount).toBe(0);
      expect(body.pendingTagSuggestionsCount).toBe(0);
      expect(body.reviewsCount).toBe(0);
      /*
       * Thirty points, not zero. A sparse series draws a line straight across
       * the days it omits, which reads as interpolation rather than as the
       * quiet week it was — the zero-data acceptance criterion is about the
       * chart having a shape, not just the cards having a number.
       */
      for (const key of ['revenueByDay', 'bookingsByDay', 'signupsByDay', 'completedByDay']) {
        expect(body[key], key).toHaveLength(30);
      }
      for (const key of ['revenueByDay', 'bookingsByDay', 'completedByDay']) {
        expect(
          body[key].every((point: { value: number }) => point.value === 0),
          key,
        ).toBe(true);
      }
      /*
       * Signups are the one series that cannot be empty here: promoting an
       * account to admin means creating one, and today's bucket has to say so
       * rather than report the zero the other three legitimately do.
       */
      expect(body.usersCount).toBe(1);
      expect(body.signupsByDay.at(-1)).toEqual({
        date: new Date().toISOString().slice(0, 10),
        value: 1,
      });
      expect(
        body.signupsByDay.slice(0, -1).every((point: { value: number }) => point.value === 0),
      ).toBe(true);
      expect(body.revenueByDay.at(-1).date).toBe(new Date().toISOString().slice(0, 10));
    });

    it('counts a paid booking and excludes one that was refunded', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile({ isPublished: true });
      const kept = await createFutureBooking(customerId, vendor.profileId);
      const refunded = await createFutureBooking(customerId, vendor.profileId);

      await harness.database.db
        .update(bookings)
        .set({ paidAt: new Date() })
        .where(eq(bookings.id, kept));
      await harness.database.db
        .update(bookings)
        .set({ paidAt: new Date(), status: 'cancelled' })
        .where(eq(bookings.id, refunded));

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/metrics',
        headers: bearer(ADMIN),
      });

      const body = response.json();
      // One booking's 120_000, not two — the cancelled one was refunded in full.
      expect(body.totalRevenueCents).toBe(120_000);
      expect(body.bookingsCount).toBe(2);
      expect(body.activeVendorsCount).toBe(1);
      expect(body.revenueByDay.at(-1).value).toBe(120_000);
    });
  });

  describe('the console page window', () => {
    /*
     * `22-admin.md` states fifteen rows as an acceptance criterion, and the
     * layout is not what guarantees it — the page size is. A default of twenty
     * would hand the pane five rows more than it can show, which is exactly the
     * "promises eighteen and clips three" failure the criterion names.
     */
    it('defaults every console list to the fifteen rows the frame fits', async () => {
      await signIn(ADMIN, true);

      for (const url of [
        '/admin/vendors',
        '/admin/customers',
        '/admin/bookings',
        '/admin/payments',
        '/admin/reviews',
        '/admin/tag-suggestions',
      ]) {
        const response = await harness.app.inject({ method: 'GET', url, headers: bearer(ADMIN) });

        expect(response.statusCode, url).toBe(200);
        expect(response.json().pageSize, url).toBe(ADMIN_PAGE_SIZE);
      }
    });

    it('is fifteen, not the twenty every other list endpoint uses', () => {
      expect(ADMIN_PAGE_SIZE).toBe(15);
      expect(ADMIN_PAGE_SIZE).not.toBe(DEFAULT_PAGE_SIZE);
    });
  });

  describe('search terms are matched literally', () => {
    /*
     * The class of defect, already fixed once on public vendor search (#29) and
     * reintroduced verbatim here: `ilike` interpolates the pattern with no
     * `ESCAPE`, so `?q=%` matched every row and dumped the table an operator was
     * trying to narrow. Both admin lists that take a term are asserted, because
     * the fix is one shared helper and a caller that forgets it is the next bug.
     */
    it('treats a bare wildcard as a character, on vendors and on customers', async () => {
      await signIn(ADMIN, true);
      await signIn(CUSTOMER);
      await signIn(VENDOR);
      await createVendorProfile({ isPublished: true });

      for (const url of ['/admin/vendors?q=%25', '/admin/customers?q=%25']) {
        const response = await harness.app.inject({
          method: 'GET',
          url,
          headers: bearer(ADMIN),
        });

        expect(response.statusCode, url).toBe(200);
        // Nothing is literally named `%`, so the honest answer is nothing.
        expect(response.json().total, url).toBe(0);
      }
    });

    it('still finds a fragment of a real name', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      await createVendorProfile({ isPublished: true });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors?q=unlit',
        headers: bearer(ADMIN),
      });

      expect(response.json().total).toBe(1);
      expect(response.json().items[0].businessName).toBe('Sunlit Studio');
    });

    it('finds a name that contains a wildcard character literally', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile({ isPublished: true });
      await harness.database.db
        .update(vendorProfiles)
        .set({ businessName: '100% Sunlit' })
        .where(eq(vendorProfiles.id, vendor.profileId));

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors?q=100%25%20Sun',
        headers: bearer(ADMIN),
      });

      expect(response.json().total).toBe(1);
      expect(response.json().items[0].businessName).toBe('100% Sunlit');
    });
  });

  describe('customers', () => {
    it('lists customers only, and matches on name or email', async () => {
      await signIn(ADMIN, true);
      await signIn(CUSTOMER);
      await signIn(VENDOR);

      const all = await harness.app.inject({
        method: 'GET',
        url: '/admin/customers',
        headers: bearer(ADMIN),
      });
      expect(all.statusCode).toBe(200);
      const emails = all.json().items.map((row: { email: string }) => row.email);
      expect(emails).toContain(`${CUSTOMER}@example.com`);
      // The vendor is a `users` row too, and must not appear on the customers view.
      expect(emails).not.toContain(`${VENDOR}@example.com`);

      const filtered = await harness.app.inject({
        method: 'GET',
        url: `/admin/customers?q=${CUSTOMER}`,
        headers: bearer(ADMIN),
      });
      expect(filtered.json().total).toBe(1);
      expect(filtered.json().items[0].email).toBe(`${CUSTOMER}@example.com`);
    });
  });

  describe('bookings and payments', () => {
    it('names both sides of a booking, and filters by status', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile({ isPublished: true });
      const bookingId = await createFutureBooking(customerId, vendor.profileId);

      const listed = await harness.app.inject({
        method: 'GET',
        url: '/admin/bookings',
        headers: bearer(ADMIN),
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json().total).toBe(1);
      expect(listed.json().items[0]).toMatchObject({
        id: bookingId,
        status: 'confirmed',
        totalCents: 120_000,
        customerName: 'Test User',
        vendorName: 'Sunlit Studio',
      });

      const filtered = await harness.app.inject({
        method: 'GET',
        url: '/admin/bookings?status=completed',
        headers: bearer(ADMIN),
      });
      expect(filtered.json().total).toBe(0);
      expect(filtered.json().items).toEqual([]);
    });

    it('shows only bookings whose money actually moved', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile({ isPublished: true });
      const unpaid = await createFutureBooking(customerId, vendor.profileId);
      const paid = await createFutureBooking(customerId, vendor.profileId);

      await harness.database.db
        .update(bookings)
        .set({ paidAt: new Date() })
        .where(eq(bookings.id, paid));

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/payments',
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().total).toBe(1);
      const [row] = response.json().items;
      expect(row.bookingId).toBe(paid);
      expect(row.bookingId).not.toBe(unpaid);
      expect(row).toMatchObject({
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        stripePaymentIntentId: 'pi_test_ban',
      });
    });
  });

  describe('payments name what happened to the money', () => {
    /*
     * `cancelBooking` never clears `paid_at`, so a refunded booking stays on
     * this list — correctly, because the money did move and an operator has to
     * find it. What it must not do is read as revenue: the Overview excludes
     * cancelled bookings, so the same dollar was taken on one console screen
     * and given back on another.
     */
    it('returns the status alongside the amounts, so a refund is not read as a payment', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(VENDOR);
      const vendor = await createVendorProfile({ isPublished: true });
      const kept = await createFutureBooking(customerId, vendor.profileId);
      const refunded = await createFutureBooking(customerId, vendor.profileId);

      await harness.database.db
        .update(bookings)
        .set({ paidAt: new Date() })
        .where(eq(bookings.id, kept));
      await harness.database.db
        .update(bookings)
        .set({ paidAt: new Date(), status: 'cancelled' })
        .where(eq(bookings.id, refunded));

      const [payments, metrics] = await Promise.all([
        harness.app.inject({ method: 'GET', url: '/admin/payments', headers: bearer(ADMIN) }),
        harness.app.inject({ method: 'GET', url: '/admin/metrics', headers: bearer(ADMIN) }),
      ]);

      expect(payments.json().total).toBe(2);
      const byId = new Map(
        payments
          .json()
          .items.map((row: { bookingId: string; status: string }) => [row.bookingId, row.status]),
      );
      expect(byId.get(kept)).toBe('confirmed');
      expect(byId.get(refunded)).toBe('cancelled');

      // The two screens agree: one booking's money was kept.
      expect(metrics.json().totalRevenueCents).toBe(120_000);
    });
  });

  describe('reviews', () => {
    async function createReview(
      customerId: string,
      vendorProfileId: string,
      bookingId: string,
      rating: number,
    ): Promise<string> {
      const rows = await harness.database.db
        .insert(reviews)
        .values({
          bookingId,
          reviewerId: customerId,
          vendorId: vendorProfileId,
          type: 'customer_to_vendor',
          rating,
          content: 'Recorded for the moderation queue.',
        })
        .returning({ id: reviews.id });

      return rows[0]!.id;
    }

    it('deleting a review recomputes the rating from the rows that remain', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile({ isPublished: true });
      const first = await createFutureBooking(customerId, vendor.profileId);
      const second = await createFutureBooking(customerId, vendor.profileId);
      const five = await createReview(customerId, vendor.profileId, first, 5);
      await createReview(customerId, vendor.profileId, second, 3);
      // The cached pair the delete has to correct, written as if two reviews landed.
      await harness.database.db
        .update(vendorProfiles)
        .set({ avgRating: '4.00', reviewCount: 2 })
        .where(eq(vendorProfiles.id, vendor.profileId));

      const listed = await harness.app.inject({
        method: 'GET',
        url: '/admin/reviews',
        headers: bearer(ADMIN),
      });
      expect(listed.json().total).toBe(2);
      expect(listed.json().items[0]).toMatchObject({
        authorName: 'Test User',
        vendorName: 'Sunlit Studio',
      });

      const deleted = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${five}`,
        headers: bearer(ADMIN),
      });
      expect(deleted.statusCode).toBe(204);

      const [row] = await harness.database.db
        .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendor.profileId));
      expect(Number(row!.avgRating)).toBe(3);
      expect(row!.reviewCount).toBe(1);
    });

    it('deleting the last review leaves 0 and 0, not null', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile({ isPublished: true });
      const booking = await createFutureBooking(customerId, vendor.profileId);
      const only = await createReview(customerId, vendor.profileId, booking, 4);
      await harness.database.db
        .update(vendorProfiles)
        .set({ avgRating: '4.00', reviewCount: 1 })
        .where(eq(vendorProfiles.id, vendor.profileId));

      const deleted = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${only}`,
        headers: bearer(ADMIN),
      });
      expect(deleted.statusCode).toBe(204);

      const [row] = await harness.database.db
        .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendor.profileId));
      expect(Number(row!.avgRating)).toBe(0);
      expect(row!.reviewCount).toBe(0);
    });

    it('404s on a review that is already gone', async () => {
      await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${'0'.repeat(8)}-0000-4000-8000-000000000000`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('tag moderation', () => {
    /** A pending suggestion from the vendor account, which owns a profile. */
    async function suggest(name: string): Promise<{ id: string; profileId: string }> {
      const vendor = await createVendorProfile();
      const rows = await harness.database.db
        .insert(tagSuggestions)
        .values({ vendorId: vendor.userId, suggestedName: name, category: 'dietary' })
        .returning({ id: tagSuggestions.id });

      return { id: rows[0]!.id, profileId: vendor.profileId };
    }

    it('lists the queue oldest first, with the vendor named', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const { id } = await suggest('Gluten Free');

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/tag-suggestions?status=pending',
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().total).toBe(1);
      expect(response.json().items[0]).toMatchObject({
        id,
        suggestedName: 'Gluten Free',
        status: 'pending',
        vendorName: 'Sunlit Studio',
        resolvedTagName: null,
      });
    });

    it('approve creates an active tag, assigns the vendor, and notifies them', async () => {
      await signIn(ADMIN, true);
      const vendorUserId = await signIn(VENDOR);
      const { id, profileId } = await suggest('Gluten Free');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'approve' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.suggestion.status).toBe('approved');
      expect(body.tag).toMatchObject({
        name: 'Gluten Free',
        slug: 'dietary-gluten-free',
        category: 'dietary',
        isActive: true,
      });
      expect(body.suggestion.resolvedTagId).toBe(body.tag.id);
      expect(body.suggestion.resolvedTagName).toBe('Gluten Free');

      const assigned = await harness.database.db
        .select({ tagId: vendorTags.tagId })
        .from(vendorTags)
        .where(eq(vendorTags.vendorId, profileId));
      expect(assigned.map((row) => row.tagId)).toEqual([body.tag.id]);

      const sent = await harness.database.db
        .select({ type: notifications.type, userId: notifications.userId })
        .from(notifications);
      expect(sent).toEqual([{ type: 'tag_suggestion_approved', userId: vendorUserId }]);
    });

    it('approving a name that already exists merges into it instead of inserting a second row', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const existing = await harness.database.db
        .insert(tags)
        .values({ name: 'Soy Free', slug: 'dietary-soy-free', category: 'dietary' })
        .returning({ id: tags.id });
      const { id, profileId } = await suggest('  soy free ');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'approve' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tag.id).toBe(existing[0]!.id);
      expect(response.json().suggestion.adminNote).toBe('Merged with Soy Free');

      const dietary = await harness.database.db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.slug, 'dietary-soy-free'));
      expect(dietary).toHaveLength(1);

      const assigned = await harness.database.db
        .select({ tagId: vendorTags.tagId })
        .from(vendorTags)
        .where(eq(vendorTags.vendorId, profileId));
      expect(assigned.map((row) => row.tagId)).toEqual([existing[0]!.id]);
    });

    it('keeps the operator’s note when an approval turns out to be a merge', async () => {
      // The recursion into the merge branch dropped it, so the queue recorded
      // the machine's "Merged with X" and the operator's reasoning was gone.
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      await harness.database.db
        .insert(tags)
        .values({ name: 'Soy Free', slug: 'dietary-soy-free', category: 'dietary' });
      const { id } = await suggest('soy free');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'approve', adminNote: 'Duplicate of the existing one, per Kate.' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().suggestion.adminNote).toBe('Duplicate of the existing one, per Kate.');
    });

    it('refuses an approval whose slug collides with a differently spelled tag', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      await harness.database.db
        .insert(tags)
        .values({ name: 'Nut-free', slug: 'dietary-nut-free', category: 'dietary' });
      const { id } = await suggest('Nut Free');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'approve' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'A similar tag already exists: Nut-free. Merge into it instead.',
      );

      const [row] = await harness.database.db
        .select({ status: tagSuggestions.status })
        .from(tagSuggestions)
        .where(eq(tagSuggestions.id, id));
      // Still pending: a refused approval is not a decision.
      expect(row!.status).toBe('pending');
    });

    it('reject stores the note and deliberately sends nothing to the vendor', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const { id } = await suggest('Nonsense');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'reject', adminNote: 'Too narrow to be a filter.' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().suggestion).toMatchObject({
        status: 'rejected',
        adminNote: 'Too narrow to be a filter.',
        resolvedTagId: null,
      });
      expect(response.json().tag).toBeNull();
      expect(await harness.database.db.select().from(notifications)).toEqual([]);
    });

    it('requires a note on rejection', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const { id } = await suggest('Nonsense');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'reject' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('merge links to the chosen tag and assigns the vendor to it', async () => {
      await signIn(ADMIN, true);
      const vendorUserId = await signIn(VENDOR);
      const target = await harness.database.db
        .insert(tags)
        .values({ name: 'Raw Food', slug: 'dietary-raw-food', category: 'dietary' })
        .returning({ id: tags.id });
      const { id, profileId } = await suggest('Uncooked');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'merge', mergeTagId: target[0]!.id },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().suggestion).toMatchObject({
        status: 'approved',
        resolvedTagId: target[0]!.id,
        adminNote: 'Merged with Raw Food',
      });

      const assigned = await harness.database.db
        .select({ tagId: vendorTags.tagId })
        .from(vendorTags)
        .where(eq(vendorTags.vendorId, profileId));
      expect(assigned.map((row) => row.tagId)).toEqual([target[0]!.id]);

      const sent = await harness.database.db
        .select({ userId: notifications.userId })
        .from(notifications);
      expect(sent).toEqual([{ userId: vendorUserId }]);
    });

    it('refuses a merge into a tag from another category', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const other = await harness.database.db
        .insert(tags)
        .values({ name: 'Klingon', slug: 'language-klingon', category: 'language' })
        .returning({ id: tags.id });
      const { id } = await suggest('Uncooked');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'merge', mergeTagId: other[0]!.id },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('That tag is in a different category');
    });

    it('the second admin to act on one suggestion is refused, and the first decision stands', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const { id } = await suggest('Gluten Free');

      const first = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'approve' },
      });
      expect(first.statusCode).toBe(200);

      const second = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${id}`,
        headers: bearer(ADMIN),
        payload: { action: 'reject', adminNote: 'Changed my mind.' },
      });

      expect(second.statusCode).toBe(409);
      const [row] = await harness.database.db
        .select({ status: tagSuggestions.status })
        .from(tagSuggestions)
        .where(eq(tagSuggestions.id, id));
      expect(row!.status).toBe('approved');
    });
  });

  describe('what the ban tells each side', () => {
    /*
     * One body went to both parties and to unpaid bookings alike: "Your payment
     * has been refunded in full." The vendor did not pay — they were about to be
     * paid — and on a booking with no payment intent nothing was refunded at
     * all. Both are the product making a false claim about somebody's money.
     */
    it('does not tell a vendor their payment was refunded', async () => {
      const actor = await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(VENDOR);
      const vendor = await createVendorProfile({ isPublished: true });
      await createFutureBooking(customerId, vendor.profileId);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${customerId}/ban`,
        headers: bearer(ADMIN),
      });
      expect(response.statusCode).toBe(200);
      expect(actor).not.toBe(customerId);

      const sent = await harness.database.db
        .select({ userId: notifications.userId, body: notifications.body })
        .from(notifications);
      const toVendor = sent.find((row) => row.userId === vendor.userId);

      expect(toVendor?.body).toBe(
        'The customer’s account was suspended and the booking was cancelled. Their payment has been refunded, so no payout will follow.',
      );
      expect(toVendor?.body).not.toContain('Your payment');
    });

    it('does not claim a refund on a booking that was never charged', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(VENDOR);
      const vendor = await createVendorProfile({ isPublished: true });
      const bookingId = await createFutureBooking(customerId, vendor.profileId);
      await harness.database.db
        .update(bookings)
        .set({ stripePaymentIntentId: null })
        .where(eq(bookings.id, bookingId));

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${customerId}/ban`,
        headers: bearer(ADMIN),
      });

      const sent = await harness.database.db
        .select({ userId: notifications.userId, body: notifications.body })
        .from(notifications);

      expect(harness.stripe.refunds).toHaveLength(0);
      for (const row of sent) {
        expect(row.body, row.userId).not.toContain('refunded');
      }
    });

    it('gives every refund an idempotency key, so a replayed ban cannot double it', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(VENDOR);
      const vendor = await createVendorProfile({ isPublished: true });
      const bookingId = await createFutureBooking(customerId, vendor.profileId);

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${customerId}/ban`,
        headers: bearer(ADMIN),
      });

      expect(harness.stripe.refunds).toHaveLength(1);
      expect(harness.stripe.refunds[0]?.idempotencyKey).toBe(`ban-refund:${bookingId}`);
    });
  });

  describe('tag management', () => {
    it('lists every tag with a real vendor count', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();
      const created = await harness.database.db
        .insert(tags)
        .values({ name: 'Nut Free', slug: 'dietary-nut-free', category: 'dietary' })
        .returning({ id: tags.id });
      await harness.database.db
        .insert(vendorTags)
        .values({ vendorId: vendor.profileId, tagId: created[0]!.id });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/tags',
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const row = response
        .json()
        .items.find((candidate: { id: string }) => candidate.id === created[0]!.id);
      expect(row).toMatchObject({ name: 'Nut Free', vendorCount: 1, isActive: true });
    });

    it('deactivating a tag keeps the vendors who already hold it', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();
      const created = await harness.database.db
        .insert(tags)
        .values({ name: 'Nut Free', slug: 'dietary-nut-free', category: 'dietary' })
        .returning({ id: tags.id });
      await harness.database.db
        .insert(vendorTags)
        .values({ vendorId: vendor.profileId, tagId: created[0]!.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tags/${created[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ isActive: false, vendorCount: 1 });

      const kept = await harness.database.db
        .select({ tagId: vendorTags.tagId })
        .from(vendorTags)
        .where(eq(vendorTags.tagId, created[0]!.id));
      expect(kept).toHaveLength(1);
    });

    it('renaming a tag regenerates the slug it is deduped by', async () => {
      await signIn(ADMIN, true);
      const created = await harness.database.db
        .insert(tags)
        .values({ name: 'Nut Free', slug: 'dietary-nut-free', category: 'dietary' })
        .returning({ id: tags.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tags/${created[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { name: 'Nut free menu' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: 'Nut free menu',
        slug: 'dietary-nut-free-menu',
      });
    });

    it('refuses a rename onto a name the category already uses', async () => {
      await signIn(ADMIN, true);
      await harness.database.db
        .insert(tags)
        .values({ name: 'Soy Free', slug: 'dietary-soy-free', category: 'dietary' });
      const created = await harness.database.db
        .insert(tags)
        .values({ name: 'Nut Free', slug: 'dietary-nut-free', category: 'dietary' })
        .returning({ id: tags.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tags/${created[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { name: 'soy free' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('applies a rename that only changes case', async () => {
      /*
       * It answered 200 and changed nothing. The name comparison ran through
       * `normalizeTagName`, which lowercases — so a case fix looked identical
       * to the stored value and skipped the whole block, silently.
       */
      await signIn(ADMIN, true);
      const created = await harness.database.db
        .insert(tags)
        .values({ name: 'nut free', slug: 'dietary-nut-free', category: 'dietary' })
        .returning({ id: tags.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tags/${created[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { name: 'Nut Free' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().name).toBe('Nut Free');

      const [row] = await harness.database.db
        .select({ name: tags.name })
        .from(tags)
        .where(eq(tags.id, created[0]!.id));
      expect(row!.name).toBe('Nut Free');
    });

    it('rejects an update that changes nothing', async () => {
      await signIn(ADMIN, true);
      const created = await harness.database.db
        .insert(tags)
        .values({ name: 'Nut Free', slug: 'dietary-nut-free', category: 'dietary' })
        .returning({ id: tags.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tags/${created[0]!.id}`,
        headers: bearer(ADMIN),
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
