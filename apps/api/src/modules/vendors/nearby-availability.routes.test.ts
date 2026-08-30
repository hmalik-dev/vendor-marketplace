import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The band that closes frame `18`: who is free **near** a date that came back
 * empty. Driven through the real route rather than the DAO, because a window
 * that works in isolation but is dropped by the querystring schema is still a
 * dead end for the customer.
 */
describe('GET /vendors/availability/nearby', () => {
  let harness: TestHarness;
  let photographyId: string;
  let cateringId: string;

  /**
   * The instant every date in this suite is measured from.
   *
   * It is pinned rather than read, and pinned to **04:30 UTC on purpose**: at
   * that moment the UTC day (`2026-03-15`) and the day a database session west
   * of UTC would call current (`2026-03-14`) are different. That divergence is
   * the bug — the window floor used to come from the connection's
   * `CURRENT_DATE` while everything else counted in UTC — so a clock that did
   * not straddle a midnight would assert nothing at all.
   *
   * Reading the real clock instead is what made this suite pass in the
   * afternoon and fail after 20:00 local.
   */
  const FIXED_NOW = new Date('2026-03-15T04:30:00.000Z');

  /** Days from the pinned now, so fixtures never drift as time passes. */
  function dayFromToday(offset: number): string {
    const date = new Date(FIXED_NOW);
    date.setUTCDate(date.getUTCDate() + offset);

    return date.toISOString().slice(0, 10);
  }

  interface VendorSpec {
    user: string;
    businessName: string;
    city?: string;
    categoryIds?: string[];
    blockedDates?: string[];
    rating?: number;
  }

  async function seedVendor(spec: VendorSpec): Promise<void> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(spec.user),
      payload: {
        businessName: spec.businessName,
        categoryIds: spec.categoryIds ?? [photographyId],
        city: spec.city ?? 'Austin',
        state: 'TX',
        bio: `${spec.businessName} does good work.`,
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);

    const pkg = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(spec.user),
      payload: {
        name: 'Coverage',
        description: 'A package with a description long enough to pass validation.',
        priceCents: 150_000,
      },
    });
    expect(pkg.statusCode).toBe(201);

    if (spec.blockedDates?.length) {
      const blocked = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/availability',
        headers: bearer(spec.user),
        payload: { entries: spec.blockedDates.map((date) => ({ date, status: 'blocked' })) },
      });
      expect(blocked.statusCode).toBe(200);
    }

    const published = await harness.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer(spec.user),
      payload: { isPublished: true },
    });
    expect(published.statusCode).toBe(200);
  }

  async function nearby(query: string): Promise<{
    items: Array<{ businessName: string; nearestAvailableDate: string; availableOnDate: boolean }>;
    total: number;
    windowDays: number;
  }> {
    const response = await harness.app.inject({
      method: 'GET',
      url: `/vendors/availability/nearby${query}`,
    });
    expect(response.statusCode).toBe(200);

    return response.json();
  }

  const VENDOR_USERS = ['user_a', 'user_b', 'user_c', 'user_d'] as const;

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => FIXED_NOW });

    for (const clerkUserId of VENDOR_USERS) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'Vendor',
        roleHint: 'vendor',
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db.select().from(categories);
    photographyId = rows.find((row) => row.slug === 'photography')!.id;
    cateringId = rows.find((row) => row.slug === 'catering')!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('offers the vendor’s nearest free day to the one that was wanted', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.', blockedDates: [wanted] });

    const body = await nearby(`?date=${wanted}`);

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.businessName).toBe('Kessler & Co.');
    // Either side is one day away; the tie breaks earlier, because the sooner
    // of two equally-distant days is the one still bookable.
    expect(body.items[0]?.nearestAvailableDate).toBe(dayFromToday(29));
  });

  /* The whole point of "nearest": offer the smallest move, not the earliest. */
  it('offers the closest free day, not the first one in the window', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({
      user: 'user_a',
      businessName: 'Kessler & Co.',
      blockedDates: [dayFromToday(28), dayFromToday(29), wanted],
    });

    const body = await nearby(`?date=${wanted}`);

    expect(body.items[0]?.nearestAvailableDate).toBe(dayFromToday(31));
  });

  /*
   * A vendor free on the wanted date was already in the main results. Offering
   * them here as an alternative to themselves is noise.
   */
  it('excludes a vendor who is free on the date that was asked for', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({ user: 'user_a', businessName: 'Free That Day' });
    await seedVendor({ user: 'user_b', businessName: 'Taken', blockedDates: [wanted] });

    const body = await nearby(`?date=${wanted}`);

    expect(body.items.map((item) => item.businessName)).toEqual(['Taken']);
  });

  it('never offers the wanted date back as its own alternative', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({ user: 'user_a', businessName: 'Taken', blockedDates: [wanted] });

    const body = await nearby(`?date=${wanted}`);

    expect(body.items[0]?.nearestAvailableDate).not.toBe(wanted);
  });

  /*
   * The edge the ticket names: anchored on today, half the window is behind
   * us, and `11-search.md` rules out offering a date nobody can book.
   */
  it('never suggests a past date when the wanted date is today', async () => {
    const today = dayFromToday(0);
    await seedVendor({ user: 'user_a', businessName: 'Taken Today', blockedDates: [today] });

    const body = await nearby(`?date=${today}`);

    expect(body.items[0]?.nearestAvailableDate).toBe(dayFromToday(1));
    for (const item of body.items) {
      expect(item.nearestAvailableDate >= today).toBe(true);
    }
  });

  /*
   * The seam itself, asserted rather than implied.
   *
   * The window floor used to be Postgres `CURRENT_DATE`, which is the *session's*
   * day — decided by a `TimeZone` nothing in this repository sets. Under PGlite
   * that session runs on `Etc/GMT+5`, so after 00:00 UTC it sat a day behind the
   * UTC day the service validates in, and the endpoint offered a date that had
   * already gone.
   *
   * Two things make this a real assertion rather than a restatement. The pinned
   * clock is a date in the **past**, so the connection's day is months ahead of
   * the application's: a floor read from the connection would put the entire
   * window below it and return nothing at all. And the session is then moved
   * fourteen hours east, so no accident of the machine's own zone can make the
   * two agree.
   */
  it('floors the window on the injected clock, not on the database session', async () => {
    await harness.database.client.query(`SET TIME ZONE 'Pacific/Kiritimati'`);

    try {
      const sessionDay = (
        await harness.database.client.query<{ day: string }>(
          `SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS day`,
        )
      ).rows[0]?.day;
      // Guards the guard: if the connection's day happened to match the pinned
      // one, the assertion below would pass for the wrong reason.
      expect(sessionDay).not.toBe(dayFromToday(0));

      const wanted = dayFromToday(1);
      await seedVendor({ user: 'user_a', businessName: 'Taken Tomorrow', blockedDates: [wanted] });

      const body = await nearby(`?date=${wanted}`);

      // Today and the day after are both one day from the wanted date, and the
      // tie breaks earlier. A floor taken from the connection would have put
      // the whole window in the past and answered with nothing.
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.nearestAvailableDate).toBe(dayFromToday(0));
    } finally {
      await harness.database.client.query(`SET TIME ZONE 'UTC'`);
    }
  });

  it('refuses a date that has already gone, rather than answering emptily', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: `/vendors/availability/nearby?date=${dayFromToday(-10)}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('already passed');
  });

  it('returns nothing at all when the vendor is blocked across the whole window', async () => {
    const wanted = dayFromToday(30);
    const solidlyBooked = Array.from({ length: 9 }, (_, index) => dayFromToday(26 + index));
    await seedVendor({
      user: 'user_a',
      businessName: 'Fully Booked',
      blockedDates: solidlyBooked,
    });

    const body = await nearby(`?date=${wanted}&windowDays=4`);

    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('honours the window, and echoes the one it used', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({
      user: 'user_a',
      businessName: 'Taken',
      blockedDates: [
        dayFromToday(28),
        dayFromToday(29),
        wanted,
        dayFromToday(31),
        dayFromToday(32),
      ],
    });

    // Two days either side reaches only blocked days; three reaches day 27.
    expect((await nearby(`?date=${wanted}&windowDays=2`)).items).toEqual([]);

    const wider = await nearby(`?date=${wanted}&windowDays=3`);
    expect(wider.items).toHaveLength(1);
    expect(wider.items[0]?.nearestAvailableDate).toBe(dayFromToday(27));
    expect(wider.windowDays).toBe(3);
  });

  it('defaults the window to a fortnight either side', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({ user: 'user_a', businessName: 'Taken', blockedDates: [wanted] });

    expect((await nearby(`?date=${wanted}`)).windowDays).toBe(14);
  });

  it('narrows by category and by city, like the search it continues', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({ user: 'user_a', businessName: 'Austin Photo', blockedDates: [wanted] });
    await seedVendor({
      user: 'user_b',
      businessName: 'Austin Catering',
      categoryIds: [cateringId],
      blockedDates: [wanted],
    });
    await seedVendor({
      user: 'user_c',
      businessName: 'Dallas Photo',
      city: 'Dallas',
      blockedDates: [wanted],
    });

    expect(
      (await nearby(`?date=${wanted}&category=photography`)).items.map((i) => i.businessName),
    ).toEqual(expect.arrayContaining(['Austin Photo', 'Dallas Photo']));
    expect((await nearby(`?date=${wanted}&city=Austin`)).items.map((i) => i.businessName)).toEqual(
      expect.arrayContaining(['Austin Photo', 'Austin Catering']),
    );
  });

  it('orders by how little the customer has to move', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({
      user: 'user_a',
      businessName: 'Three Days Away',
      blockedDates: [
        dayFromToday(28),
        dayFromToday(29),
        wanted,
        dayFromToday(31),
        dayFromToday(32),
      ],
    });
    await seedVendor({ user: 'user_b', businessName: 'One Day Away', blockedDates: [wanted] });

    const body = await nearby(`?date=${wanted}`);

    expect(body.items.map((item) => item.businessName)).toEqual([
      'One Day Away',
      'Three Days Away',
    ]);
  });

  /*
   * "See all N in the region" is a real count or it is not drawn. Counting the
   * cards on screen would make the link a lie.
   */
  it('counts every vendor free nearby, not just the ones it returned', async () => {
    const wanted = dayFromToday(30);
    for (const user of VENDOR_USERS) {
      await seedVendor({ user, businessName: `Vendor ${user}`, blockedDates: [wanted] });
    }

    const body = await nearby(`?date=${wanted}&limit=2`);

    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(4);
  });

  it('marks every result as not free on the date that was asked for', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({ user: 'user_a', businessName: 'Taken', blockedDates: [wanted] });

    expect((await nearby(`?date=${wanted}`)).items[0]?.availableOnDate).toBe(false);
  });

  it('needs no account — it continues a search that needs none', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({ user: 'user_a', businessName: 'Taken', blockedDates: [wanted] });

    const response = await harness.app.inject({
      method: 'GET',
      url: `/vendors/availability/nearby?date=${wanted}`,
    });

    expect(response.statusCode).toBe(200);
  });

  it('never offers an unpublished vendor', async () => {
    const wanted = dayFromToday(30);
    await seedVendor({ user: 'user_a', businessName: 'Taken', blockedDates: [wanted] });
    await harness.database.db.update(vendorProfiles).set({ isPublished: false });

    expect((await nearby(`?date=${wanted}`)).items).toEqual([]);
  });

  it('refuses a request with no date to anchor on', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/vendors/availability/nearby',
    });

    expect(response.statusCode).toBe(400);
  });
});
