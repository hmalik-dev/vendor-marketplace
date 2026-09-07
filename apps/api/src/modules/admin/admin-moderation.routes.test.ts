import {
  adminActions,
  bookingRequests,
  bookings,
  categories,
  notifications,
  reviews,
  servicePackages,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { asc, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

const ADMIN = 'user_admin_mod';
const VENDOR = 'user_vendor_mod';
const CUSTOMER = 'user_customer_mod';

/**
 * Graduated moderation (#435) — the levers between doing nothing and a ban.
 *
 * Every test here is written against the thing the ticket says must **not**
 * happen as much as the thing that must: a ban declines, cancels and refunds,
 * and none of these actions may do any of that. The suite therefore asserts the
 * absence of Stripe refunds and the survival of bookings as often as it asserts
 * the state that changed.
 */
describe('admin graduated moderation', () => {
  let harness: TestHarness;
  let photographyId: string;

  const signIn = (clerkUserId: string, promoteToAdmin = false): Promise<string> =>
    signInAs(harness, clerkUserId, promoteToAdmin);

  /** A published storefront with one bookable package — the state moderation acts on. */
  async function seedVendor(
    prices: readonly number[] = [150_000],
  ): Promise<{ id: string; slug: string; packageIds: string[] }> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Fernbank Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Fernbank Studio photographs weddings across central Texas.',
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();

    const packageIds: string[] = [];
    for (const priceCents of prices) {
      const pkg = await harness.app.inject({
        method: 'POST',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
        payload: {
          name: `Package ${priceCents}`,
          description: 'A package with a description long enough to pass validation.',
          priceCents,
        },
      });
      expect(pkg.statusCode).toBe(201);
      packageIds.push(pkg.json().id as string);
    }

    const published = await harness.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: { isPublished: true },
    });
    expect(published.statusCode).toBe(200);

    return { id: body.id as string, slug: body.slug as string, packageIds };
  }

  /** A confirmed, paid booking in the future — what a ban would have unwound. */
  async function confirmedBooking(customerId: string, vendorId: string): Promise<string> {
    const eventDate = '2099-06-01';
    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId,
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
        vendorId,
        eventDate,
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        stripePaymentIntentId: 'pi_test_moderation',
      })
      .returning({ id: bookings.id });

    return bookingRows[0]!.id;
  }

  /**
   * A public review of the vendor, at a given rating.
   *
   * Inserted rather than posted: the review route requires a *completed*
   * booking, and what these tests need is a set of ratings whose average is
   * known — not another pass over the eligibility rules that route already owns.
   */
  async function seedReview(
    customerId: string,
    vendorId: string,
    rating: number,
  ): Promise<{ reviewId: string; bookingId: string }> {
    const bookingId = await confirmedBooking(customerId, vendorId);
    const inserted = await harness.database.db
      .insert(reviews)
      .values({
        bookingId,
        reviewerId: customerId,
        vendorId,
        type: 'customer_to_vendor',
        rating,
        content: `A review at ${rating} stars, long enough to look like prose.`,
      })
      .returning({ id: reviews.id });

    return { reviewId: inserted[0]!.id, bookingId };
  }

  /**
   * One portfolio photo, uploaded by the vendor who owns it.
   *
   * The key is **owner-shaped**, as the upload route mints them, because
   * `reapObjects` refuses to remove any object whose owner segment does not
   * match the id it is given — so a fixture with a made-up owner would exercise
   * the delete and reap nothing, which is the half of the behaviour worth
   * asserting.
   */
  async function seedPortfolioItemFor(
    vendorUserId: string,
  ): Promise<{ itemId: string; imageUrl: string; thumbnailUrl: string }> {
    const imageUrl = `portfolio/${vendorUserId}/4242.webp`;
    const thumbnailUrl = `portfolio/${vendorUserId}/4242-thumb.webp`;

    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/portfolio',
      headers: bearer(VENDOR),
      payload: { imageUrl, thumbnailUrl, caption: 'A wedding at dusk' },
    });
    expect(response.statusCode).toBe(201);

    return { itemId: response.json().id as string, imageUrl, thumbnailUrl };
  }

  /** The stored aggregate the storefront card and the search row both read. */
  async function storedRating(
    vendorId: string,
  ): Promise<{ avgRating: string; reviewCount: number }> {
    const rows = await harness.database.db
      .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId))
      .limit(1);

    return rows[0]!;
  }

  /**
   * Every action taken against one row, **oldest first**.
   *
   * Ordered explicitly: the callers compare against a two-element array, and
   * heap order is not row order once `afterEach` has truncated the table and
   * Postgres starts reusing the reclaimed space.
   */
  async function actionsFor(subjectId: string): Promise<{ action: string; actorId: string }[]> {
    return harness.database.db
      .select({ action: adminActions.action, actorId: adminActions.actorId })
      .from(adminActions)
      .where(eq(adminActions.subjectId, subjectId))
      .orderBy(asc(adminActions.createdAt), asc(adminActions.id));
  }

  /**
   * A vendor's private note about a customer — the other meaning of `is_public`.
   *
   * `seed-demo` writes every one of these with `isPublic: false`, which is what
   * made the console's "Unhide review" a one-click leak on any demo database.
   */
  async function seedPrivateNote(
    customerId: string,
    vendorId: string,
    vendorUserId: string,
  ): Promise<string> {
    const bookingId = await confirmedBooking(customerId, vendorId);
    const inserted = await harness.database.db
      .insert(reviews)
      .values({
        bookingId,
        reviewerId: vendorUserId,
        vendorId,
        type: 'vendor_to_customer',
        rating: 2,
        content: 'They moved the start time twice and did not tell the second shooter.',
        isPublic: false,
      })
      .returning({ id: reviews.id });

    return inserted[0]!.id;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [ADMIN, 'customer'],
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
    /*
     * `admin_actions` is **not** deleted here, and must not be: #434 made the
     * table append-only with a Postgres trigger, so `DELETE` and `TRUNCATE` both
     * raise. The rows go with the `delete(users)` below, through the one cascade
     * the trigger permits — the actor's account going is the single case where
     * an action row may disappear.
     *
     * Worth stating because it is the **inverse** of what an earlier draft of
     * this suite needed, when the actor FK still restricted and the log had to
     * be cleared first. Anyone porting teardown between the two gets it exactly
     * backwards.
     */
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(reviews);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(servicePackages);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.stripe.refunds.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  // --- Acceptance 9, over all four levers at once ---------------------------

  /**
   * **No moderation action here bans, refunds, or touches a booking.**
   *
   * Asserted directly rather than inferred from the absence of a call, and over
   * every lever in one pass rather than once per route. The unwind a ban
   * performs is being made more reusable in a neighbouring ticket, so "nothing
   * in this file calls it" is a fact with a shelf life; "the fixture came out
   * the far side of all four actions with its booking confirmed, its account
   * unbanned and Stripe untouched" is not.
   */
  it('bans nothing, refunds nothing and touches no booking, across every lever', async () => {
    await signIn(ADMIN, true);
    const customerId = await signIn(CUSTOMER);
    const vendorUserId = await signIn(VENDOR);
    const vendor = await seedVendor([90_000, 150_000]);
    const bookingId = await confirmedBooking(customerId, vendor.id);
    const review = await seedReview(customerId, vendor.id, 2);

    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({ customerId, vendorId: vendor.id, eventDate: '2099-08-08', status: 'pending' })
      .returning({ id: bookingRequests.id });

    const photo = await seedPortfolioItemFor(vendorUserId);

    const actions = [
      {
        method: 'PUT' as const,
        url: `/admin/vendors/${vendor.id}/publish`,
        payload: { isPublished: false },
      },
      {
        method: 'PUT' as const,
        url: `/admin/reviews/${review.reviewId}/visibility`,
        payload: { isPublic: false },
      },
      {
        method: 'PUT' as const,
        url: `/admin/packages/${vendor.packageIds[0]!}/active`,
        payload: { isActive: false },
      },
      { method: 'DELETE' as const, url: `/admin/portfolio-items/${photo.itemId}` },
    ];

    for (const action of actions) {
      const response = await harness.app.inject({
        method: action.method,
        url: action.url,
        headers: bearer(ADMIN),
        ...(action.payload ? { payload: action.payload } : {}),
      });
      expect([200, 204], action.url).toContain(response.statusCode);
    }

    // Not one refund, in four actions.
    expect(harness.stripe.refunds).toHaveLength(0);

    const [booking] = await harness.database.db
      .select({ status: bookings.status, id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    expect(booking).toEqual({ id: bookingId, status: 'confirmed' });

    const [request] = await harness.database.db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, requestRows[0]!.id));
    expect(request!.status).toBe('pending');

    const [owner] = await harness.database.db
      .select({ isBanned: users.isBanned, bannedAt: users.bannedAt })
      .from(users)
      .where(eq(users.id, vendorUserId));
    expect(owner).toEqual({ isBanned: false, bannedAt: null });
  });

  // --- Acceptance 1, 2 and 9: a storefront comes down without a ban ---------

  describe('PUT /admin/vendors/:vendorId/publish', () => {
    it('takes the storefront off search and 404s its slug, and unwinds nothing', async () => {
      const actorId = await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await seedVendor();
      const bookingId = await confirmedBooking(customerId, vendor.id);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        vendorId: vendor.id,
        isPublished: false,
        status: 'review',
      });

      const profile = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(profile.statusCode).toBe(404);

      const search = await harness.app.inject({ method: 'GET', url: '/vendors' });
      expect(search.statusCode).toBe(200);
      expect(search.json().items.map((row: { slug: string }) => row.slug)).not.toContain(
        vendor.slug,
      );

      /*
       * The half of the acceptance that is the whole point (acceptance 9). A ban
       * would have cancelled this booking, refunded it in full and reversed the
       * vendor's share out of their Stripe balance.
       */
      const booking = await harness.database.db
        .select({ status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);
      expect(booking[0]!.status).toBe('confirmed');
      expect(harness.stripe.refunds).toHaveLength(0);

      const owner = await harness.database.db
        .select({ isBanned: users.isBanned })
        .from(users)
        .where(eq(users.clerkUserId, VENDOR))
        .limit(1);
      expect(owner[0]!.isBanned).toBe(false);

      expect(await actionsFor(vendor.id)).toEqual([{ action: 'vendor_unpublished', actorId }]);
    });

    it('leaves open requests alone, where a ban would decline them', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await seedVendor();

      const requestRows = await harness.database.db
        .insert(bookingRequests)
        .values({ customerId, vendorId: vendor.id, eventDate: '2099-07-04', status: 'pending' })
        .returning({ id: bookingRequests.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: false },
      });
      expect(response.statusCode).toBe(200);

      const request = await harness.database.db
        .select({ status: bookingRequests.status })
        .from(bookingRequests)
        .where(eq(bookingRequests.id, requestRows[0]!.id))
        .limit(1);
      expect(request[0]!.status).toBe('pending');
    });

    it('republishes what it took down', async () => {
      const actorId = await signIn(ADMIN, true);
      const vendor = await seedVendor();

      const down = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: false },
      });
      expect(down.statusCode).toBe(200);

      const up = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: true },
      });

      expect(up.statusCode).toBe(200);
      expect(up.json()).toEqual({ vendorId: vendor.id, isPublished: true, status: 'live' });

      const profile = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(profile.statusCode).toBe(200);

      expect(await actionsFor(vendor.id)).toEqual([
        { action: 'vendor_unpublished', actorId },
        { action: 'vendor_republished', actorId },
      ]);
    });

    it('answers 409 when the storefront is already in that state', async () => {
      await signIn(ADMIN, true);
      const vendor = await seedVendor();

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: true },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('That storefront is already published');
      expect(await actionsFor(vendor.id)).toHaveLength(0);
    });

    it('refuses to republish a suspended account, whose owner cannot run it', async () => {
      await signIn(ADMIN, true);
      const vendor = await seedVendor();
      const vendorUserId = await signIn(VENDOR);

      const banned = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendorUserId}/ban`,
        headers: bearer(ADMIN),
      });
      expect(banned.statusCode).toBe(200);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: true },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'Lift the suspension on this account before republishing its storefront',
      );
    });

    it('refuses to republish a storefront with nothing bookable on it', async () => {
      await signIn(ADMIN, true);
      const vendor = await seedVendor();

      await harness.database.db
        .update(servicePackages)
        .set({ isActive: false })
        .where(eq(servicePackages.vendorId, vendor.id));
      await harness.database.db
        .update(vendorProfiles)
        .set({ isPublished: false })
        .where(eq(vendorProfiles.id, vendor.id));

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: true },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details.blockers).toContain('packages');
    });

    /**
     * A missing owner is unverifiable, not unbanned.
     *
     * `findUserById` excludes soft-deleted accounts, and the Clerk webhook
     * soft-deletes the user while leaving the vendor profile behind — so
     * `owner?.isBanned` read `false` for an account that no longer exists and
     * republished a storefront that would take booking requests nobody can
     * answer. Found by the security audit, not by a failing test.
     */
    it('refuses to republish a storefront whose owner account is gone', async () => {
      await signIn(ADMIN, true);
      const vendorUserId = await signIn(VENDOR);
      const vendor = await seedVendor();

      const down = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: false },
      });
      expect(down.statusCode).toBe(200);

      // What the Clerk `user.deleted` webhook does: the account goes, the
      // storefront stays.
      await harness.database.db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, vendorUserId));

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: true },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'That storefront has no active owner account to publish it for',
      );

      const [row] = await harness.database.db
        .select({ isPublished: vendorProfiles.isPublished })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendor.id));
      expect(row!.isPublished).toBe(false);
    });

    /**
     * Taking one **down** never needs the owner check — that is the safe
     * direction, and refusing it would strand a live listing behind a deleted
     * account with no way to remove it.
     */
    it('still unpublishes a storefront whose owner account is gone', async () => {
      await signIn(ADMIN, true);
      const vendorUserId = await signIn(VENDOR);
      const vendor = await seedVendor();

      await harness.database.db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, vendorUserId));

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendor.id}/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: false },
      });

      expect(response.statusCode).toBe(200);
      /*
       * The **status**, not only the flag. Asserting `isPublished` alone let the
       * response claim `status: 'review'` for a row the Vendors table renders as
       * `Retired` — the derived status was hard-coded rather than derived, and
       * this fixture is the one that reaches it. Found by review, not by a
       * failing test, which is exactly why the assertion is widened here.
       */
      expect(response.json()).toEqual({
        vendorId: vendor.id,
        isPublished: false,
        status: 'retired',
      });
    });

    it('answers 404 for a storefront that does not exist', async () => {
      await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${'0'.repeat(8)}-0000-4000-8000-000000000000/publish`,
        headers: bearer(ADMIN),
        payload: { isPublished: false },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // --- Acceptance 4, 5, 6 and 8: hiding a review ----------------------------

  describe('PUT /admin/reviews/:reviewId/visibility', () => {
    it('removes the review from every public read and from the rating', async () => {
      const actorId = await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await seedVendor();
      const kept = await seedReview(customerId, vendor.id, 5);
      const hidden = await seedReview(customerId, vendor.id, 1);

      /*
       * The live summary, which is derived from the rows rather than read off
       * `vendor_profiles` — the seeded rows have not been through a recompute
       * yet, and this is the number a visitor would have been shown.
       */
      const before = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${vendor.slug}/reviews`,
      });
      expect(before.json().summary).toMatchObject({ avgRating: 3, reviewCount: 2 });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${hidden.reviewId}/visibility`,
        headers: bearer(ADMIN),
        payload: { isPublic: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        reviewId: hidden.reviewId,
        isPublic: false,
        vendorAvgRating: '5.00',
        vendorReviewCount: 1,
      });

      // The stored aggregate — what the search row and the profile header read.
      expect(await storedRating(vendor.id)).toEqual({ avgRating: '5.00', reviewCount: 1 });

      /*
       * Acceptance 6, asserted per surface rather than on the DAO: the list, the
       * live summary above it, and the profile payload are three reads and the
       * column was honoured by none of them before this ticket.
       */
      const list = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${vendor.slug}/reviews`,
      });
      expect(list.statusCode).toBe(200);
      const page = list.json();
      expect(page.items.map((row: { id: string }) => row.id)).toEqual([kept.reviewId]);
      expect(page.summary.reviewCount).toBe(1);
      expect(page.summary.avgRating).toBe(5);
      expect(page.summary.distribution).toEqual([0, 0, 0, 0, 1]);

      const profile = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(profile.statusCode).toBe(200);
      expect(profile.json().reviewCount).toBe(1);
      expect(profile.json().avgRating).toBe(5);

      expect(await actionsFor(hidden.reviewId)).toEqual([{ action: 'review_hidden', actorId }]);
    });

    /**
     * Two paths, one answer — the ticket's own required test.
     *
     * Hiding is meant to be deletion's reversible twin, so the rating it leaves
     * behind has to be the number deleting the same review would have produced.
     * Asserted by doing both to identical fixtures rather than by reading the
     * two functions and agreeing they look alike.
     */
    it('leaves exactly the rating deleting the same review would have', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await seedVendor();
      await seedReview(customerId, vendor.id, 5);
      await seedReview(customerId, vendor.id, 4);
      const target = await seedReview(customerId, vendor.id, 1);

      const hide = await harness.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${target.reviewId}/visibility`,
        headers: bearer(ADMIN),
        payload: { isPublic: false },
      });
      expect(hide.statusCode).toBe(200);
      const afterHiding = await storedRating(vendor.id);

      // Put it back, then delete it instead, and compare the two answers.
      const unhide = await harness.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${target.reviewId}/visibility`,
        headers: bearer(ADMIN),
        payload: { isPublic: true },
      });
      expect(unhide.statusCode).toBe(200);

      const deleted = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${target.reviewId}`,
        headers: bearer(ADMIN),
      });
      expect(deleted.statusCode).toBe(204);

      expect(afterHiding).toEqual(await storedRating(vendor.id));
      expect(afterHiding).toEqual({ avgRating: '4.50', reviewCount: 2 });
    });

    it('restores the review and the rating when it is unhidden', async () => {
      const actorId = await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await seedVendor();
      await seedReview(customerId, vendor.id, 5);
      const target = await seedReview(customerId, vendor.id, 1);

      for (const isPublic of [false, true]) {
        const response = await harness.app.inject({
          method: 'PUT',
          url: `/admin/reviews/${target.reviewId}/visibility`,
          headers: bearer(ADMIN),
          payload: { isPublic },
        });
        expect(response.statusCode).toBe(200);
      }

      expect(await storedRating(vendor.id)).toEqual({ avgRating: '3.00', reviewCount: 2 });

      const list = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${vendor.slug}/reviews`,
      });
      expect(list.json().items).toHaveLength(2);
      expect(list.json().summary.avgRating).toBe(3);

      expect(await actionsFor(target.reviewId)).toEqual([
        { action: 'review_hidden', actorId },
        { action: 'review_unhidden', actorId },
      ]);
    });

    it('shows the operator which reviews are hidden', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await seedVendor();
      const target = await seedReview(customerId, vendor.id, 2);

      const hidden = await harness.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${target.reviewId}/visibility`,
        headers: bearer(ADMIN),
        payload: { isPublic: false },
      });
      expect(hidden.statusCode).toBe(200);

      const list = await harness.app.inject({
        method: 'GET',
        url: '/admin/reviews',
        headers: bearer(ADMIN),
      });

      expect(list.statusCode).toBe(200);
      const rows = list.json().items;
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(target.reviewId);
      expect(rows[0].isPublic).toBe(false);
    });

    it('answers 409 when the review is already in that state, and 404 when it is gone', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await seedVendor();
      const target = await seedReview(customerId, vendor.id, 3);

      const conflict = await harness.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${target.reviewId}/visibility`,
        headers: bearer(ADMIN),
        payload: { isPublic: true },
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json().message).toBe('That review is already visible');

      const missing = await harness.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${'0'.repeat(8)}-0000-4000-8000-000000000000/visibility`,
        headers: bearer(ADMIN),
        payload: { isPublic: false },
      });
      expect(missing.statusCode).toBe(404);
    });

    /**
     * **`is_public` means two things, and this lever owns only one of them.**
     *
     * On a `customer_to_vendor` row it is the moderator's hide flag. On a
     * `vendor_to_customer` row it is the *author's* choice about whether other
     * vendors may read their note about a customer. Sharing a column, the
     * console offered "Unhide review" over both — and `seed-demo` writes every
     * private note `isPublic: false`, so publishing one to every other vendor
     * was a single click on any demo database.
     *
     * Refused at the route, not only hidden in the console: the console is not
     * the only caller this route will ever have.
     */
    it('refuses to publish a vendor’s private note about a customer', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendorUserId = await signIn(VENDOR);
      const vendor = await seedVendor();
      const noteId = await seedPrivateNote(customerId, vendor.id, vendorUserId);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${noteId}/visibility`,
        headers: bearer(ADMIN),
        payload: { isPublic: true },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('private note about a customer');

      // The state the leak would have produced, asserted on the column itself.
      const [stored] = await harness.database.db
        .select({ isPublic: reviews.isPublic })
        .from(reviews)
        .where(eq(reviews.id, noteId));
      expect(stored!.isPublic).toBe(false);
      expect(await actionsFor(noteId)).toHaveLength(0);
    });

    /** The other direction of the same refusal — the lever does not apply at all. */
    it('refuses to hide a private note too, rather than pretending it is moderation', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendorUserId = await signIn(VENDOR);
      const vendor = await seedVendor();
      const noteId = await seedPrivateNote(customerId, vendor.id, vendorUserId);

      await harness.database.db
        .update(reviews)
        .set({ isPublic: true })
        .where(eq(reviews.id, noteId));

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${noteId}/visibility`,
        headers: bearer(ADMIN),
        payload: { isPublic: false },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('private note about a customer');
    });

    /**
     * A private note is still **deletable** — that is the lever that applies to
     * it — and deleting one must not disturb the storefront rating, because it
     * was never counted in it.
     */
    it('still deletes a private note, and moves the customer’s rating not the vendor’s', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendorUserId = await signIn(VENDOR);
      const vendor = await seedVendor();
      await seedReview(customerId, vendor.id, 4);
      const noteId = await seedPrivateNote(customerId, vendor.id, vendorUserId);

      // Give the storefront rating a value to be undisturbed.
      const hidden = await harness.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${(await seedReview(customerId, vendor.id, 2)).reviewId}/visibility`,
        headers: bearer(ADMIN),
        payload: { isPublic: false },
      });
      expect(hidden.statusCode).toBe(200);
      const before = await storedRating(vendor.id);

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${noteId}`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(204);
      expect(await storedRating(vendor.id)).toEqual(before);
      expect(await actionsFor(noteId)).toEqual([
        { action: 'review_deleted', actorId: await signIn(ADMIN, true) },
      ]);
    });

    it('records who deleted a review, so hiding and its escalation share a history', async () => {
      const actorId = await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      const vendor = await seedVendor();
      const target = await seedReview(customerId, vendor.id, 3);

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${target.reviewId}`,
        headers: bearer(ADMIN),
      });
      expect(response.statusCode).toBe(204);

      // The row outlives the review, which is why `target_id` carries no FK.
      expect(await actionsFor(target.reviewId)).toEqual([{ action: 'review_deleted', actorId }]);
    });
  });

  // --- Acceptance 7: a package comes off the storefront ---------------------

  describe('PUT /admin/packages/:packageId/active', () => {
    it('removes the package from the storefront and from the From price', async () => {
      const actorId = await signIn(ADMIN, true);
      await signIn(CUSTOMER);
      const vendor = await seedVendor([90_000, 150_000]);
      const cheapest = vendor.packageIds[0]!;

      const before = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(before.json().startingPriceCents).toBe(90_000);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/packages/${cheapest}/active`,
        headers: bearer(ADMIN),
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        packageId: cheapest,
        isActive: false,
        vendorUnpublished: false,
      });

      const after = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(after.statusCode).toBe(200);
      expect(after.json().startingPriceCents).toBe(150_000);
      expect(after.json().packages.map((row: { id: string }) => row.id)).not.toContain(cheapest);

      expect(await actionsFor(cheapest)).toEqual([{ action: 'package_deactivated', actorId }]);
    });

    it('reactivates it', async () => {
      const actorId = await signIn(ADMIN, true);
      const vendor = await seedVendor([90_000, 150_000]);
      const cheapest = vendor.packageIds[0]!;

      for (const isActive of [false, true]) {
        const response = await harness.app.inject({
          method: 'PUT',
          url: `/admin/packages/${cheapest}/active`,
          headers: bearer(ADMIN),
          payload: { isActive },
        });
        expect(response.statusCode).toBe(200);
      }

      const after = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(after.json().startingPriceCents).toBe(90_000);

      expect(await actionsFor(cheapest)).toEqual([
        { action: 'package_deactivated', actorId },
        { action: 'package_reactivated', actorId },
      ]);
    });

    /**
     * Publishing requires one bookable package, so removing the last one takes
     * the storefront with it — the same rule the vendor's own editor enforces.
     * The operator asked to remove a service and took a business off the
     * marketplace, so the result has to say so.
     */
    it('unpublishes the storefront when the last bookable package goes', async () => {
      const actorId = await signIn(ADMIN, true);
      const vendor = await seedVendor();
      const only = vendor.packageIds[0]!;

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/packages/${only}/active`,
        headers: bearer(ADMIN),
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().vendorUnpublished).toBe(true);

      const profile = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(profile.statusCode).toBe(404);

      expect(await actionsFor(vendor.id)).toEqual([{ action: 'vendor_unpublished', actorId }]);
    });

    it('answers 409 when the package is already in that state, and 404 when it is gone', async () => {
      await signIn(ADMIN, true);
      const vendor = await seedVendor();

      const conflict = await harness.app.inject({
        method: 'PUT',
        url: `/admin/packages/${vendor.packageIds[0]!}/active`,
        headers: bearer(ADMIN),
        payload: { isActive: true },
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json().message).toBe('That package is already active');

      const missing = await harness.app.inject({
        method: 'PUT',
        url: `/admin/packages/${'0'.repeat(8)}-0000-4000-8000-000000000000/active`,
        headers: bearer(ADMIN),
        payload: { isActive: false },
      });
      expect(missing.statusCode).toBe(404);
    });
  });

  // --- The one permanent lever ---------------------------------------------

  describe('DELETE /admin/portfolio-items/:itemId', () => {
    /**
     * The row **and the objects behind it**.
     *
     * The one behaviour this path does not share with the vendor's own delete is
     * that it reaps with the *vendor's* user id rather than the caller's, and
     * `reapObjects` swallows every failure — so passing the operator's id would
     * leave every removed photo in the bucket, silently, and a test that only
     * checked the row would stay green through it.
     */
    it('removes the photo, its stored objects, and records who removed it', async () => {
      const actorId = await signIn(ADMIN, true);
      const vendorUserId = await signIn(VENDOR);
      const vendor = await seedVendor();
      const item = await seedPortfolioItemFor(vendorUserId);

      harness.storedObjects.length = 0;
      harness.storedObjects.push(
        { key: item.imageUrl, body: Buffer.alloc(0), contentType: 'image/webp' },
        { key: item.thumbnailUrl, body: Buffer.alloc(0), contentType: 'image/webp' },
      );

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/portfolio-items/${item.itemId}`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(204);
      expect(harness.storedObjects.map((object) => object.key)).toEqual([]);

      const profile = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(profile.statusCode).toBe(200);
      expect(profile.json().portfolio).toHaveLength(0);

      expect(await actionsFor(item.itemId)).toEqual([
        { action: 'portfolio_item_removed', actorId },
      ]);
    });

    it('answers 404 for a photo that does not exist', async () => {
      await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/portfolio-items/${'0'.repeat(8)}-0000-4000-8000-000000000000`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
