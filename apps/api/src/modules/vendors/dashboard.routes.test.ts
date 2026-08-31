import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  servicePackages,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  parseDateString,
  todayDateString,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';

interface DashboardBody {
  newRequestCount: number;
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  responseRate: number | null;
  avgRating: number;
  reviewCount: number;
  earningsThisMonthCents: number;
  isPublished: boolean;
  publishBlockers: string[];
  bookingWeek: { date: string; status: string }[];
  nextPayout: {
    bookingId: string;
    eventDate: string;
    customerFirstName: string;
    vendorPayoutCents: number;
  } | null;
}

describe('/vendor/dashboard', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function read(actor = VENDOR): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method: 'GET',
      url: '/vendor/dashboard',
      headers: bearer(actor),
    });
  }

  /** A profile that satisfies every blocker except the ones named. */
  async function createProfile(): Promise<string> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
        responseTimeHours: 4,
      },
    });
    expect(response.statusCode).toBe(201);

    return response.json().id;
  }

  async function addPackage(): Promise<string> {
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

    return created.json().id;
  }

  /** A request can only be sent to a published vendor. */
  async function publish(vendorId: string): Promise<void> {
    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true })
      .where(eq(vendorProfiles.id, vendorId));
  }

  /**
   * One request per event date. A repeat submission for a date this customer
   * already has a live request on is deduped by the API, so a test that wants
   * two distinct requests has to ask about two distinct days.
   */
  async function request(vendorId: string, packageId: string, dayOffset: number): Promise<string> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId,
        packageId,
        eventDate: toDateString(addDays(new Date(), dayOffset)),
        eventType: 'wedding',
      },
    });
    expect(created.statusCode).toBe(201);

    return created.json().id;
  }

  /**
   * `offset` days from the dashboard's own today.
   *
   * Anchored on `todayDateString` rather than on `toDateString(new Date())`:
   * the first is the local calendar day and the second is the UTC one, and for
   * part of every day they name different dates. The service anchors the week
   * on the local day, so a test that anchored on the UTC one would fail for a
   * few hours a day and pass for the rest — the definition of flaky.
   */
  function dayFrom(offset: number): string {
    return toDateString(addDays(parseDateString(todayDateString())!, offset));
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
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
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(servicePackages);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('rejects an unauthenticated read', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/vendor/dashboard' });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a customer', async () => {
    expect((await read(CUSTOMER)).statusCode).toBe(403);
  });

  /*
   * A brand-new vendor's dashboard must be honest rather than encouraging:
   * every figure is a true zero and the response rate is absent, not 0%.
   */
  it('reports honest zeroes for a vendor nobody has asked yet', async () => {
    await createProfile();

    const body = (await read()).json() as DashboardBody;

    expect(body.newRequestCount).toBe(0);
    expect(body.bookingsThisMonth).toBe(0);
    expect(body.earningsThisMonthCents).toBe(0);
    expect(body.reviewCount).toBe(0);
    // Not 0 — nobody has asked, so there is no rate to report.
    expect(body.responseRate).toBeNull();
    expect(body.nextPayout).toBeNull();
    // Seven days from today, every one of them open — the calendar is sparse,
    // so a vendor with no rows still gets a full week rather than a short one.
    expect(body.bookingWeek).toHaveLength(7);
    expect(body.bookingWeek.map((day) => day.date)).toEqual(
      Array.from({ length: 7 }, (_, offset) => dayFrom(offset)),
    );
    expect([...new Set(body.bookingWeek.map((day) => day.status))]).toEqual(['available']);
  });

  it('counts the requests still waiting on this vendor', async () => {
    const vendorId = await createProfile();
    const packageId = await addPackage();
    await publish(vendorId);
    await request(vendorId, packageId, 30);
    await request(vendorId, packageId, 31);

    expect(((await read()).json() as DashboardBody).newRequestCount).toBe(2);
  });

  it('stops counting a request once it has been answered', async () => {
    const vendorId = await createProfile();
    const packageId = await addPackage();
    await publish(vendorId);
    const requestId = await request(vendorId, packageId, 30);

    await harness.app.inject({
      method: 'POST',
      url: `/booking-requests/${requestId}/decline`,
      headers: bearer(VENDOR),
    });

    const body = (await read()).json() as DashboardBody;
    expect(body.newRequestCount).toBe(0);
    // One offered, one answered.
    expect(body.responseRate).toBe(1);
  });

  it('counts an unanswered request against the rate, and a withdrawn one not at all', async () => {
    const vendorId = await createProfile();
    const packageId = await addPackage();
    await publish(vendorId);
    const answered = await request(vendorId, packageId, 30);
    await request(vendorId, packageId, 31);
    const withdrawn = await request(vendorId, packageId, 32);

    await harness.app.inject({
      method: 'POST',
      url: `/booking-requests/${answered}/decline`,
      headers: bearer(VENDOR),
    });
    // The vendor was never given the chance on this one.
    await harness.app.inject({
      method: 'POST',
      url: `/booking-requests/${withdrawn}/cancel`,
      headers: bearer(CUSTOMER),
    });

    // 1 answered of 2 offered; the cancelled request is in neither half.
    expect(((await read()).json() as DashboardBody).responseRate).toBe(0.5);
  });

  it('reports the payout share, not the gross the customer paid', async () => {
    const vendorId = await createProfile();
    const packageId = await addPackage();
    await publish(vendorId);
    const requestId = await request(vendorId, packageId, 30);

    const customer = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, CUSTOMER));

    await harness.database.db.insert(bookings).values({
      requestId,
      customerId: customer[0]!.id,
      vendorId,
      eventDate: todayDateString(),
      totalAmountCents: 145_000,
      platformFeeCents: 17_400,
      vendorPayoutCents: 127_600,
      paidAt: new Date(),
    });

    const body = (await read()).json() as DashboardBody;

    expect(body.earningsThisMonthCents).toBe(127_600);
    expect(body.bookingsThisMonth).toBe(1);
    // The payout share again, this time as the *next* one owed — the amount is
    // real, so the card never has to invent it.
    expect(body.nextPayout).toMatchObject({
      eventDate: todayDateString(),
      customerFirstName: 'Test',
      vendorPayoutCents: 127_600,
    });
  });

  /*
   * The `This week` strip. It reads the availability calendar rather than
   * re-deriving from `bookings`, so these tests write calendar rows: that is
   * where the booking lifecycle puts `booked` and `pending`, and where the
   * vendor puts `blocked`.
   */
  describe('the booking week', () => {
    /** Writes one calendar row `offset` days from today. */
    async function mark(
      vendorId: string,
      offset: number,
      status: 'booked' | 'pending' | 'blocked',
    ): Promise<string> {
      const date = dayFrom(offset);
      await harness.database.db.insert(availability).values({ vendorId, date, status });

      return date;
    }

    it('carries each calendar status through, and fills the untouched days', async () => {
      const vendorId = await createProfile();
      const booked = await mark(vendorId, 2, 'booked');
      const held = await mark(vendorId, 3, 'pending');
      const blocked = await mark(vendorId, 4, 'blocked');

      const week = ((await read()).json() as DashboardBody).bookingWeek;
      const byDate = new Map(week.map((day) => [day.date, day.status]));

      expect(week).toHaveLength(7);
      expect(byDate.get(booked)).toBe('booked');
      expect(byDate.get(held)).toBe('pending');
      expect(byDate.get(blocked)).toBe('blocked');
      // The sparse calendar's default, filled in rather than left as a hole.
      expect(byDate.get(dayFrom(1))).toBe('available');
    });

    it('starts at today and stops before the eighth day', async () => {
      const vendorId = await createProfile();
      // One day either side of the window, both of which must be invisible.
      await mark(vendorId, -1, 'booked');
      await mark(vendorId, 7, 'booked');

      const week = ((await read()).json() as DashboardBody).bookingWeek;

      expect(week[0]?.date).toBe(todayDateString());
      expect(week[6]?.date).toBe(dayFrom(6));
      expect(week.every((day) => day.status === 'available')).toBe(true);
    });
  });

  describe('the next payout', () => {
    /** A confirmed booking `offset` days out, worth `payoutCents` to the vendor. */
    async function book(
      vendorId: string,
      requestId: string,
      offset: number,
      payoutCents: number,
      status: 'confirmed' | 'cancelled' = 'confirmed',
    ): Promise<void> {
      const customer = await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, CUSTOMER));

      await harness.database.db.insert(bookings).values({
        requestId,
        customerId: customer[0]!.id,
        vendorId,
        eventDate: dayFrom(offset),
        totalAmountCents: payoutCents + 1_000,
        platformFeeCents: 1_000,
        vendorPayoutCents: payoutCents,
        status,
        paidAt: new Date(),
      });
    }

    it('names the soonest upcoming event, not the largest', async () => {
      const vendorId = await createProfile();
      const packageId = await addPackage();
      await publish(vendorId);
      const near = await request(vendorId, packageId, 10);
      const far = await request(vendorId, packageId, 40);

      await book(vendorId, far, 40, 900_000);
      await book(vendorId, near, 10, 50_000);

      const payout = ((await read()).json() as DashboardBody).nextPayout;

      expect(payout?.vendorPayoutCents).toBe(50_000);
      expect(payout?.eventDate).toBe(dayFrom(10));
    });

    it('ignores a cancelled booking, which is money that is not coming', async () => {
      const vendorId = await createProfile();
      const packageId = await addPackage();
      await publish(vendorId);
      const cancelled = await request(vendorId, packageId, 10);
      const live = await request(vendorId, packageId, 40);

      await book(vendorId, cancelled, 10, 50_000, 'cancelled');
      await book(vendorId, live, 40, 900_000);

      expect(((await read()).json() as DashboardBody).nextPayout?.vendorPayoutCents).toBe(900_000);
    });

    it('is null when every booking is already behind the vendor', async () => {
      const vendorId = await createProfile();
      const packageId = await addPackage();
      await publish(vendorId);
      const past = await request(vendorId, packageId, 10);

      await book(vendorId, past, -5, 50_000);

      expect(((await read()).json() as DashboardBody).nextPayout).toBeNull();
    });
  });

  /*
   * The acceptance that matters most here: a checklist which disagrees with
   * the gate tells a vendor they are ready when publishing will refuse them.
   * Each blocker is provoked in turn and asserted to appear.
   */
  describe('the checklist is the real publish gate', () => {
    it('names a missing package while everything else is satisfied', async () => {
      await createProfile();

      const body = (await read()).json() as DashboardBody;

      expect(body.publishBlockers).toEqual(['packages']);
      expect(body.isPublished).toBe(false);
    });

    it('clears once the package exists', async () => {
      await createProfile();
      await addPackage();

      expect(((await read()).json() as DashboardBody).publishBlockers).toEqual([]);
    });

    it.each([
      ['bio', { bio: null }],
      ['location', { city: null }],
      ['responseTime', { responseTimeHours: null }],
    ] as const)('names %s when it is missing', async (blocker, patch) => {
      const vendorId = await createProfile();
      await addPackage();

      await harness.database.db
        .update(vendorProfiles)
        .set(patch)
        .where(eq(vendorProfiles.id, vendorId));

      expect(((await read()).json() as DashboardBody).publishBlockers).toContain(blocker);
    });
  });
});
