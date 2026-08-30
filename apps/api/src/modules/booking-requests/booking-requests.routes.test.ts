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
import {
  addDays,
  BOOKING_REQUEST_EXPIRY_DAYS,
  ERROR_CODES,
  MAX_PACKAGE_PRICE_CENTS,
  MIN_BOOKING_AMOUNT_CENTS,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq, sql } from 'drizzle-orm';
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

    /*
     * This used to assert one thread per pair, and #219 is why it does not any
     * more: a customer who asked the same photographer about two dates saw both
     * negotiations under whichever line came first, and the context rail —
     * headed **This request**, offering `Send revised quote` and `Accept
     * as-is` — had no single request to act on.
     */
    it('opens one conversation per request, each carrying its own booking', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      const first = await createRequest(vendorId, { packageId });
      const second = await createRequest(vendorId, { packageId, eventDate: OTHER_DATE });
      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);

      const threads = await harness.database.db.select().from(conversations);

      expect(threads).toHaveLength(2);
      expect(new Set(threads.map((thread) => thread.bookingRequestId))).toEqual(
        new Set([first.json().id, second.json().id]),
      );
    });

    /*
     * The other half of the same rule. A retry after a half-finished attempt
     * re-creates the request row, and the thread must not double with it.
     */
    it('reuses the thread when the same request is submitted twice', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      const first = await createRequest(vendorId, { packageId });
      const repeat = await createRequest(vendorId, { packageId });

      expect(first.statusCode).toBe(201);
      // 200, not 201: this is the request you already made.
      expect(repeat.statusCode).toBe(200);
      expect(repeat.json().id).toBe(first.json().id);

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

    it('creates one request when three identical submissions race', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Wren & Field');

      /*
       * These three interleave at their `await` points, which is what the
       * sequential cases below do not do. They are not truly parallel: the
       * harness runs one in-process PGlite on a single connection, so the
       * inserts serialize and each conflict resolves against a committed row
       * rather than a blocking one. What settles the genuinely parallel case
       * is the unique index itself, which `schema.test.ts` exercises directly.
       */
      const responses = await Promise.all([
        createRequest(vendorId, { packageId }),
        createRequest(vendorId, { packageId }),
        createRequest(vendorId, { packageId }),
      ]);

      const ids = responses.map((response) => response.json<RequestBody>().id);
      expect(new Set(ids).size).toBe(1);
      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 200, 201]);

      const rows = await harness.database.db
        .select({ id: bookingRequests.id })
        .from(bookingRequests);
      expect(rows).toHaveLength(1);
    });

    it('answers a repeat submission with the existing request, not a second one', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Wren & Field');

      const first = await createRequest(vendorId, { packageId });
      const second = await createRequest(vendorId, { packageId });

      expect(first.statusCode).toBe(201);
      // The constraint violation surfaces as the record that already exists.
      expect(second.statusCode).toBe(200);
      expect(second.json<RequestBody>().id).toBe(first.json<RequestBody>().id);
      expect(second.headers.location).toBe(`/booking-requests/${first.json<RequestBody>().id}`);
    });

    it('does not notify the vendor a second time about the same request', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Wren & Field');

      await createRequest(vendorId, { packageId });
      await createRequest(vendorId, { packageId });

      const rows = await harness.database.db
        .select({ type: notifications.type })
        .from(notifications);

      expect(rows.map((row) => row.type)).toEqual(['new_request']);
    });

    it('dedupes two custom requests, where neither carries a package', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Wren & Field');

      const first = await createRequest(vendorId, {
        customDetails: 'A two-hour engagement shoot in the botanical garden.',
      });
      const second = await createRequest(vendorId, {
        customDetails: 'A two-hour engagement shoot in the botanical garden.',
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(200);
      expect(second.json<RequestBody>().id).toBe(first.json<RequestBody>().id);
    });

    it('lets the customer ask again once the first request is no longer live', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Wren & Field');

      const first = await createRequest(vendorId, { packageId });
      const withdrawn = await post(
        CUSTOMER,
        `/booking-requests/${first.json<RequestBody>().id}/cancel`,
      );
      expect(withdrawn.statusCode).toBe(200);

      const second = await createRequest(vendorId, { packageId });

      expect(second.statusCode).toBe(201);
      expect(second.json<RequestBody>().id).not.toBe(first.json<RequestBody>().id);
    });

    it('keeps two customers asking the same vendor for the same date apart', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Wren & Field');

      const mine = await createRequest(vendorId, { packageId });
      const theirs = await createRequest(vendorId, { packageId }, OTHER_CUSTOMER);

      expect(theirs.statusCode).toBe(201);
      expect(theirs.json<RequestBody>().id).not.toBe(mine.json<RequestBody>().id);
    });

    it('leaves no request behind when a later write in the same create fails', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Wren & Field');

      // A real failure from the engine rather than a mocked DAO: the
      // notification insert is the last of the three writes a create makes.
      await harness.database.db.execute(
        sql`CREATE OR REPLACE FUNCTION refuse_notification() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'notification storage is down'; END;
            $$ LANGUAGE plpgsql`,
      );
      await harness.database.db.execute(
        sql`CREATE TRIGGER refuse_notification_trigger BEFORE INSERT ON notifications
            FOR EACH ROW EXECUTE FUNCTION refuse_notification()`,
      );

      try {
        expect((await createRequest(vendorId, { packageId })).statusCode).toBe(500);

        /*
         * The row must not survive the failure. A committed request whose
         * conversation and notification never happened would be found by
         * every retry, which then takes the dedupe branch and skips those
         * side effects deliberately — so the vendor would never be told, and
         * no later request could repair it.
         */
        const orphans = await harness.database.db
          .select({ id: bookingRequests.id })
          .from(bookingRequests);
        expect(orphans).toEqual([]);
      } finally {
        await harness.database.db.execute(
          sql`DROP TRIGGER refuse_notification_trigger ON notifications`,
        );
        await harness.database.db.execute(sql`DROP FUNCTION refuse_notification()`);
      }

      // And the retry creates it for real, with the vendor told exactly once.
      const retried = await createRequest(vendorId, { packageId });
      expect(retried.statusCode).toBe(201);

      const told = await harness.database.db
        .select({ type: notifications.type })
        .from(notifications);
      expect(told.map((row) => row.type)).toEqual(['new_request']);
    });

    it('dedupes against a request the vendor has already quoted', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Wren & Field');
      const first = await createRequest(vendorId, {
        customDetails: 'A two-hour engagement shoot in the botanical garden.',
      });

      const quoted = await post(VENDOR, `/booking-requests/${first.json<RequestBody>().id}/quote`, {
        quotedPriceCents: 90_000,
        quoteNote: 'Two hours, one photographer, gallery in three weeks.',
      });
      expect(quoted.statusCode).toBe(200);

      // A quote takes the request out of `pending` without settling it, and it
      // is still the vendor's to answer. Resubmitting must not open a second.
      const second = await createRequest(vendorId, {
        customDetails: 'A two-hour engagement shoot in the botanical garden.',
      });

      expect(second.statusCode).toBe(200);
      expect(second.json<RequestBody>().id).toBe(first.json<RequestBody>().id);
    });

    it('returns the stored request unchanged when a resubmission carries edited details', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Wren & Field');
      const first = await createRequest(vendorId, { packageId, eventLocation: 'Barr Mansion' });

      const edited = await createRequest(vendorId, {
        packageId,
        eventLocation: 'The Vista',
        guestCount: 40,
      });

      /*
       * The natural key does not include the detail fields, so this is read as
       * a repeat submission and the edit is NOT applied — the response carries
       * the stored request, venue and all. Pinned deliberately rather than
       * left to chance: the server cannot tell a retry from a correction
       * without an idempotency key, and letting a resubmission overwrite is a
       * product decision that belongs with the customer-side edit surface in
       * #68. Filed as #232.
       */
      expect(edited.statusCode).toBe(200);
      expect(edited.json<RequestBody>().id).toBe(first.json<RequestBody>().id);
      expect(edited.json<RequestBody>().eventLocation).toBe('Barr Mansion');
      expect(edited.json<RequestBody>().guestCount).toBe(120);
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
    it('pending -> accepted by the vendor, and books the date', async () => {
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
      expect(held).toEqual([{ status: 'booked' }]);
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

    /*
     * Both bounds, asserted at the boundary rather than deep inside it.
     *
     * They failed in opposite ways in the browser: below the minimum the client
     * sent nothing at all and said nothing, while above the maximum the request
     * went out and the vendor was shown the API's own `Request validation
     * failed`. The endpoint's job is to refuse both with a code the client can
     * turn into a written sentence, which is what these pin.
     */
    it('refuses a quote below the minimum booking amount', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/quote`, {
        quotedPriceCents: MIN_BOOKING_AMOUNT_CENTS - 1,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: ERROR_CODES.VALIDATION_ERROR });
    });

    it('refuses a quote above the maximum package price', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/quote`, {
        quotedPriceCents: MAX_PACKAGE_PRICE_CENTS + 1,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: ERROR_CODES.VALIDATION_ERROR });
    });

    it('accepts a quote exactly on each bound', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const atMinimum = await createRequest(vendorId, {
        customDetails: 'A single hour of portraits, nothing more than that.',
      });

      const response = await post(VENDOR, `/booking-requests/${atMinimum.json().id}/quote`, {
        quotedPriceCents: MIN_BOOKING_AMOUNT_CENTS,
      });

      expect(response.statusCode).toBe(200);
      expect((response.json() as RequestBody).quotedPriceCents).toBe(MIN_BOOKING_AMOUNT_CENTS);
    });

    /*
     * The restriction #218 is about, asserted so the customer-facing promise
     * stays honest: a packaged request carries a locked price, so the vendor's
     * only routes are to confirm it or decline. The copy on the request screen
     * now says exactly that, and this is what it is describing.
     */
    it('refuses to re-quote a request already priced by its package', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      const response = await post(VENDOR, `/booking-requests/${created.json().id}/quote`, {
        quotedPriceCents: 90_000,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('This request is already priced by its package');
    });

    /*
     * The notification promised "open the request to see the price and accept
     * it" and linked to the hub, because the request had no page. It has one
     * now, and this is what stops the promise drifting from the destination
     * again.
     */
    it('deep-links the quoted notification at the request, not the hub', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });
      const requestId: string = created.json().id;

      await post(VENDOR, `/booking-requests/${requestId}/quote`, { quotedPriceCents: 90_000 });

      const inbox = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(CUSTOMER),
      });
      expect(inbox.statusCode).toBe(200);

      const quoted = (
        inbox.json() as { items: { type: string; href: string | null }[] }
      ).items.find((item) => item.type === 'request_quoted');
      expect(quoted?.href).toBe(`/bookings/${requestId}`);
    });

    /*
     * The event date was bounded below — a date past everywhere on Earth is
     * refused — and not above, so `9999-12-31` was a bookable event and got
     * stored. Nothing downstream expects one: the expiry window, the days-until
     * arithmetic and every calendar read assume a working horizon.
     */
    it('refuses an event date beyond the booking horizon', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');

      const response = await createRequest(vendorId, { packageId, eventDate: '9999-12-31' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        statusCode: 400,
        error: ERROR_CODES.VALIDATION_ERROR,
      });
    });

    it('accepts a long-lead date inside the horizon', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      // Eighteen months out — the genuine wedding case the ceiling must not eat.
      const longLead = toDateString(addDays(NOW, 540));

      const response = await createRequest(vendorId, { packageId, eventDate: longLead });

      expect(response.statusCode).toBe(201);
      expect((response.json() as RequestBody).status).toBe('pending');
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

    /*
     * #309. The customer's own quote screen draws "Decline" beside "Accept" —
     * `quote-review.tsx` renders it, and frame `06` puts it there. The service
     * refused it: `prepareTransition` allowed `decline` for the vendor only,
     * so the one control the frame gives the customer for saying no answered
     * 403.
     *
     * Nothing caught it because the web test mocks the transport and asserts
     * the URL it called. A test that asserts a request was *sent* cannot see
     * the answer coming back, so it passed on a button that never worked.
     */
    it('quoted -> declined by the customer turning the quote down', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });
      const requestId: string = created.json().id;
      await post(VENDOR, `/booking-requests/${requestId}/quote`, { quotedPriceCents: 90_000 });

      const response = await post(CUSTOMER, `/booking-requests/${requestId}/decline`);

      expect(response.statusCode).toBe(200);
      expect((response.json() as RequestBody).status).toBe('declined');
    });

    /*
     * The asymmetry is deliberate and it is the whole authorization rule.
     * Declining a `pending` request means "I will not take this booking",
     * which is the vendor's answer to make. A customer with no quote in front
     * of them has nothing to decline — withdrawing is `cancel`, and it is
     * theirs.
     */
    it('refuses a customer declining before any quote exists', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      const response = await post(CUSTOMER, `/booking-requests/${created.json().id}/decline`);

      expect(response.statusCode).toBe(403);
      expect((response.json() as { message: string }).message).toContain('quote');
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

    /*
     * The invariant the test above names — "the other party" — held only for
     * `accept`, which is the one transition it exercised. Decline addressed
     * the customer unconditionally, which was correct while only the vendor
     * could decline. Once the customer could turn a quote down, it told them
     * their own decision back, attributed to the vendor: "Sunlit Studio
     * declined". The vendor, who needed to know their quote was dead, got
     * nothing.
     */
    it('tells the vendor, not the customer, when the customer declines a quote', async () => {
      const { vendorId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, {
        customDetails: 'Two hours of engagement portraits at Zilker at sunset.',
      });
      const requestId: string = created.json().id;
      await post(VENDOR, `/booking-requests/${requestId}/quote`, { quotedPriceCents: 90_000 });
      await post(CUSTOMER, `/booking-requests/${requestId}/decline`);

      const rows = await harness.database.db
        .select({ type: notifications.type, userId: notifications.userId })
        .from(notifications);
      const declined = rows.filter((row) => row.type === 'request_declined');

      const vendorUser = await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, VENDOR));

      expect(declined).toHaveLength(1);
      expect(declined[0]!.userId).toBe(vendorUser[0]!.id);
    });

    /* The vendor's own decline still reaches the customer, as it always did. */
    it('tells the customer when the vendor declines', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });
      await post(VENDOR, `/booking-requests/${created.json().id}/decline`);

      const rows = await harness.database.db
        .select({ type: notifications.type, userId: notifications.userId })
        .from(notifications);
      const declined = rows.filter((row) => row.type === 'request_declined');

      const customer = await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, CUSTOMER));

      expect(declined).toHaveLength(1);
      expect(declined[0]!.userId).toBe(customer[0]!.id);
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

  /**
   * The privacy line from `CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES`: a
   * vendor deciding whether to take the work sees a first name and an initial,
   * and a vendor who has committed to the date can reach the customer.
   */
  describe('customer identity disclosure', () => {
    async function customerOn(requestId: string, actor: string): Promise<Record<string, unknown>> {
      const response = await harness.app.inject({
        method: 'GET',
        url: `/booking-requests/${requestId}`,
        headers: bearer(actor),
      });

      expect(response.statusCode).toBe(200);
      return (response.json() as { customer: Record<string, unknown> }).customer;
    }

    it('withholds the surname and contact details while the request is pending', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      expect(await customerOn(created.json().id, VENDOR)).toEqual({
        firstName: 'Test',
        lastInitial: 'U',
        lastName: null,
        email: null,
        phone: null,
      });
    });

    it('discloses the surname and email once the vendor has accepted', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });
      const requestId: string = created.json().id;

      await post(VENDOR, `/booking-requests/${requestId}/accept`);

      expect(await customerOn(requestId, VENDOR)).toEqual({
        firstName: 'Test',
        lastInitial: 'U',
        lastName: 'User',
        email: 'alan@example.com',
        phone: null,
      });
    });

    it('keeps the details withheld when the vendor declined instead', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });
      const requestId: string = created.json().id;

      await post(VENDOR, `/booking-requests/${requestId}/decline`);

      expect(await customerOn(requestId, VENDOR)).toMatchObject({
        lastName: null,
        email: null,
      });
    });
  });

  /**
   * `#212`: the calendar cell and the request queue are one source of truth.
   * Before this, accept wrote `pending` and a merely-pending request wrote
   * nothing, so the cell read one state out of step in both directions.
   */
  describe('the calendar the requests hold', () => {
    async function statusOn(vendorId: string, date: string): Promise<string | null> {
      const rows = await harness.database.db
        .select({ status: availability.status, date: availability.date })
        .from(availability)
        .where(eq(availability.vendorId, vendorId));

      return rows.find((row) => row.date === date)?.status ?? null;
    }

    /*
     * The market stays truthful while a request is merely live. Search excludes
     * any vendor whose row for the date is not `available`, so storing one here
     * would take the vendor out of every date-filtered search for a week over a
     * request they have not answered.
     */
    it('stores nothing while the request is only pending', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await createRequest(vendorId, { packageId });

      expect(await statusOn(vendorId, EVENT_DATE)).toBeNull();
    });

    it('frees the date when the accepted request on it is the one declined', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      const created = await createRequest(vendorId, { packageId });

      await post(VENDOR, `/booking-requests/${created.json().id}/decline`);

      expect(await statusOn(vendorId, EVENT_DATE)).toBeNull();
    });

    it('leaves a date the vendor blocked blocked after a request on it is declined', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await harness.database.db
        .insert(availability)
        .values({ vendorId, date: OTHER_DATE, status: 'blocked' });

      const created = await createRequest(vendorId, { packageId, eventDate: OTHER_DATE });
      expect(await statusOn(vendorId, OTHER_DATE)).toBe('blocked');

      await post(VENDOR, `/booking-requests/${created.json().id}/decline`);

      expect(await statusOn(vendorId, OTHER_DATE)).toBe('blocked');
    });

    it('books the date over a block the vendor set, because accept is explicit', async () => {
      const { vendorId, packageId } = await createVendor(VENDOR, 'Sunlit Studio');
      await harness.database.db
        .insert(availability)
        .values({ vendorId, date: OTHER_DATE, status: 'blocked' });

      const created = await createRequest(vendorId, { packageId, eventDate: OTHER_DATE });
      await post(VENDOR, `/booking-requests/${created.json().id}/accept`);

      expect(await statusOn(vendorId, OTHER_DATE)).toBe('booked');
    });
  });
});
