import {
  availability,
  bookingRequests,
  categories,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { addDays, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { applyAvailability } from './availability.dao.js';

const VENDOR = 'user_vendor';
const OTHER_VENDOR = 'user_vendor_two';
const CUSTOMER = 'user_customer';

const NOW = new Date();
const TOMORROW = toDateString(addDays(NOW, 1));
const NEXT_WEEK = toDateString(addDays(NOW, 7));
const YESTERDAY = toDateString(addDays(NOW, -1));
const TODAY = toDateString(NOW);
/** Inside the twelve-month window, and far from every other date here. */
const FAR_DATE = toDateString(addDays(NOW, 90));

interface AvailabilityBody {
  date: string;
  status: string;
  note: string | null;
}

describe('/vendor/availability', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function createProfile(clerkUserId: string, businessName: string): Promise<string> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(clerkUserId),
      payload: {
        businessName,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography.',
      },
    });

    expect(response.statusCode).toBe(201);
    return response.json().id;
  }

  async function put(
    clerkUserId: string,
    entries: readonly Record<string, unknown>[],
  ): Promise<ReturnType<TestHarness['app']['inject']>> {
    return harness.app.inject({
      method: 'PUT',
      url: '/vendor/availability',
      headers: bearer(clerkUserId),
      payload: { entries },
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [OTHER_VENDOR, 'vendor', 'ada@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
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
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('authorization', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await harness.app.inject({ method: 'GET', url: '/vendor/availability' });

      expect(response.statusCode).toBe(401);
    });

    it('rejects a customer', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/availability',
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET', () => {
    it('starts empty, because an absent row means available', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/availability',
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it('returns only the caller’s own calendar', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      await createProfile(OTHER_VENDOR, 'Moonlit Studio');
      await put(OTHER_VENDOR, [{ date: TOMORROW, status: 'blocked' }]);

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/availability',
        headers: bearer(VENDOR),
      });

      expect(response.json()).toEqual([]);
    });

    it('leaves a date beyond the twelve-month window out of the view', async () => {
      const vendorId = await createProfile(VENDOR, 'Sunlit Studio');
      const farFuture = toDateString(addDays(NOW, 400));

      await harness.database.db
        .insert(availability)
        .values({ vendorId, date: farFuture, status: 'blocked' });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/availability',
        headers: bearer(VENDOR),
      });

      expect(response.json()).toEqual([]);
    });
  });

  /**
   * `#212`: a live request has to read `Pending request` on the vendor's own
   * calendar, but must not be stored — search excludes any date row that is not
   * `available`, so a stored one would take the vendor out of the market for a
   * week over a request they have not answered.
   */
  describe('the requests overlaid on the calendar', () => {
    /** A published vendor with one package, and a customer request on `date`. */
    async function requestOn(date: string): Promise<string> {
      const vendorId = await createProfile(VENDOR, 'Sunlit Studio');

      const created = await harness.app.inject({
        method: 'POST',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
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

      const request = await harness.app.inject({
        method: 'POST',
        url: '/booking-requests',
        headers: bearer(CUSTOMER),
        payload: { vendorId, packageId: created.json().id, eventDate: date },
      });
      expect(request.statusCode).toBe(201);

      return request.json().id;
    }

    async function calendar(): Promise<{ date: string; status: string }[]> {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/availability',
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(200);
      return (response.json() as { date: string; status: string }[]).map(({ date, status }) => ({
        date,
        status,
      }));
    }

    it('shows a live request as pending without storing a row for it', async () => {
      await requestOn(TOMORROW);

      expect(await calendar()).toEqual([{ date: TOMORROW, status: 'pending' }]);

      const stored = await harness.database.db.select().from(availability);
      expect(stored).toEqual([]);
    });

    it('shows the date booked, and stored, once the vendor accepts', async () => {
      const requestId = await requestOn(TOMORROW);

      const accepted = await harness.app.inject({
        method: 'POST',
        url: `/booking-requests/${requestId}/accept`,
        headers: bearer(VENDOR),
      });
      expect(accepted.statusCode).toBe(200);

      expect(await calendar()).toEqual([{ date: TOMORROW, status: 'booked' }]);

      const stored = await harness.database.db
        .select({ status: availability.status })
        .from(availability);
      expect(stored).toEqual([{ status: 'booked' }]);
    });

    it('drops the overlay once the request is declined', async () => {
      const requestId = await requestOn(TOMORROW);

      await harness.app.inject({
        method: 'POST',
        url: `/booking-requests/${requestId}/decline`,
        headers: bearer(VENDOR),
      });

      expect(await calendar()).toEqual([]);
    });

    /* The vendor's own decision outranks somebody else's hope for the date. */
    it('keeps a date the vendor blocked reading blocked, not pending', async () => {
      await requestOn(TOMORROW);
      await put(VENDOR, [{ date: TOMORROW, status: 'blocked' }]);

      expect(await calendar()).toEqual([{ date: TOMORROW, status: 'blocked' }]);
    });

    /*
     * The PUT response IS the calendar as far as the client is concerned — it
     * calls `setEntries` with it. When only the GET overlaid, blocking one
     * unrelated date turned every pending cell on screen white and clickable
     * until a reload, and a pending cell is not the vendor's to touch.
     */
    it('keeps the overlay on the response to an unrelated edit', async () => {
      await requestOn(TOMORROW);

      const response = await put(VENDOR, [{ date: FAR_DATE, status: 'blocked' }]);

      expect(response.statusCode).toBe(200);
      expect(
        (response.json() as { date: string; status: string }[]).map(({ date, status }) => ({
          date,
          status,
        })),
      ).toEqual([
        { date: TOMORROW, status: 'pending' },
        { date: FAR_DATE, status: 'blocked' },
      ]);
    });

    /*
     * Expiry is lazy and is applied when the *request* is read; this read never
     * does that. Without its own deadline a request the customer gave up on a
     * week ago holds the cell at `Pending request` — and `pending` is locked, so
     * the vendor cannot free or block their own Saturday.
     */
    it('drops a request that has run past its expiry', async () => {
      const requestId = await requestOn(TOMORROW);

      await harness.database.db
        .update(bookingRequests)
        .set({ expiresAt: addDays(NOW, -7) })
        .where(eq(bookingRequests.id, requestId));

      expect(await calendar()).toEqual([]);
    });
  });

  /**
   * `completed` is derived from `booked` plus the date, never stored — a booked
   * day behind us is a delivered event, and the frame keeps it on the calendar
   * rather than letting finished work vanish. Storing it would need a writer
   * that runs at midnight, and until it ran the status would be lying.
   *
   * Its own harness on a **pinned mid-month clock**. The read window starts at
   * the first of the current month, so on the 1st there is no past day inside
   * it — correct behaviour, and a real-clock test would fail twelve days a year
   * on an assertion that has nothing to do with month boundaries.
   */
  describe('a booked date that has passed', () => {
    const PINNED = new Date('2026-06-15T12:00:00.000Z');
    const PINNED_YESTERDAY = '2026-06-14';
    const PINNED_TOMORROW = '2026-06-16';

    let derived: TestHarness;
    // Its own PGlite database, so it needs its own category id.
    let derivedCategoryId: string;

    beforeAll(async () => {
      derived = await createTestHarness({ clock: () => PINNED });
      derived.clerkUsers.set(VENDOR, {
        clerkUserId: VENDOR,
        email: 'grace@example.com',
        firstName: 'Test',
        lastName: 'User',
        roleHint: 'vendor',
        avatarUrl: null,
      });

      const rows = await derived.database.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, 'photography'))
        .limit(1);
      derivedCategoryId = rows[0]!.id;
    });

    afterEach(async () => {
      await derived.database.db.delete(vendorProfiles);
      await derived.database.db.delete(users);
    });

    afterAll(async () => {
      await derived.close();
    });

    async function profileFor(): Promise<string> {
      const response = await derived.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: {
          businessName: 'Sunlit Studio',
          categoryIds: [derivedCategoryId],
          city: 'Austin',
          state: 'TX',
          bio: 'Documentary wedding photography.',
        },
      });
      expect(response.statusCode).toBe(201);
      return response.json().id;
    }

    async function read(): Promise<{ date: string; status: string }[]> {
      const response = await derived.app.inject({
        method: 'GET',
        url: '/vendor/availability',
        headers: bearer(VENDOR),
      });
      expect(response.statusCode).toBe(200);
      return (response.json() as { date: string; status: string }[]).map(({ date, status }) => ({
        date,
        status,
      }));
    }

    it('reads as completed, while the stored row still says booked', async () => {
      const vendorId = await profileFor();
      await derived.database.db
        .insert(availability)
        .values({ vendorId, date: PINNED_YESTERDAY, status: 'booked' });

      expect(await read()).toEqual([{ date: PINNED_YESTERDAY, status: 'completed' }]);

      const stored = await derived.database.db
        .select({ status: availability.status })
        .from(availability);
      expect(stored).toEqual([{ status: 'booked' }]);
    });

    it('leaves a future booked date booked', async () => {
      const vendorId = await profileFor();
      await derived.database.db
        .insert(availability)
        .values({ vendorId, date: PINNED_TOMORROW, status: 'booked' });

      expect(await read()).toEqual([{ date: PINNED_TOMORROW, status: 'booked' }]);
    });

    /* A past date the vendor merely blocked was never work, so it is not one. */
    it('does not turn a past blocked date into a completed one', async () => {
      const vendorId = await profileFor();
      await derived.database.db
        .insert(availability)
        .values({ vendorId, date: PINNED_YESTERDAY, status: 'blocked' });

      expect(await read()).toEqual([{ date: PINNED_YESTERDAY, status: 'blocked' }]);
    });
  });

  describe('PUT', () => {
    it('blocks a future date and returns the whole calendar', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await put(VENDOR, [
        { date: TOMORROW, status: 'blocked', note: 'Away for a wedding' },
      ]);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        {
          id: expect.any(String),
          vendorId: expect.any(String),
          date: TOMORROW,
          status: 'blocked',
          note: 'Away for a wedding',
        },
      ]);
    });

    it('upserts rather than duplicating when the same date is blocked twice', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      await put(VENDOR, [{ date: TOMORROW, status: 'blocked', note: 'First reason' }]);
      const response = await put(VENDOR, [
        { date: TOMORROW, status: 'blocked', note: 'Second reason' },
      ]);

      expect(response.json()).toHaveLength(1);
      expect(response.json()[0].note).toBe('Second reason');
    });

    it('clears the row when a date is handed back to available', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      await put(VENDOR, [{ date: TOMORROW, status: 'blocked' }]);

      const response = await put(VENDOR, [{ date: TOMORROW, status: 'available' }]);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it('ignores a past date silently and applies the rest of the range', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await put(VENDOR, [
        { date: YESTERDAY, status: 'blocked' },
        { date: TOMORROW, status: 'blocked' },
      ]);

      expect(response.statusCode).toBe(200);
      expect(response.json().map((row: AvailabilityBody) => row.date)).toEqual([TOMORROW]);
    });

    /*
     * A vendor who wakes up ill blocks *today*. Offering tomorrow while
     * refusing the day they are standing in fails at the one moment the
     * calendar matters most, so the floor is today rather than tomorrow.
     */
    it('blocks off today, which is not past', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await put(VENDOR, [{ date: TODAY, status: 'blocked' }]);

      expect(response.statusCode).toBe(200);
      expect(response.json().map((row: AvailabilityBody) => row.date)).toEqual([TODAY]);
    });

    /* What has already happened is a record, not a setting. */
    it('drops every past date in a range while keeping today and after', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await put(VENDOR, [
        { date: YESTERDAY, status: 'blocked' },
        { date: TODAY, status: 'blocked' },
        { date: TOMORROW, status: 'blocked' },
      ]);

      expect(response.statusCode).toBe(200);
      expect(response.json().map((row: AvailabilityBody) => row.date)).toEqual([TODAY, TOMORROW]);
    });

    it('refuses to change a date held by a confirmed booking', async () => {
      const vendorId = await createProfile(VENDOR, 'Sunlit Studio');
      await harness.database.db
        .insert(availability)
        .values({ vendorId, date: TOMORROW, status: 'booked' });

      const response = await put(VENDOR, [{ date: TOMORROW, status: 'blocked' }]);

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('CONFLICT');
      expect(response.json().details.bookedDates).toEqual([TOMORROW]);
    });

    it('leaves the whole range untouched when one of its dates is booked', async () => {
      const vendorId = await createProfile(VENDOR, 'Sunlit Studio');
      await harness.database.db
        .insert(availability)
        .values({ vendorId, date: TOMORROW, status: 'booked' });

      await put(VENDOR, [
        { date: TOMORROW, status: 'blocked' },
        { date: NEXT_WEEK, status: 'blocked' },
      ]);

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/availability',
        headers: bearer(VENDOR),
      });

      expect(response.json().map((row: AvailabilityBody) => row.status)).toEqual(['booked']);
    });

    it('rejects a status only the booking lifecycle may set', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await put(VENDOR, [{ date: TOMORROW, status: 'booked' }]);

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('rejects a malformed calendar date', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await put(VENDOR, [{ date: '2026-02-30', status: 'blocked' }]);

      expect(response.statusCode).toBe(400);
    });

    it('rejects an empty entry list', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await put(VENDOR, []);

      expect(response.statusCode).toBe(400);
    });

    it('takes the last instruction when a date appears twice in one request', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await put(VENDOR, [
        { date: TOMORROW, status: 'blocked' },
        { date: TOMORROW, status: 'available' },
      ]);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });
});

/*
 * #399. The service reads the dates first and refuses the whole write when one
 * of them is booked — but that read and the write are two statements, so an
 * accept or a payment webhook landing between them had its date freed by a
 * vendor who was told nothing. The write now carries the predicate itself, so
 * a date booked in that window is left alone whatever the read saw. Driven at
 * the DAO, because the window it closes cannot be opened through the route.
 */
describe('applyAvailability never touches a booked date', () => {
  let harness: TestHarness;
  const VENDOR_ID = '33333333-3333-4333-8333-333333333333';
  const DATE = '2027-06-14';

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.database.db.insert(users).values({
      id: '44444444-4444-4444-8444-444444444444',
      clerkUserId: 'user_dao_probe',
      email: 'dao-probe@example.com',
      firstName: 'Dao',
      lastName: 'Probe',
      role: 'vendor',
    });
    await harness.database.db.insert(vendorProfiles).values({
      id: VENDOR_ID,
      userId: '44444444-4444-4444-8444-444444444444',
      businessName: 'Probe Studio',
      slug: 'probe-studio',
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('neither clears it nor overwrites it', async () => {
    await harness.database.db
      .insert(availability)
      .values({ vendorId: VENDOR_ID, date: DATE, status: 'booked' });

    await applyAvailability(harness.database.db, VENDOR_ID, [DATE], []);
    await applyAvailability(
      harness.database.db,
      VENDOR_ID,
      [],
      [{ vendorId: VENDOR_ID, date: DATE, status: 'blocked', note: 'mine now' }],
    );

    const rows = await harness.database.db
      .select({ status: availability.status, note: availability.note })
      .from(availability)
      .where(eq(availability.vendorId, VENDOR_ID));

    expect(rows).toEqual([{ status: 'booked', note: null }]);
  });
});
