import { availability, categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { addDays, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const OTHER_VENDOR = 'user_vendor_two';
const CUSTOMER = 'user_customer';

const NOW = new Date();
const TOMORROW = toDateString(addDays(NOW, 1));
const NEXT_WEEK = toDateString(addDays(NOW, 7));
const YESTERDAY = toDateString(addDays(NOW, -1));
const TODAY = toDateString(NOW);

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
