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
  payoutDueThroughDate,
  payoutReleaseAt,
  toDateString,
  type BookingStatus,
} from '@vendor-marketplace/shared';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { findDuePayoutBookingIds } from '../payments/payouts.dao.js';
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
  bookingWindow: { date: string; status: string }[];
  payouts: {
    pendingCents: number;
    pendingCount: number;
    next: {
      cents: number;
      customerFirstName: string;
      releaseAt: string;
      isDue: boolean;
    } | null;
    heldCents: number;
    heldCount: number;
  };
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
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
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
   * Anchored on `toDateString` — the **UTC** calendar day — because since #391
   * that is what the service anchors on. It previously anchored on
   * `todayDateString`, the local day, and this helper was matched to it: the
   * comment here recorded that as a deliberate choice to avoid a test that
   * "would fail for a few hours a day and pass for the rest".
   *
   * That reasoning was sound about flakiness and wrong about which side to fix.
   * The service was the thing reading a client-only helper on the server, and
   * matching the test to it made the defect look like the contract. The flake
   * it describes was the bug reporting itself once a day, and the fix removed
   * it at the source rather than by agreeing with it.
   */
  function dayFrom(offset: number): string {
    return toDateString(addDays(parseDateString(toDateString(new Date()))!, offset));
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
    expect(body.payouts.next).toBeNull();
    expect(body.payouts.pendingCents).toBe(0);
    /*
     * Nine days from *yesterday*, every one of them open — the calendar is
     * sparse, so a vendor with no rows still gets a full window rather than a
     * short one. Nine and not seven because the strip's seven start on the
     * viewer's own day, which this process cannot know (#409).
     */
    expect(body.bookingWindow).toHaveLength(9);
    expect(body.bookingWindow.map((day) => day.date)).toEqual(
      Array.from({ length: 9 }, (_, offset) => dayFrom(offset - 1)),
    );
    expect([...new Set(body.bookingWindow.map((day) => day.status))]).toEqual(['available']);
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
      eventDate: dayFrom(0),
      totalAmountCents: 145_000,
      platformFeeCents: 17_400,
      vendorPayoutCents: 127_600,
      // Not the column's `'destination'` default: that model paid the vendor as
      // the card succeeded, so the sweep owes it nothing and the payout figures
      // below would be asserting against money that never moves again.
      payoutModel: 'separate',
      paidAt: new Date(),
    });

    const body = (await read()).json() as DashboardBody;

    expect(body.earningsThisMonthCents).toBe(127_600);
    expect(body.bookingsThisMonth).toBe(1);
    // The payout share again, this time as the *next* one owed — the amount is
    // real, so the card never has to invent it.
    expect(body.payouts.next).toMatchObject({
      customerFirstName: 'Test',
      cents: 127_600,
      releaseAt: payoutReleaseAt(dayFrom(0))?.toISOString(),
    });
    expect(body.payouts.pendingCents).toBe(127_600);
    expect(body.payouts.pendingCount).toBe(1);
  });

  /*
   * #416. A cancellation now really unwinds — D31 reverses the vendor's
   * transfer back out of their connected account — so a cancelled booking is
   * money the vendor no longer has. Both figures counted it, and were only
   * ever right because no refund had succeeded and no paid booking could reach
   * `cancelled`.
   */
  it('leaves a cancelled booking out of the earnings and the count', async () => {
    const vendorId = await createProfile();
    const packageId = await addPackage();
    await publish(vendorId);
    const kept = await request(vendorId, packageId, 30);
    const cancelled = await request(vendorId, packageId, 31);

    const customer = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, CUSTOMER));

    await harness.database.db.insert(bookings).values([
      {
        requestId: kept,
        customerId: customer[0]!.id,
        vendorId,
        eventDate: dayFrom(0),
        totalAmountCents: 145_000,
        platformFeeCents: 17_400,
        vendorPayoutCents: 127_600,
        paidAt: new Date(),
      },
      {
        requestId: cancelled,
        customerId: customer[0]!.id,
        vendorId,
        eventDate: dayFrom(1),
        totalAmountCents: 100_000,
        platformFeeCents: 12_000,
        vendorPayoutCents: 88_000,
        paidAt: new Date(),
        status: 'cancelled',
      },
    ]);

    const body = (await read()).json() as DashboardBody;

    // The kept booking's share alone — not 215,600, and not two bookings.
    expect(body.earningsThisMonthCents).toBe(127_600);
    expect(body.bookingsThisMonth).toBe(1);
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

      const days = ((await read()).json() as DashboardBody).bookingWindow;
      const byDate = new Map(days.map((day) => [day.date, day.status]));

      expect(days).toHaveLength(9);
      expect(byDate.get(booked)).toBe('booked');
      expect(byDate.get(held)).toBe('pending');
      expect(byDate.get(blocked)).toBe('blocked');
      // The sparse calendar's default, filled in rather than left as a hole.
      expect(byDate.get(dayFrom(1))).toBe('available');
    });

    /*
     * #409. The window starts a day before the server's own, because the seven
     * days the strip draws start on the *viewer's* day and west of UTC that is
     * yesterday here. It ends a day after the week for the same reason in the
     * other direction. A vendor at UTC-5 in the evening used to get a "This
     * week" that began tomorrow and did not contain the day they were in.
     */
    it('starts a day before today and stops before the tenth day', async () => {
      const vendorId = await createProfile();
      // One day either side of the window, both of which must be invisible.
      await mark(vendorId, -2, 'booked');
      await mark(vendorId, 8, 'booked');

      const days = ((await read()).json() as DashboardBody).bookingWindow;

      expect(days[0]?.date).toBe(dayFrom(-1));
      expect(days[8]?.date).toBe(dayFrom(7));
      expect(days.every((day) => day.status === 'available')).toBe(true);
    });
  });

  describe('the next payout', () => {
    /**
     * A confirmed booking `offset` days out, worth `payoutCents` to the vendor.
     *
     * `payoutModel: 'separate'` and not the column default. The default is
     * `'destination'`, the pre-#423 charge that paid the vendor as the card
     * succeeded — a row the sweep will never transfer, so a fixture carrying it
     * would let every assertion below pass against money that does not move.
     */
    async function book(
      vendorId: string,
      requestId: string,
      offset: number,
      payoutCents: number,
      status: BookingStatus = 'confirmed',
    ): Promise<string> {
      const customer = await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, CUSTOMER));

      const [row] = await harness.database.db
        .insert(bookings)
        .values({
          requestId,
          customerId: customer[0]!.id,
          vendorId,
          eventDate: dayFrom(offset),
          totalAmountCents: payoutCents + 1_000,
          platformFeeCents: 1_000,
          vendorPayoutCents: payoutCents,
          status,
          payoutModel: 'separate',
          paidAt: new Date(),
        })
        .returning({ id: bookings.id });

      return row!.id;
    }

    it('names the soonest upcoming event, not the largest', async () => {
      const vendorId = await createProfile();
      const packageId = await addPackage();
      await publish(vendorId);
      const near = await request(vendorId, packageId, 10);
      const far = await request(vendorId, packageId, 40);

      await book(vendorId, far, 40, 900_000);
      await book(vendorId, near, 10, 50_000);

      const { next } = ((await read()).json() as DashboardBody).payouts;

      expect(next?.cents).toBe(50_000);
      expect(next?.releaseAt).toBe(payoutReleaseAt(dayFrom(10))?.toISOString());
    });

    /*
     * The reversal D37 made, asserted from both sides.
     *
     * This used to read "ignores a cancelled booking, which is money that is
     * not coming". `vendor_payout_cents` no longer means what was agreed; it
     * means what is still owed, and a cancellation inside D3's cutoff rewrites
     * it down to the share the vendor keeps for a date they held and lost
     * (D31). The sweep pays that residual on the original schedule, so ignoring
     * it would hide a real transfer on the screen a vendor plans around.
     */
    it('still owes a cancelled booking its retained share', async () => {
      const vendorId = await createProfile();
      const packageId = await addPackage();
      await publish(vendorId);
      const cancelled = await request(vendorId, packageId, 10);
      const live = await request(vendorId, packageId, 40);

      await book(vendorId, cancelled, 10, 50_000, 'cancelled');
      await book(vendorId, live, 40, 900_000);

      const body = (await read()).json() as DashboardBody;
      expect(body.payouts.next?.cents).toBe(50_000);
      expect(body.payouts.pendingCents).toBe(950_000);
    });

    /* The other side: a full refund writes zero, and zero is not owed. */
    it('ignores a fully refunded cancellation, which is excluded by its amount', async () => {
      const vendorId = await createProfile();
      const packageId = await addPackage();
      await publish(vendorId);
      const refunded = await request(vendorId, packageId, 10);
      const live = await request(vendorId, packageId, 40);

      await book(vendorId, refunded, 10, 0, 'cancelled');
      await book(vendorId, live, 40, 900_000);

      const body = (await read()).json() as DashboardBody;
      expect(body.payouts.next?.cents).toBe(900_000);
      expect(body.payouts.pendingCents).toBe(900_000);
      expect(body.payouts.pendingCount).toBe(1);
    });

    /*
     * A destination charge split the money as the card succeeded, so the vendor
     * already holds their share and the sweep will never transfer it. Naming it
     * here would be the dashboard promising a transfer that cannot happen.
     */
    it('ignores a legacy destination-charge booking', async () => {
      const vendorId = await createProfile();
      const packageId = await addPackage();
      await publish(vendorId);
      const legacy = await request(vendorId, packageId, 10);

      const bookingId = await book(vendorId, legacy, 10, 50_000);
      await harness.database.db
        .update(bookings)
        .set({ payoutModel: 'destination' })
        .where(eq(bookings.id, bookingId));

      const body = (await read()).json() as DashboardBody;
      expect(body.payouts.next).toBeNull();
      expect(body.payouts.pendingCents).toBe(0);
    });

    /**
     * A past event whose payout has not gone out is the **most** imminent
     * payout there is, and this used to answer null for it (#423).
     *
     * The date floor was correct while a destination charge paid the vendor as
     * the card succeeded: an event behind you was money already received.
     * Nothing pays out at the charge now, so whether a vendor is still owed is
     * `payout_released_at`, and the floor hid exactly the rows a vendor most
     * wants to see.
     */
    it('still names a past booking whose payout has not gone out', async () => {
      const vendorId = await createProfile();
      const packageId = await addPackage();
      await publish(vendorId);
      const past = await request(vendorId, packageId, 10);

      await book(vendorId, past, -5, 50_000);

      const { next } = ((await read()).json() as DashboardBody).payouts;
      expect(next?.cents).toBe(50_000);
      /* Its window closed while the transfer had not run, so the card must not
       * point forwards at a date already behind us. */
      expect(next?.isDue).toBe(true);
    });

    /* And nothing at all once the transfer has been made. */
    it('is null once every payout has been released', async () => {
      const vendorId = await createProfile();
      const packageId = await addPackage();
      await publish(vendorId);
      const past = await request(vendorId, packageId, 10);

      await book(vendorId, past, -5, 50_000);
      await harness.database.db
        .update(bookings)
        .set({ payoutReleasedAt: new Date(), stripeTransferId: 'tr_test_released' })
        .where(eq(bookings.vendorId, vendorId));

      expect(((await read()).json() as DashboardBody).payouts.next).toBeNull();
    });

    /*
     * The summed figure and its date — #424.
     *
     * Every assertion here names a number. A payout line a vendor plans around
     * is the one place `toBeTruthy()` would hide the whole defect: a figure
     * that exists and is wrong reads exactly like a figure that is right.
     */
    describe('the pending total', () => {
      it('sums every payout still owed, and dates the soonest of them', async () => {
        const vendorId = await createProfile();
        const packageId = await addPackage();
        await publish(vendorId);
        const near = await request(vendorId, packageId, 10);
        const far = await request(vendorId, packageId, 40);

        await book(vendorId, near, 10, 50_000);
        await book(vendorId, far, 40, 900_000);

        const { payouts } = (await read()).json() as DashboardBody;

        expect(payouts.pendingCents).toBe(950_000);
        expect(payouts.pendingCount).toBe(2);
        /*
         * Asserted against `payoutReleaseAt` rather than a written-out
         * timestamp, and D35 is never restated as a literal here: the point of
         * the acceptance is that the date shown is the date paid on, and a test
         * carrying its own copy of the interval would keep passing while the
         * two drifted apart.
         */
        expect(payouts.heldCents).toBe(0);
        expect(payouts.heldCount).toBe(0);
        /*
         * **`next` is the soonest booking alone, not the total.** $500 pays out
         * on its date and $9,000 thirty days later, so a response pairing
         * `950_000` with the earlier date would promise the whole sum then —
         * the figure-versus-transfer disagreement acceptance 7 forbids.
         *
         * The date is asserted against `payoutReleaseAt` rather than a
         * written-out timestamp, and D35's interval is never restated here: the
         * point is that the date shown is the date paid on, and a test carrying
         * its own copy of the interval would keep passing while the two drifted
         * apart.
         */
        expect(payouts.next).toMatchObject({
          cents: 50_000,
          customerFirstName: 'Test',
          releaseAt: payoutReleaseAt(dayFrom(10))?.toISOString(),
          isDue: false,
        });
      });

      /*
       * A held payout with an earlier event is not the next payout. It has no
       * release date at all, so letting it supply one would date the pending
       * figure from money that is frozen.
       */
      it('never lets a held booking be the next payout', async () => {
        const vendorId = await createProfile();
        const packageId = await addPackage();
        await publish(vendorId);
        const held = await request(vendorId, packageId, 10);
        const live = await request(vendorId, packageId, 40);

        await book(vendorId, held, 10, 50_000, 'disputed');
        await book(vendorId, live, 40, 900_000);

        const { payouts } = (await read()).json() as DashboardBody;

        expect(payouts.pendingCount).toBe(1);
        expect(payouts.next?.cents).toBe(900_000);
        expect(payouts.next?.releaseAt).toBe(payoutReleaseAt(dayFrom(40))?.toISOString());
      });

      /* Not `0` with a date beside it, and not a date carried over from money
       * already sent — a vendor with nothing owed is owed nothing, undated. */
      it('has no figure and no date for a vendor with nothing owed', async () => {
        await createProfile();

        const { payouts } = (await read()).json() as DashboardBody;

        expect(payouts.pendingCents).toBe(0);
        expect(payouts.pendingCount).toBe(0);
        expect(payouts.next).toBeNull();
        expect(payouts.heldCents).toBe(0);
      });

      /*
       * A dispute is a hold, not a failure and not an absence. The money is
       * still owed, so it is reported — but it has no known release date, so it
       * must not supply one, and it must not be added to the figure the sweep
       * is about to send.
       */
      it('reports a disputed payout as held, and never as the next release', async () => {
        const vendorId = await createProfile();
        const packageId = await addPackage();
        await publish(vendorId);
        const held = await request(vendorId, packageId, 10);
        const live = await request(vendorId, packageId, 40);

        await book(vendorId, held, 10, 50_000, 'disputed');
        await book(vendorId, live, 40, 900_000);

        const { payouts } = (await read()).json() as DashboardBody;

        expect(payouts.pendingCents).toBe(900_000);
        expect(payouts.pendingCount).toBe(1);
        expect(payouts.heldCents).toBe(50_000);
        expect(payouts.heldCount).toBe(1);
        // The held booking's event is 30 days sooner and still supplies no date.
        expect(payouts.next?.releaseAt).toBe(payoutReleaseAt(dayFrom(40))?.toISOString());
      });

      it('leaves nothing pending once every payout is held', async () => {
        const vendorId = await createProfile();
        const packageId = await addPackage();
        await publish(vendorId);
        const held = await request(vendorId, packageId, 10);

        await book(vendorId, held, 10, 50_000, 'disputed');

        const { payouts } = (await read()).json() as DashboardBody;

        expect(payouts.pendingCents).toBe(0);
        expect(payouts.next).toBeNull();
        expect(payouts.heldCents).toBe(50_000);
      });

      it('drops a released payout out of the figure on the next read', async () => {
        const vendorId = await createProfile();
        const packageId = await addPackage();
        await publish(vendorId);
        const released = await request(vendorId, packageId, 10);
        const live = await request(vendorId, packageId, 40);

        const releasedId = await book(vendorId, released, 10, 50_000);
        await book(vendorId, live, 40, 900_000);

        expect(((await read()).json() as DashboardBody).payouts.pendingCents).toBe(950_000);

        await harness.database.db
          .update(bookings)
          .set({ payoutReleasedAt: new Date(), stripeTransferId: 'tr_test_released' })
          .where(eq(bookings.id, releasedId));

        const { payouts } = (await read()).json() as DashboardBody;
        expect(payouts.pendingCents).toBe(900_000);
        expect(payouts.pendingCount).toBe(1);
        expect(payouts.next?.releaseAt).toBe(payoutReleaseAt(dayFrom(40))?.toISOString());
      });

      /**
       * **Acceptance 7 — the one that matters.**
       *
       * The figure a vendor is shown is compared against what the release sweep
       * would actually transfer for the same rows, by asking the sweep's own
       * query. Two numbers that can disagree eventually will, and the disagree-
       * ment would surface as a vendor being told they were owed money that
       * never arrived.
       *
       * Every event is in the past so the sweep's date bound admits all of
       * them; the dashboard drops that bound precisely because a payout whose
       * window is still open is owed too, and the assertion below would be
       * vacuous if none of these rows were due.
       */
      it('shows exactly what the release sweep would transfer for the same rows', async () => {
        const vendorId = await createProfile();
        const packageId = await addPackage();
        await publish(vendorId);
        const first = await request(vendorId, packageId, 10);
        const second = await request(vendorId, packageId, 20);
        const third = await request(vendorId, packageId, 30);
        const fourth = await request(vendorId, packageId, 40);

        // Owed, and due: a confirmed booking and a cancellation's retained share.
        await book(vendorId, first, -20, 127_600);
        await book(vendorId, second, -15, 31_900, 'cancelled');
        // Not owed: a dispute holds one, and a full refund zeroed the other.
        await book(vendorId, third, -12, 50_000, 'disputed');
        await book(vendorId, fourth, -11, 0, 'cancelled');

        const dueIds = await findDuePayoutBookingIds(
          harness.database.db,
          payoutDueThroughDate(new Date()),
          100,
        );
        const dueRows = await harness.database.db
          .select({ cents: bookings.vendorPayoutCents })
          .from(bookings)
          .where(inArray(bookings.id, dueIds));
        const sweepCents = dueRows.reduce((total, row) => total + row.cents, 0);

        const { payouts } = (await read()).json() as DashboardBody;

        expect(sweepCents).toBe(159_500);
        expect(payouts.pendingCents).toBe(sweepCents);
        expect(payouts.pendingCount).toBe(dueIds.length);
        expect(payouts.heldCents).toBe(50_000);
      });

      /**
       * The rate-change case, tested by making the stored split disagree with
       * every rate rather than by moving the rate.
       *
       * `vendor_payout_cents` is settled at the commission in force when the
       * card succeeded, so a booking written under an old rate must still show
       * that amount. Changing an env var and re-reading would prove nothing — a
       * surface that recomputed from a rate loaded once at boot would pass it.
       * This row's fee is a flat $10 against a $1,286 total, a split no
       * percentage rate produces, so **only** reading the stored column yields
       * the expected number: a recomputation at any rate lands somewhere else.
       */
      it('reports the stored payout, not a split any commission rate produces', async () => {
        const vendorId = await createProfile();
        const packageId = await addPackage();
        await publish(vendorId);
        const early = await request(vendorId, packageId, 10);

        // `book` writes total = payout + 1_000 and a 1_000 fee: 0.78%, which is
        // neither the current rate nor any rate this product would set.
        await book(vendorId, early, 10, 127_600);

        const { payouts } = (await read()).json() as DashboardBody;
        expect(payouts.pendingCents).toBe(127_600);
        expect(payouts.pendingCount).toBe(1);
      });
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
