import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  reviews,
  servicePackages,
  users,
  vendorProfiles,
  type NotificationRow,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  MAX_NAME_LENGTH,
  REVIEW_PAGE_SIZE,
  toDateString,
} from '@vendor-marketplace/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { deleteReviewAndRecalculate } from './reviews.dao.js';

const VENDOR = 'user_vendor';
const OTHER_VENDOR = 'user_vendor_two';
const CUSTOMER = 'user_customer';
const OTHER_CUSTOMER = 'user_customer_two';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

interface ReviewsBody {
  items: {
    id: string;
    rating: number;
    title: string | null;
    content: string;
    reviewerName: string;
    eventType: string | null;
  }[];
  summary: { avgRating: number | null; reviewCount: number; distribution: number[] };
  viewer: { canReview: boolean; bookingId: string | null };
  page: number;
  pageSize: number;
  hasMore: boolean;
}

describe('reviews', () => {
  let harness: TestHarness;
  let photographyId: string;

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

  /**
   * This user's review notifications only. Booking setup leaves `new_request`
   * rows behind, so a bare count over the table would assert about those too.
   */
  async function reviewNotificationsFor(clerkUserId: string): Promise<NotificationRow[]> {
    return harness.database.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, await idOf(clerkUserId)),
          eq(notifications.type, 'new_review'),
        ),
      );
  }

  /** The vendor's denormalised pair, as numbers — `avg_rating` is a numeric. */
  async function vendorRating(
    vendorId: string,
  ): Promise<{ avgRating: number; reviewCount: number }> {
    const rows = await harness.database.db
      .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId));

    return { avgRating: Number(rows[0]!.avgRating), reviewCount: rows[0]!.reviewCount };
  }

  /** The same pair on the private direction, which lands on the customer. */
  async function customerRating(
    customerId: string,
  ): Promise<{ avgCustomerRating: number; customerReviewCount: number }> {
    const rows = await harness.database.db
      .select({
        avgCustomerRating: users.avgCustomerRating,
        customerReviewCount: users.customerReviewCount,
      })
      .from(users)
      .where(eq(users.id, customerId));

    return {
      avgCustomerRating: Number(rows[0]!.avgCustomerRating),
      customerReviewCount: rows[0]!.customerReviewCount,
    };
  }

  async function createVendor(
    clerkUserId: string,
    businessName: string,
  ): Promise<{ vendorId: string; slug: string; packageId: string }> {
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
        responseTimeHours: 24,
      },
    });
    expect(profile.statusCode).toBe(201);

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
      .set({ isPublished: true, stripeOnboarded: true })
      .where(eq(vendorProfiles.id, profile.json().id));

    return {
      vendorId: profile.json().id,
      slug: profile.json().slug,
      packageId: created.json().id,
    };
  }

  /** A completed booking between `CUSTOMER` and the vendor, ready to review. */
  async function completedBooking(
    vendorId: string,
    packageId: string,
    options: {
      customer?: string;
      eventType?: string;
      status?: 'completed' | 'confirmed';
      /**
       * Days past the default event date. `booking_requests` carries a partial
       * unique index over customer + vendor + date + package for *live*
       * statuses, so a second request on the same date is treated as the same
       * request and answers 200 — which is correct, and means a test wanting
       * several distinct bookings has to move the date.
       */
      dayOffset?: number;
    } = {},
  ): Promise<string> {
    const customer = options.customer ?? CUSTOMER;
    const eventDate = toDateString(addDays(new Date(), 30 + (options.dayOffset ?? 0)));

    const requested = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(customer),
      payload: {
        vendorId,
        packageId,
        eventDate,
        eventType: options.eventType ?? 'wedding',
      },
    });
    expect(requested.statusCode).toBe(201);

    const booking = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requested.json().id,
        customerId: await idOf(customer),
        vendorId,
        eventDate,
        totalAmountCents: 145_000,
        platformFeeCents: 17_400,
        vendorPayoutCents: 127_600,
        status: options.status ?? 'completed',
        completedAt: new Date(),
      })
      .returning();

    return booking[0]!.id;
  }

  function reviewBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      rating: 5,
      title: 'Worth every penny',
      content: 'They read the room all day and the photographs prove it.',
      ...overrides,
    };
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    // The identities the fake token verifier resolves. Without them there is
    // no user row for a profile to hang off, and every route 500s.
    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [OTHER_VENDOR, 'vendor', 'ada@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
      [OTHER_CUSTOMER, 'customer', 'lin@example.com'],
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

  // Deleted in dependency order; reference data (categories, tags) survives,
  // as it does in a real deployment.
  afterEach(async () => {
    await harness.database.db.delete(reviews);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(servicePackages);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('POST /bookings/:bookingId/reviews', () => {
    it('files a customer review, and derives the vendor’s rating from it', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(CUSTOMER),
        payload: reviewBody({ rating: 4 }),
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.rating).toBe(4);
      expect(body.type).toBe('customer_to_vendor');
      expect(body.bookingId).toBe(bookingId);
      expect(body.title).toBe('Worth every penny');

      // The denormalised columns are re-derived in the same transaction.
      const rows = await harness.database.db
        .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendorId));

      expect(Number(rows[0]!.avgRating)).toBe(4);
      expect(rows[0]!.reviewCount).toBe(1);
    });

    /*
     * The type is decided from the booking's two parties, never from the
     * client. A vendor reviewing their own customer must not land as a public
     * `customer_to_vendor` row on their own profile.
     */
    it('files the vendor’s review as the private direction', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(VENDOR),
        payload: reviewBody({ title: 'Easy to work with' }),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().type).toBe('vendor_to_customer');

      // It moved the customer's rating, not the vendor's.
      const vendorRows = await harness.database.db
        .select({ reviewCount: vendorProfiles.reviewCount })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendorId));
      expect(vendorRows[0]!.reviewCount).toBe(0);

      const customerRows = await harness.database.db
        .select({
          avgCustomerRating: users.avgCustomerRating,
          customerReviewCount: users.customerReviewCount,
        })
        .from(users)
        .where(eq(users.id, await idOf(CUSTOMER)));
      expect(Number(customerRows[0]!.avgCustomerRating)).toBe(5);
      expect(customerRows[0]!.customerReviewCount).toBe(1);
    });

    /*
     * The `href` the bell links to, not just the payload it is built from.
     * Deleting the `new_review` branch of `notificationHref` left every suite
     * green while the notification rendered unclickable in both directions —
     * a `bookingId` alone falls through to `null`.
     */
    it('links each party to the surface their review is readable on', async () => {
      const { vendorId, packageId, slug } = await createVendor(VENDOR, 'Kessler & Co.');
      const first = await completedBooking(vendorId, packageId);
      const second = await completedBooking(vendorId, packageId, { dayOffset: 1 });

      const posted = await Promise.all(
        [
          [first, CUSTOMER],
          [second, VENDOR],
        ].map(([bookingId, actor]) =>
          harness.app.inject({
            method: 'POST',
            url: `/bookings/${bookingId}/reviews`,
            headers: bearer(actor as string),
            payload: reviewBody(),
          }),
        ),
      );
      for (const response of posted) {
        expect(response.statusCode).toBe(201);
      }

      // The vendor reads a public review on their own profile's Reviews tab.
      const toVendor = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(VENDOR),
      });
      expect(toVendor.statusCode).toBe(200);
      const vendorReview = toVendor
        .json()
        .items.find((item: { type: string }) => item.type === 'new_review');
      expect(vendorReview.href).toBe(`/vendors/${slug}?tab=reviews`);

      // The customer reads a private one on theirs — there is no public page.
      const toCustomer = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(CUSTOMER),
      });
      expect(toCustomer.statusCode).toBe(200);
      const customerReview = toCustomer
        .json()
        .items.find((item: { type: string }) => item.type === 'new_review');
      expect(customerReview.href).toBe('/customer/profile?tab=reviews');
    });

    it('averages across reviews rather than overwriting', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const first = await completedBooking(vendorId, packageId);
      const second = await completedBooking(vendorId, packageId, { customer: OTHER_CUSTOMER });

      for (const [bookingId, actor, rating] of [
        [first, CUSTOMER, 5],
        [second, OTHER_CUSTOMER, 2],
      ] as const) {
        const response = await harness.app.inject({
          method: 'POST',
          url: `/bookings/${bookingId}/reviews`,
          headers: bearer(actor),
          payload: reviewBody({ rating }),
        });
        expect(response.statusCode).toBe(201);
      }

      const rows = await harness.database.db
        .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendorId));

      expect(Number(rows[0]!.avgRating)).toBe(3.5);
      expect(rows[0]!.reviewCount).toBe(2);
    });

    /*
     * The notification is the third step of the same transaction. Without it a
     * vendor learns they have been reviewed only by opening their own public
     * profile, which is the one place they have no reason to look.
     */
    it('notifies the reviewed party, addressed to the surface that shows it', async () => {
      const { vendorId, packageId, slug } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(CUSTOMER),
        payload: reviewBody({ rating: 4 }),
      });
      expect(response.statusCode).toBe(201);

      const rows = await reviewNotificationsFor(VENDOR);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.title).toBe('New review');
      expect(rows[0]!.body).toBe('Test left you a 4-star review.');
      expect(rows[0]!.data).toEqual({ bookingId, vendorSlug: slug });

      // The reviewer is not notified about their own review.
      expect(await reviewNotificationsFor(CUSTOMER)).toHaveLength(0);
    });

    /*
     * A private review has no public page, so its notification must not carry a
     * vendor slug — that is what routes the customer to their own profile
     * rather than to the vendor's Reviews tab, where it does not appear.
     */
    it('notifies the customer of a private review without a public destination', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(VENDOR),
        payload: reviewBody({ rating: 3 }),
      });
      expect(response.statusCode).toBe(201);

      const rows = await reviewNotificationsFor(CUSTOMER);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.body).toBe('Kessler & Co. left you a 3-star review.');
      expect(rows[0]!.data).toEqual({ bookingId });
    });

    it('refuses a booking that has not completed', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId, { status: 'confirmed' });

      const response = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(CUSTOMER),
        payload: reviewBody(),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('once the event has happened');
    });

    /*
     * 404 rather than 403, so the response does not confirm that a booking id
     * exists to someone who has no part in it.
     */
    it('gives a stranger 404, not 403, for someone else’s booking', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      await createVendor(OTHER_VENDOR, 'Delaney Rowe');
      const bookingId = await completedBooking(vendorId, packageId);

      for (const actor of [OTHER_CUSTOMER, OTHER_VENDOR]) {
        const response = await harness.app.inject({
          method: 'POST',
          url: `/bookings/${bookingId}/reviews`,
          headers: bearer(actor),
          payload: reviewBody(),
        });

        expect(response.statusCode, actor).toBe(404);
      }
    });

    it('refuses an unknown booking and an unauthenticated caller', async () => {
      const unknown = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${UNKNOWN_ID}/reviews`,
        headers: bearer(CUSTOMER),
        payload: reviewBody(),
      });
      expect(unknown.statusCode).toBe(404);

      const anonymous = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${UNKNOWN_ID}/reviews`,
        payload: reviewBody(),
      });
      expect(anonymous.statusCode).toBe(401);
    });

    it('allows one review per party per booking', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      const first = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(CUSTOMER),
        payload: reviewBody(),
      });
      expect(first.statusCode).toBe(201);

      const second = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(CUSTOMER),
        payload: reviewBody({ rating: 1 }),
      });
      expect(second.statusCode).toBe(409);

      // The other party is unaffected — they are separate rows by design.
      const vendorReview = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(VENDOR),
        payload: reviewBody(),
      });
      expect(vendorReview.statusCode).toBe(201);
    });

    it('refuses language it will not publish, in the title as well as the body', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      for (const payload of [
        reviewBody({ content: 'This was a total shitshow from start to finish.' }),
        reviewBody({ title: 'What a bitch' }),
      ]) {
        const response = await harness.app.inject({
          method: 'POST',
          url: `/bookings/${bookingId}/reviews`,
          headers: bearer(CUSTOMER),
          payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toContain('cannot publish');
      }
    });

    /*
     * The filter is a floor, and a floor may miss words — it may not refuse a
     * caterer's review for describing food. `spicy`, `spice`, `shitake` and
     * `retardant` were all rejected while the stems carried a `\w*` suffix,
     * with an accusation and no appeal; `assessment`, `classic` and `niggle`
     * are the same failure from the other direction.
     */
    it('publishes words that merely contain a blocked one', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');

      const innocent = [
        'Their assessment of the venue was spot on, and the classic shots are lovely.',
        'The spicy chicken and the shitake mushrooms were the best food of the night.',
        'They brought flame retardant drapes and a spice rack for the tasting table.',
        'Not one niggle all day, and no niggling over the invoice afterwards.',
      ];

      for (const [index, content] of innocent.entries()) {
        const bookingId = await completedBooking(vendorId, packageId, {
          customer: index % 2 === 0 ? CUSTOMER : OTHER_CUSTOMER,
          dayOffset: index,
        });

        const response = await harness.app.inject({
          method: 'POST',
          url: `/bookings/${bookingId}/reviews`,
          headers: bearer(index % 2 === 0 ? CUSTOMER : OTHER_CUSTOMER),
          payload: reviewBody({ content }),
        });

        expect(response.statusCode, content).toBe(201);
      }
    });

    /*
     * A first name may be exactly `MAX_NAME_LENGTH`, and the display name is
     * that plus a space, an initial and a stop — 103. Bounding the response at
     * 100 made the row un-serialisable, so one customer saving a long first
     * name 500ed the whole Reviews tab for every reader of that vendor.
     */
    it('serialises a reviewer whose first name fills the column', async () => {
      const longFirstName = 'A'.repeat(MAX_NAME_LENGTH);
      const stored = harness.clerkUsers.get(CUSTOMER)!;
      harness.clerkUsers.set(CUSTOMER, { ...stored, firstName: longFirstName });

      try {
        const { vendorId, packageId, slug } = await createVendor(VENDOR, 'Kessler & Co.');
        const bookingId = await completedBooking(vendorId, packageId);

        await harness.database.db
          .update(users)
          .set({ firstName: longFirstName })
          .where(eq(users.id, await idOf(CUSTOMER)));

        const posted = await harness.app.inject({
          method: 'POST',
          url: `/bookings/${bookingId}/reviews`,
          headers: bearer(CUSTOMER),
          payload: reviewBody(),
        });
        expect(posted.statusCode).toBe(201);

        const listed = await harness.app.inject({
          method: 'GET',
          url: `/vendors/${slug}/reviews`,
        });

        expect(listed.statusCode).toBe(200);
        expect((listed.json() as ReviewsBody).items[0]!.reviewerName).toBe(`${longFirstName} U.`);
      } finally {
        harness.clerkUsers.set(CUSTOMER, stored);
      }
    });

    it('rejects a rating outside the scale and a body under the floor', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      for (const payload of [
        reviewBody({ rating: 6 }),
        reviewBody({ rating: 0 }),
        reviewBody({ rating: 4.5 }),
        reviewBody({ content: 'Great.' }),
      ]) {
        const response = await harness.app.inject({
          method: 'POST',
          url: `/bookings/${bookingId}/reviews`,
          headers: bearer(CUSTOMER),
          payload,
        });

        expect(response.statusCode, JSON.stringify(payload)).toBe(400);
      }
    });
  });

  describe('GET /vendors/:slug/reviews', () => {
    it('returns the public reviews, the summary and an empty viewer when signed out', async () => {
      const { vendorId, packageId, slug } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId, { eventType: 'wedding' });

      await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(CUSTOMER),
        payload: reviewBody({ rating: 4 }),
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${slug}/reviews`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as ReviewsBody;

      expect(body.items).toHaveLength(1);
      expect(body.items[0]!.rating).toBe(4);
      expect(body.items[0]!.eventType).toBe('wedding');
      expect(body.summary.avgRating).toBe(4);
      expect(body.summary.reviewCount).toBe(1);
      // Ascending from 1: one four-star review is the fourth bucket.
      expect(body.summary.distribution).toEqual([0, 0, 0, 1, 0]);
      expect(body.viewer).toEqual({ canReview: false, bookingId: null });
      expect(body.hasMore).toBe(false);
    });

    /*
     * A full name beside an event date and a city identifies someone at a
     * wedding, so the card gets a first name and an initial and the surname
     * never leaves the API.
     */
    it('names the reviewer by first name and initial only', async () => {
      const { vendorId, packageId, slug } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);
      const customerId = await idOf(CUSTOMER);

      await harness.database.db
        .update(users)
        .set({ firstName: 'Priya', lastName: 'Mehta' })
        .where(eq(users.id, customerId));

      await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(CUSTOMER),
        payload: reviewBody(),
      });

      const body = (
        await harness.app.inject({ method: 'GET', url: `/vendors/${slug}/reviews` })
      ).json() as ReviewsBody;

      expect(body.items[0]!.reviewerName).toBe('Priya M.');
      expect(JSON.stringify(body)).not.toContain('Mehta');
    });

    it('never returns the private vendor-to-customer direction', async () => {
      const { vendorId, packageId, slug } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      const filed = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(VENDOR),
        payload: reviewBody({ content: 'They were decisive and paid on time, no chasing.' }),
      });
      expect(filed.statusCode).toBe(201);

      const body = (
        await harness.app.inject({ method: 'GET', url: `/vendors/${slug}/reviews` })
      ).json() as ReviewsBody;

      expect(body.items).toHaveLength(0);
      expect(body.summary.reviewCount).toBe(0);
      expect(body.summary.avgRating).toBeNull();
      expect(body.summary.distribution).toEqual([0, 0, 0, 0, 0]);

      /*
       * The acceptance asks for both readers, and a signed-in one is the case
       * a signed-out request cannot stand in for: an unrelated vendor holds a
       * session and a vendor role, which is precisely the caller a
       * role-shaped check would let through.
       */
      await createVendor(OTHER_VENDOR, 'Delaney Rowe');
      const asOtherVendor = (
        await harness.app.inject({
          method: 'GET',
          url: `/vendors/${slug}/reviews`,
          headers: bearer(OTHER_VENDOR),
        })
      ).json() as ReviewsBody;

      expect(asOtherVendor.items).toHaveLength(0);
      expect(asOtherVendor.summary.reviewCount).toBe(0);
      expect(asOtherVendor.viewer).toEqual({ canReview: false, bookingId: null });
    });

    it('offers the write action only to a customer with an unreviewed completed booking', async () => {
      const { vendorId, packageId, slug } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      const eligible = (
        await harness.app.inject({
          method: 'GET',
          url: `/vendors/${slug}/reviews`,
          headers: bearer(CUSTOMER),
        })
      ).json() as ReviewsBody;
      expect(eligible.viewer).toEqual({ canReview: true, bookingId });

      // A customer with no booking here, and the vendor themselves, get nothing.
      for (const actor of [OTHER_CUSTOMER, VENDOR]) {
        const body = (
          await harness.app.inject({
            method: 'GET',
            url: `/vendors/${slug}/reviews`,
            headers: bearer(actor),
          })
        ).json() as ReviewsBody;

        expect(body.viewer.canReview, actor).toBe(false);
      }

      // And it closes once the review is written.
      await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(CUSTOMER),
        payload: reviewBody(),
      });

      const after = (
        await harness.app.inject({
          method: 'GET',
          url: `/vendors/${slug}/reviews`,
          headers: bearer(CUSTOMER),
        })
      ).json() as ReviewsBody;
      expect(after.viewer).toEqual({ canReview: false, bookingId: null });
    });

    it('appends a page at a time and says when there is more', async () => {
      const { vendorId, packageId, slug } = await createVendor(VENDOR, 'Kessler & Co.');
      const reviewerId = await idOf(CUSTOMER);

      // One more than a page, so `hasMore` has something to be true about.
      for (let index = 0; index <= REVIEW_PAGE_SIZE; index += 1) {
        const bookingId = await completedBooking(vendorId, packageId, { dayOffset: index });
        await harness.database.db.insert(reviews).values({
          bookingId,
          reviewerId,
          vendorId,
          type: 'customer_to_vendor',
          rating: 5,
          content: `Review number ${index} of this vendor, long enough to pass.`,
        });
      }

      const first = (
        await harness.app.inject({ method: 'GET', url: `/vendors/${slug}/reviews` })
      ).json() as ReviewsBody;
      expect(first.items).toHaveLength(REVIEW_PAGE_SIZE);
      expect(first.hasMore).toBe(true);
      expect(first.summary.reviewCount).toBe(REVIEW_PAGE_SIZE + 1);

      const second = (
        await harness.app.inject({ method: 'GET', url: `/vendors/${slug}/reviews?page=2` })
      ).json() as ReviewsBody;
      expect(second.items).toHaveLength(1);
      expect(second.hasMore).toBe(false);

      // Appending must not repeat a row it already showed.
      const seen = new Set(first.items.map((item) => item.id));
      expect(seen.has(second.items[0]!.id)).toBe(false);
    });

    /*
     * `.claude/rules/web-route-boundaries.md`: a page number is URL input, and
     * a negative one becomes a negative OFFSET, which Postgres rejects.
     */
    it('renders rather than 500ing for a hostile page number', async () => {
      const { slug } = await createVendor(VENDOR, 'Kessler & Co.');

      for (const query of ['?page=0', '?page=-1', '?page=abc', '?page=99999999999999999999']) {
        const response = await harness.app.inject({
          method: 'GET',
          url: `/vendors/${slug}/reviews${query}`,
        });

        expect(response.statusCode, query).toBe(200);
      }
    });

    it('404s for an unknown vendor, and for one that is not published', async () => {
      const unknown = await harness.app.inject({
        method: 'GET',
        url: '/vendors/no-such-vendor/reviews',
      });
      expect(unknown.statusCode).toBe(404);

      const { vendorId, slug } = await createVendor(VENDOR, 'Kessler & Co.');
      await harness.database.db
        .update(vendorProfiles)
        .set({ isPublished: false })
        .where(eq(vendorProfiles.id, vendorId));

      const unpublished = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${slug}/reviews`,
      });
      expect(unpublished.statusCode).toBe(404);
    });
  });

  /*
   * No route reaches this yet — moderation is #15 — but the derivation it runs
   * is the one the insert runs, and the reason it lives beside the insert is
   * that two copies of it would eventually disagree. Exercised directly, so
   * that a change to either half fails here rather than in #15's surface.
   */
  describe('deleteReviewAndRecalculate', () => {
    it('re-derives the vendor’s rating from what is left', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const first = await completedBooking(vendorId, packageId);
      const second = await completedBooking(vendorId, packageId, { customer: OTHER_CUSTOMER });

      const ids: string[] = [];
      for (const [bookingId, actor, rating] of [
        [first, CUSTOMER, 5],
        [second, OTHER_CUSTOMER, 1],
      ] as const) {
        const response = await harness.app.inject({
          method: 'POST',
          url: `/bookings/${bookingId}/reviews`,
          headers: bearer(actor),
          payload: reviewBody({ rating }),
        });
        expect(response.statusCode).toBe(201);
        ids.push(response.json().id);
      }

      expect(await vendorRating(vendorId)).toEqual({ avgRating: 3, reviewCount: 2 });

      expect(await deleteReviewAndRecalculate(harness.database.db, ids[1]!)).toBe(true);
      expect(await vendorRating(vendorId)).toEqual({ avgRating: 5, reviewCount: 1 });

      // The last one leaves zeroes, not a NULL and not the stale average.
      expect(await deleteReviewAndRecalculate(harness.database.db, ids[0]!)).toBe(true);
      expect(await vendorRating(vendorId)).toEqual({ avgRating: 0, reviewCount: 0 });
    });

    it('re-derives the customer’s rating for the private direction', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Kessler & Co.');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(VENDOR),
        payload: reviewBody({ rating: 2 }),
      });
      expect(response.statusCode).toBe(201);

      const customerId = await idOf(CUSTOMER);
      expect(await customerRating(customerId)).toEqual({
        avgCustomerRating: 2,
        customerReviewCount: 1,
      });

      expect(await deleteReviewAndRecalculate(harness.database.db, response.json().id)).toBe(true);
      expect(await customerRating(customerId)).toEqual({
        avgCustomerRating: 0,
        customerReviewCount: 0,
      });
    });

    it('is a no-op for a review that is already gone', async () => {
      expect(await deleteReviewAndRecalculate(harness.database.db, UNKNOWN_ID)).toBe(false);
    });
  });
});
