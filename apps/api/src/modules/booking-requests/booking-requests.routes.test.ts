import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { addDays, BOOKING_REQUEST_EXPIRY_DAYS, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const OTHER_VENDOR = 'user_vendor_two';
const CUSTOMER = 'user_customer';
const OTHER_CUSTOMER = 'user_customer_two';

const NOW = new Date();
const EVENT_DATE = toDateString(addDays(NOW, 30));
const OTHER_DATE = toDateString(addDays(NOW, 45));
const PAST_DATE = toDateString(addDays(NOW, -30));

interface RequestBody {
  id: string;
  status: string;
  finalPriceCents: number | null;
  quotedPriceCents: number | null;
  eventType: string | null;
  eventLocation: string | null;
  eventStartTime: string | null;
  guestCount: number | null;
  vendor: { id: string; businessName: string; avgRating: number };
  package: { id: string; name: string; priceCents: number } | null;
}

describe('/booking-requests', () => {
  let harness: TestHarness;
  let photographyId: string;

  /** A published vendor with one active package, ready to be booked. */
  async function createVendor(
    clerkUserId: string,
    businessName: string,
    options: { publish?: boolean; onboarded?: boolean } = {},
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
        inclusions: ['6 hours', '2 photographers'],
      },
    });
    expect(created.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({
        isPublished: options.publish ?? true,
        stripeOnboarded: options.onboarded ?? true,
      })
      .where(eq(vendorProfiles.id, vendorId));

    return { vendorId, packageId: created.json().id };
  }

  async function post(
    clerkUserId: string,
    url: string,
    payload?: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method: 'POST',
      url,
      headers: bearer(clerkUserId),
      ...(payload ? { payload } : {}),
    });
  }

  async function createRequest(
    vendorId: string,
    overrides: Record<string, unknown> = {},
    actor = CUSTOMER,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return post(actor, '/booking-requests', {
      vendorId,
      eventDate: EVENT_DATE,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      eventStartTime: '14:00',
      guestCount: 120,
      ...overrides,
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

  describe('authorization', () => {
    it('rejects an unauthenticated create', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/booking-requests',
        payload: {
          vendorId: '11111111-1111-4111-8111-111111111111',
          eventDate: EVENT_DATE,
          packageId: '22222222-2222-4222-8222-222222222222',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects a vendor creating a request', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      const response = await createRequest(vendorId, { packageId }, OTHER_VENDOR);

      expect(response.statusCode).toBe(403);
    });

    it('hides another customer request behind a 404', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      const response = await harness.app.inject({
        method: 'GET',
        url: `/booking-requests/${created.json().id}`,
        headers: bearer(OTHER_CUSTOMER),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /booking-requests', () => {
    it('locks the package price and returns the vendor and package', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      const response = await createRequest(vendorId, { packageId });

      expect(response.statusCode).toBe(201);
      const body = response.json() as RequestBody;
      expect(body.status).toBe('pending');
      expect(body.finalPriceCents).toBe(145_000);
      expect(body.package?.priceCents).toBe(145_000);
      expect(body.vendor.businessName).toBe('Sunlit Studio');
      expect(body.eventType).toBe('wedding');
      expect(body.eventLocation).toBe('Barr Mansion, Austin, TX');
      expect(body.eventStartTime).toBe('14:00');
      expect(body.guestCount).toBe(120);
    });

    it('leaves a custom request unpriced until it is quoted', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');

      const response = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as RequestBody;
      expect(body.finalPriceCents).toBeNull();
      expect(body.package).toBeNull();
    });

    it('sets expiry a week out', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      const created = await createRequest(vendorId, { packageId });
      const rows = await harness.database.db
        .select({ expiresAt: bookingRequests.expiresAt })
        .from(bookingRequests)
        .where(eq(bookingRequests.id, created.json().id));

      const days = (rows[0]!.expiresAt!.getTime() - Date.now()) / 86_400_000;
      expect(Math.round(days)).toBe(BOOKING_REQUEST_EXPIRY_DAYS);
    });

    it('opens exactly one conversation, however many requests are sent', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      expect((await createRequest(vendorId, { packageId })).statusCode).toBe(201);
      expect((await createRequest(vendorId, { packageId, eventDate: OTHER_DATE })).statusCode).toBe(
        201,
      );

      const threads = await harness.database.db.select().from(conversations);
      expect(threads).toHaveLength(1);
    });

    it('notifies the vendor', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await createRequest(vendorId, { packageId });

      const rows = await harness.database.db
        .select({ type: notifications.type })
        .from(notifications);

      expect(rows.map((row) => row.type)).toEqual(['new_request']);
    });

    it('refuses an unpublished vendor', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio', {
        publish: false,
      });

      const response = await createRequest(vendorId, { packageId });

      expect(response.statusCode).toBe(404);
    });

    it('refuses a past date', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      const response = await createRequest(vendorId, { packageId, eventDate: PAST_DATE });

      expect(response.statusCode).toBe(400);
    });

    it('refuses a date that is already booked', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await harness.database.db
        .insert(availability)
        .values({ vendorId, date: EVENT_DATE, status: 'booked' });

      const response = await createRequest(vendorId, { packageId });

      expect(response.statusCode).toBe(409);
    });

    it('allows a blocked date, because the vendor may still say yes', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await harness.database.db
        .insert(availability)
        .values({ vendorId, date: EVENT_DATE, status: 'blocked' });

      const response = await createRequest(vendorId, { packageId });

      expect(response.statusCode).toBe(201);
    });

    it('refuses a package belonging to a different vendor', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const other = await createVendor(OTHER_VENDOR, 'Northside Film');

      const response = await createRequest(vendorId, { packageId: other.packageId });

      expect(response.statusCode).toBe(404);
    });

    it('refuses an occasion outside the vocabulary', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      const response = await createRequest(vendorId, { packageId, eventType: 'Wedding' });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /booking-requests', () => {
    it('gives the customer their own requests and the vendor their queue', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await createRequest(vendorId, { packageId });

      for (const actor of [CUSTOMER, VENDOR]) {
        const response = await harness.app.inject({
          method: 'GET',
          url: '/booking-requests',
          headers: bearer(actor),
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toHaveLength(1);
      }
    });

    it('does not leak another customer requests', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await createRequest(vendorId, { packageId });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/booking-requests',
        headers: bearer(OTHER_CUSTOMER),
      });

      expect(response.json()).toEqual([]);
    });

    it('filters by status', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await createRequest(vendorId, { packageId });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/booking-requests?status=declined',
        headers: bearer(CUSTOMER),
      });

      expect(response.json()).toEqual([]);
    });
  });

  describe('expiry', () => {
    it('ages a request past its window on the next read, and notifies the customer', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });
      const requestId: string = created.json().id;

      await harness.database.db
        .update(bookingRequests)
        .set({ expiresAt: addDays(new Date(), -1) })
        .where(eq(bookingRequests.id, requestId));

      const response = await harness.app.inject({
        method: 'GET',
        url: `/booking-requests/${requestId}`,
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      expect((response.json() as RequestBody).status).toBe('expired');

      const types = await harness.database.db
        .select({ type: notifications.type })
        .from(notifications);
      expect(types.map((row) => row.type)).toContain('request_expired');
    });

    it('refuses to accept a request that has already expired', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });
      const requestId: string = created.json().id;

      await harness.database.db
        .update(bookingRequests)
        .set({ expiresAt: addDays(new Date(), -1) })
        .where(eq(bookingRequests.id, requestId));

      const response = await post(VENDOR, `/booking-requests/${requestId}/accept`);

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('INVALID_STATE_TRANSITION');
    });
  });

  describe('transitions', () => {
    it('pending -> accepted by the vendor, and holds the date', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/accept`);

      expect(response.statusCode).toBe(200);
      const body = response.json() as RequestBody;
      expect(body.status).toBe('accepted');
      expect(body.finalPriceCents).toBe(145_000);

      const held = await harness.database.db
        .select({ status: availability.status })
        .from(availability)
        .where(eq(availability.vendorId, vendorId));
      expect(held).toEqual([{ status: 'pending' }]);
    });

    it('pending -> quoted -> accepted locks the quoted price', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });
      const requestId: string = created.json().id;

      const quoted = await post(VENDOR, `/booking-requests/${requestId}/quote`, {
        quotedPriceCents: 90_000,
        quoteNote: 'Includes travel to Zilker.',
      });
      expect(quoted.statusCode).toBe(200);
      expect((quoted.json() as RequestBody).status).toBe('quoted');
      expect((quoted.json() as RequestBody).finalPriceCents).toBeNull();

      const accepted = await post(CUSTOMER, `/booking-requests/${requestId}/accept`);
      expect(accepted.statusCode).toBe(200);
      const body = accepted.json() as RequestBody;
      expect(body.status).toBe('accepted');
      expect(body.finalPriceCents).toBe(90_000);
    });

    it('pending -> declined by the vendor', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/decline`);

      expect(response.statusCode).toBe(200);
      expect((response.json() as RequestBody).status).toBe('declined');
    });

    it('quoted -> declined by the vendor withdrawing the quote', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });
      const requestId: string = created.json().id;
      await post(VENDOR, `/booking-requests/${requestId}/quote`, { quotedPriceCents: 90_000 });

      const response = await post(VENDOR, `/booking-requests/${requestId}/decline`);

      expect(response.statusCode).toBe(200);
      expect((response.json() as RequestBody).status).toBe('declined');
    });

    it('pending -> cancelled by the customer', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      const response = await post(CUSTOMER, `/booking-requests/${created.json().id}/cancel`);

      expect(response.statusCode).toBe(200);
      expect((response.json() as RequestBody).status).toBe('cancelled');
    });

    it('quoted -> cancelled by the customer', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });
      const requestId: string = created.json().id;
      await post(VENDOR, `/booking-requests/${requestId}/quote`, { quotedPriceCents: 90_000 });

      const response = await post(CUSTOMER, `/booking-requests/${requestId}/cancel`);

      expect(response.statusCode).toBe(200);
      expect((response.json() as RequestBody).status).toBe('cancelled');
    });

    it('notifies the other party on every transition', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });
      await post(VENDOR, `/booking-requests/${created.json().id}/accept`);

      const rows = await harness.database.db
        .select({ type: notifications.type, userId: notifications.userId })
        .from(notifications);

      expect(rows.map((row) => row.type)).toEqual(['new_request', 'request_accepted']);
      // The acceptance is addressed to the customer, who did not make it.
      const customer = await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, CUSTOMER));
      expect(rows[1]!.userId).toBe(customer[0]!.id);
    });
  });

  describe('rejected transitions', () => {
    it('refuses a second decision on a settled request', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });
      const requestId: string = created.json().id;
      await post(VENDOR, `/booking-requests/${requestId}/decline`);

      for (const action of ['accept', 'decline', 'quote', 'cancel']) {
        const actor = action === 'cancel' ? CUSTOMER : VENDOR;
        const response = await post(
          actor,
          `/booking-requests/${requestId}/${action}`,
          action === 'quote' ? { quotedPriceCents: 90_000 } : undefined,
        );

        expect(response.statusCode).toBe(409);
        expect(response.json().error).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('refuses to quote a request that is already accepted', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });
      const requestId: string = created.json().id;
      await post(VENDOR, `/booking-requests/${requestId}/quote`, { quotedPriceCents: 90_000 });
      await post(CUSTOMER, `/booking-requests/${requestId}/accept`);

      const response = await post(VENDOR, `/booking-requests/${requestId}/quote`, {
        quotedPriceCents: 95_000,
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('INVALID_STATE_TRANSITION');
    });

    it('refuses to re-quote a package request, whose price is locked', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/quote`, {
        quotedPriceCents: 200_000,
      });

      expect(response.statusCode).toBe(400);
    });

    it('refuses a quote under the minimum booking amount', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/quote`, {
        quotedPriceCents: 2_400,
      });

      expect(response.statusCode).toBe(400);
    });

    it('refuses the customer accepting their own pending request', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      const response = await post(CUSTOMER, `/booking-requests/${created.json().id}/accept`);

      expect(response.statusCode).toBe(403);
    });

    it('refuses the vendor cancelling', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/cancel`);

      expect(response.statusCode).toBe(403);
    });

    it('refuses acceptance while the vendor cannot take payment', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio', {
        onboarded: false,
      });
      const created = await createRequest(vendorId, { packageId });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/accept`);

      expect(response.statusCode).toBe(402);
      expect(response.json().error).toBe('PAYMENT_REQUIRED');
    });

    it('refuses acceptance once the date was booked elsewhere', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });
      await harness.database.db
        .insert(availability)
        .values({ vendorId, date: EVENT_DATE, status: 'booked' });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/accept`);

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('CONFLICT');
    });
  });

  describe('GET /bookings', () => {
    it('carries the occasion and the venue on every booking', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });
      const request = created.json() as RequestBody;

      const customer = await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, CUSTOMER));

      await harness.database.db.insert(bookings).values({
        requestId: request.id,
        customerId: customer[0]!.id,
        vendorId,
        eventDate: EVENT_DATE,
        eventLocation: 'Barr Mansion, Austin, TX',
        totalAmountCents: 145_000,
        platformFeeCents: 17_400,
        vendorPayoutCents: 127_600,
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/bookings',
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      const [booking] = response.json() as { eventType: string; venue: string }[];
      expect(booking?.eventType).toBe('wedding');
      expect(booking?.venue).toBe('Barr Mansion, Austin, TX');
    });

    it('is empty for someone with no bookings', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/bookings',
        headers: bearer(OTHER_CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });
});
