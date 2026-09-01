import {
  bookingRequests,
  bookings,
  categories,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The dashboard's month window, at the boundary, west of UTC. #391.
 *
 * `getVendorDashboard` collapses an instant to a calendar day and then builds a
 * month from it. If that collapse consults the **local** clock while the row
 * filter compares against `bookings.paid_at` — a `timestamptz`, pinned here to
 * UTC midnight — the window is a local month with UTC edges, and it is wrong by
 * the server's offset at both ends. A vendor in `America/Chicago` loses
 * 19:00–23:59 on the final day of every month from `earningsThisMonthCents`,
 * silently: nothing errors, the figure is simply short.
 *
 * **Why this file pins `TZ` rather than trusting the machine.** Under UTC the
 * two readings agree and every assertion below passes against the *unfixed*
 * service — which is exactly how this survived: CI runs UTC, so the suite was
 * green there while going red on a developer's laptop on the last evening of a
 * month. A check that cannot fail is not a check, so the timezone is part of
 * the fixture, not part of the environment.
 *
 * Node re-reads `process.env.TZ` on assignment, so setting it here is enough
 * and does not require a separate Vitest project.
 */
const WESTERN_TZ = 'America/Chicago';

const VENDOR = 'user_vendor_tz';
const CUSTOMER = 'user_customer_tz';

/*
 * 2031-09-01T02:30:00Z is 2031-08-31T21:30 in Chicago. The UTC day and the
 * local day are different months, which is the whole point: every figure below
 * lands in a different month depending on which clock the collapse consults.
 */
const NOW = new Date('2031-09-01T02:30:00.000Z');

/** Paid 90 minutes before `NOW`, so it is September in UTC and August locally. */
const PAID_AT = new Date('2031-09-01T01:00:00.000Z');

const PAYOUT_CENTS = 127_600;

describe('the vendor dashboard month window, at a boundary west of UTC', () => {
  let harness: TestHarness;
  let originalTz: string | undefined;
  let vendorId: string;

  beforeAll(async () => {
    originalTz = process.env.TZ;
    process.env.TZ = WESTERN_TZ;

    // Guards the fixture: if Node ever stops honouring a runtime TZ change,
    // every assertion below would silently become a UTC test that passes
    // against the bug. Fail here instead, naming why.
    expect(
      new Date('2031-09-01T02:30:00.000Z').getDate(),
      'the runtime ignored process.env.TZ, so this file proves nothing',
    ).toBe(31);

    harness = await createTestHarness({ clock: () => NOW });

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'tz-vendor@example.com'],
      [CUSTOMER, 'customer', 'tz-customer@example.com'],
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

    const categoryRows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Boundary Studio',
        categoryIds: [categoryRows[0]!.id],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
      },
    });
    expect(profile.statusCode).toBe(201);
    vendorId = profile.json().id;

    /*
     * Inserted rather than materialised through a request: a `users` row only
     * appears on that account's first authenticated call, and this booking needs
     * a customer, not a customer's journey.
     */
    const customer = await harness.database.db
      .insert(users)
      .values({
        clerkUserId: CUSTOMER,
        email: 'tz-customer@example.com',
        role: 'customer',
        firstName: 'Test',
        lastName: 'User',
      })
      .returning({ id: users.id });

    const request = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId: customer[0]!.id,
        vendorId,
        eventDate: '2031-09-15',
        status: 'accepted',
        finalPriceCents: 145_000,
      })
      .returning({ id: bookingRequests.id });

    await harness.database.db.insert(bookings).values({
      requestId: request[0]!.id,
      customerId: customer[0]!.id,
      vendorId,
      eventDate: '2031-09-15',
      totalAmountCents: 145_000,
      platformFeeCents: 17_400,
      vendorPayoutCents: PAYOUT_CENTS,
      paidAt: PAID_AT,
    });
  });

  afterAll(async () => {
    /*
     * The restore runs first and the teardown is guarded, because `beforeAll`
     * can throw — the `getDate()` guard firing, the harness timing out, the
     * `photography` category missing — and then `harness` is undefined. Doing
     * the deletes first meant `afterAll` died on `undefined.close()`, leaving
     * `TZ` set and burying the diagnostic message the guard exists to print.
     *
     * Harmless today, since Vitest forks each file and the process dies with
     * it. It stops being harmless the moment anyone sets `isolate: false` to
     * speed the suite up: `maxWorkers: 1` would then hand every later API file
     * a `America/Chicago` clock it never asked for.
     */
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }

    if (harness === undefined) {
      return;
    }

    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    await harness.close();
  });

  async function dashboard(): Promise<{
    earningsThisMonthCents: number;
    bookingsThisMonth: number;
    bookingsLastMonth: number;
  }> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/vendor/dashboard',
      headers: bearer(VENDOR),
    });

    expect(response.statusCode).toBe(200);
    return response.json();
  }

  it('counts a payment taken after UTC midnight in the UTC month', async () => {
    /*
     * The failing assertion before #391. `paid_at` is 2031-09-01T01:00Z, so it
     * belongs to September. Anchored on the local day the window is
     * [2031-08-01T00:00Z, 2031-09-01T00:00Z) — an hour short — and the payment
     * falls outside it entirely, reading 0.
     */
    expect((await dashboard()).earningsThisMonthCents).toBe(PAYOUT_CENTS);
  });

  it('puts an event on the first of the UTC month in this month, not last', async () => {
    /*
     * The same boundary reached by the other column. `countBookingsBetween`
     * filters `event_date`, a `date`, against the bounds **as strings**, where
     * `sumPayoutsBetween` pins them to instants — so the two arrive at the
     * boundary by different routes and both have to land on the same calendar
     * day. An event on 2031-09-01 belongs to September; anchored on the local
     * day the window is August's and the booking falls out of both months.
     *
     * They are not the same measure and are not expected to agree on a count:
     * `sumPayoutsBetween`'s own contract is that money which has arrived is this
     * month's earnings **even when the event is next year**. What must agree is
     * where the month starts and ends.
     */
    await harness.database.db
      .update(bookings)
      .set({ eventDate: '2031-09-01' })
      .where(eq(bookings.vendorId, vendorId));

    const { bookingsThisMonth, bookingsLastMonth } = await dashboard();

    expect(bookingsThisMonth).toBe(1);
    expect(bookingsLastMonth).toBe(0);

    await harness.database.db
      .update(bookings)
      .set({ eventDate: '2031-09-15' })
      .where(eq(bookings.vendorId, vendorId));
  });

  it('leaves a payment taken before the boundary out of this month’s earnings', async () => {
    // The other side of the same edge: 45 minutes earlier is still August in
    // UTC, and must not be counted into September's earnings.
    await harness.database.db
      .update(bookings)
      .set({ paidAt: new Date('2031-08-31T23:15:00.000Z') })
      .where(eq(bookings.vendorId, vendorId));

    const { earningsThisMonthCents, bookingsThisMonth } = await dashboard();

    expect(earningsThisMonthCents).toBe(0);
    // Unchanged, and deliberately so: the event is still 15 September. The two
    // figures count different things, which is why only the bounds are shared.
    expect(bookingsThisMonth).toBe(1);

    await harness.database.db
      .update(bookings)
      .set({ paidAt: PAID_AT })
      .where(eq(bookings.vendorId, vendorId));
  });
});
