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

interface ReviewBody {
  id: string;
  bookingId: string;
  reviewerId: string;
  vendorId: string;
  type: string;
  rating: number;
  title: string | null;
  content: string;
  isPublic: boolean;
}

describe('/reviews', () => {
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
      .set({ isPublished: true, stripeOnboarded: true })
      .where(eq(vendorProfiles.id, vendorId));

    return { vendorId, packageId: created.json().id };
  }

  /**
   * A completed booking between `CUSTOMER` and the given vendor. Inserted
   * directly rather than driven through checkout — #10 owns that flow, and a
   * direct insert is the same pattern `customers.routes.test.ts` uses for the
   * same reason.
   */
  async function completedBooking(
    vendorId: string,
    packageId: string,
    eventDate: string = EVENT_DATE,
  ): Promise<string> {
    const requestResponse = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: { vendorId, packageId, eventDate, eventType: 'wedding' },
    });
    expect(requestResponse.statusCode).toBe(201);

    const [booking] = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestResponse.json().id,
        customerId: await idOf(CUSTOMER),
        vendorId,
        eventDate,
        totalAmountCents: 145_000,
        platformFeeCents: 17_400,
        vendorPayoutCents: 127_600,
        status: 'completed',
      })
      .returning();

    return booking!.id;
  }

  async function createReview(
    actor: string,
    payload: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method: 'POST',
      url: '/reviews',
      headers: bearer(actor),
      payload,
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

  describe('POST /reviews', () => {
    it('rejects an unauthenticated create', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/reviews',
        payload: {
          bookingId: '11111111-1111-4111-8111-111111111111',
          rating: 5,
          content: 'Wonderful to work with, would book again.',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('derives customer_to_vendor for the customer, ignoring any client-sent type', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await createReview(CUSTOMER, {
        bookingId,
        rating: 5,
        title: 'Incredible day',
        content: 'Every shot felt effortless, could not be happier.',
        type: 'vendor_to_customer', // not part of the schema; must be ignored
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as ReviewBody;
      expect(body.type).toBe('customer_to_vendor');
      expect(body.vendorId).toBe(vendorId);
      expect(body.reviewerId).toBe(await idOf(CUSTOMER));
    });

    it('derives vendor_to_customer for the vendor on the same booking', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await createReview(VENDOR, {
        bookingId,
        rating: 4,
        content: 'Clear about what they wanted and ready on the day.',
      });

      expect(response.statusCode).toBe(201);
      expect((response.json() as ReviewBody).type).toBe('vendor_to_customer');
    });

    it('recomputes the vendor rating from source rows, not by incrementing', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      await createReview(CUSTOMER, { bookingId, rating: 5, content: 'Absolutely wonderful team!' });

      const profile = await harness.database.db
        .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendorId));

      expect(Number(profile[0]!.avgRating)).toBe(5);
      expect(profile[0]!.reviewCount).toBe(1);
    });

    it('recomputes the customer rating for a vendor_to_customer review', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);
      const customerId = await idOf(CUSTOMER);

      await createReview(VENDOR, {
        bookingId,
        rating: 3,
        content: 'Fine to work with, a bit slow to reply.',
      });

      const [customer] = await harness.database.db
        .select({
          avgCustomerRating: users.avgCustomerRating,
          customerReviewCount: users.customerReviewCount,
        })
        .from(users)
        .where(eq(users.id, customerId));

      expect(Number(customer!.avgCustomerRating)).toBe(3);
      expect(customer!.customerReviewCount).toBe(1);
    });

    it('averages correctly across more than one review', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const first = await completedBooking(vendorId, packageId);
      await createReview(CUSTOMER, {
        bookingId: first,
        rating: 5,
        content: 'Fantastic, could not ask for more.',
      });

      // A second completed booking with the same vendor, reviewed separately —
      // a different event date so the two requests do not collide on the live
      // booking-request unique index.
      const second = await completedBooking(
        vendorId,
        packageId,
        toDateString(addDays(new Date(), 45)),
      );
      await createReview(CUSTOMER, {
        bookingId: second,
        rating: 3,
        content: 'It was fine, nothing special really.',
      });

      const [profile] = await harness.database.db
        .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendorId));

      expect(Number(profile!.avgRating)).toBe(4);
      expect(profile!.reviewCount).toBe(2);
    });

    it('rejects a review for a booking that is not completed', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const requestResponse = await harness.app.inject({
        method: 'POST',
        url: '/booking-requests',
        headers: bearer(CUSTOMER),
        payload: { vendorId, packageId, eventDate: EVENT_DATE, eventType: 'wedding' },
      });
      const [booking] = await harness.database.db
        .insert(bookings)
        .values({
          requestId: requestResponse.json().id,
          customerId: await idOf(CUSTOMER),
          vendorId,
          eventDate: EVENT_DATE,
          totalAmountCents: 145_000,
          platformFeeCents: 17_400,
          vendorPayoutCents: 127_600,
          status: 'confirmed',
        })
        .returning();

      const response = await createReview(CUSTOMER, {
        bookingId: booking!.id,
        rating: 5,
        content: 'Great work, looking forward to the event itself.',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('hides a stranger booking id behind a 404', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await createReview(OTHER_CUSTOMER, {
        bookingId,
        rating: 5,
        content: 'Not my booking, should never reach this far.',
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns CONFLICT for a duplicate review on the same booking', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);
      const payload = {
        bookingId,
        rating: 5,
        content: 'Wonderful team, punctual and professional.',
      };

      const first = await createReview(CUSTOMER, payload);
      expect(first.statusCode).toBe(201);

      const second = await createReview(CUSTOMER, payload);
      expect(second.statusCode).toBe(409);
      expect(second.json().error).toBe('CONFLICT');
    });

    it('settles a concurrent double submission with exactly one review and one recompute', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);
      const payload = {
        bookingId,
        rating: 5,
        content: 'Wonderful team, punctual and professional.',
      };

      const [first, second] = await Promise.all([
        createReview(CUSTOMER, payload),
        createReview(CUSTOMER, payload),
      ]);

      const statuses = [first.statusCode, second.statusCode].sort();
      expect(statuses).toEqual([201, 409]);

      const [profile] = await harness.database.db
        .select({ reviewCount: vendorProfiles.reviewCount })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendorId));

      expect(profile!.reviewCount).toBe(1);
    });

    it('rejects a rating outside 1-5', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await createReview(CUSTOMER, {
        bookingId,
        rating: 6,
        content: 'This should never be stored, rating is out of range.',
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects whitespace-only content', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await createReview(CUSTOMER, {
        bookingId,
        rating: 5,
        content: '              ',
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects profane content with the specified message', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await createReview(CUSTOMER, {
        bookingId,
        rating: 1,
        content: 'This vendor did an absolutely shit job on our wedding.',
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('Review contains inappropriate language');
    });

    it('rejects profane content in the title too', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await createReview(CUSTOMER, {
        bookingId,
        rating: 1,
        title: 'Total bullshit',
        content: 'Would not recommend based on our experience overall.',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('Review contains inappropriate language');
    });
  });

  describe('GET /bookings/:bookingId/reviews', () => {
    it('rejects an unauthenticated read', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/bookings/11111111-1111-4111-8111-111111111111/reviews',
      });

      expect(response.statusCode).toBe(401);
    });

    it('lets a participant read both reviews on their booking', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      await createReview(CUSTOMER, {
        bookingId,
        rating: 5,
        content: 'Fantastic, could not ask for more.',
      });
      await createReview(VENDOR, {
        bookingId,
        rating: 4,
        content: 'Clear about what they wanted, easy day.',
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as ReviewBody[];
      expect(body).toHaveLength(2);
      expect(body.map((row) => row.type).sort()).toEqual([
        'customer_to_vendor',
        'vendor_to_customer',
      ]);
    });

    it("hides another customer's booking behind a 404", async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      const response = await harness.app.inject({
        method: 'GET',
        url: `/bookings/${bookingId}/reviews`,
        headers: bearer(OTHER_CUSTOMER),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /vendors/:slug/reviews', () => {
    async function slugOf(vendorId: string): Promise<string> {
      const [row] = await harness.database.db
        .select({ slug: vendorProfiles.slug })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendorId));
      return row!.slug;
    }

    it('is public and unauthenticated', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');

      const response = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${await slugOf(vendorId)}/reviews`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: expect.any(Number),
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    });

    it('404s for a vendor slug that does not exist', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendors/no-such-vendor/reviews',
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns only public customer_to_vendor reviews, with the five-bucket distribution', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);

      await createReview(CUSTOMER, {
        bookingId,
        rating: 5,
        title: 'Perfect day',
        content: 'Everything about working with them was easy and warm.',
      });
      // The vendor's own review of the customer must never surface here.
      await createReview(VENDOR, {
        bookingId,
        rating: 2,
        content: 'Slow to respond during planning.',
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${await slugOf(vendorId)}/reviews`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.total).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].rating).toBe(5);
      expect(body.items[0].title).toBe('Perfect day');
      expect(body.items[0].reviewerFirstName).toBe('Test');
      expect(body.items[0].reviewerLastInitial).toBe('U');
      expect(body.items[0].eventType).toBe('wedding');
      expect(body.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 });
    });

    it('paginates with limit and page, for "show more" to append', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      for (let i = 0; i < 3; i += 1) {
        // A distinct date per booking, for the same reason the averaging test
        // above needs one: two live requests for the same date collide.
        const bookingId = await completedBooking(
          vendorId,
          packageId,
          toDateString(addDays(new Date(), 30 + i)),
        );
        await createReview(CUSTOMER, {
          bookingId,
          rating: 5,
          content: `Review number ${i} for this wonderful vendor team.`,
        });
      }

      const slug = await slugOf(vendorId);

      const firstPage = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${slug}/reviews?page=1&limit=2`,
      });
      const secondPage = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${slug}/reviews?page=2&limit=2`,
      });

      expect(firstPage.json().items).toHaveLength(2);
      expect(secondPage.json().items).toHaveLength(1);
      expect(firstPage.json().total).toBe(3);

      const firstIds = firstPage.json().items.map((item: { id: string }) => item.id);
      const secondIds = secondPage.json().items.map((item: { id: string }) => item.id);
      expect(new Set([...firstIds, ...secondIds]).size).toBe(3);
    });
  });

  describe('vendor_to_customer visibility (tiered per #16)', () => {
    it('is not readable by an unrelated vendor or an anonymous caller', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await createVendor(OTHER_VENDOR, 'Northside Film');
      const bookingId = await completedBooking(vendorId, packageId);
      const customerId = await idOf(CUSTOMER);

      await createReview(VENDOR, {
        bookingId,
        rating: 4,
        content: 'Clear about what they wanted, easy day.',
      });

      const asStranger = await harness.app.inject({
        method: 'GET',
        url: `/customers/${customerId}/reviews`,
        headers: bearer(OTHER_VENDOR),
      });
      expect(asStranger.statusCode).toBe(404);

      const anonymous = await harness.app.inject({
        method: 'GET',
        url: `/customers/${customerId}/reviews`,
      });
      expect(anonymous.statusCode).toBe(401);
    });

    it('is readable by a vendor the customer has requested', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const bookingId = await completedBooking(vendorId, packageId);
      const customerId = await idOf(CUSTOMER);

      await createReview(VENDOR, {
        bookingId,
        rating: 4,
        content: 'Clear about what they wanted, easy day.',
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: `/customers/${customerId}/reviews`,
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(1);
    });
  });
});
