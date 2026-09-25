import {
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
  payoutReleaseAt,
  toDateString,
  type BookingStatus,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_payouts_vendor';
const OTHER_VENDOR = 'user_payouts_other_vendor';
const CUSTOMER = 'user_payouts_customer';

interface PayoutsBody {
  summary: {
    pendingCents: number;
    pendingCount: number;
    heldCents: number;
    heldCount: number;
    next: { cents: number; releaseAt: string } | null;
  };
  nextBookingId: string | null;
  account: { bankName: string | null; last4: string } | null;
  rows: {
    bookingId: string;
    customerName: string;
    eventType: string | null;
    eventDate: string;
    cents: number;
    payoutStatus: string;
    releaseAt: string | null;
    paidAt: string | null;
  }[];
}

/** `offset` days from today's UTC date. */
function dayFrom(offset: number): string {
  return toDateString(addDays(parseDateString(toDateString(new Date()))!, offset));
}

describe('GET /vendor/payouts', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function read(actor = VENDOR): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({ method: 'GET', url: '/v1/vendor/payouts', headers: bearer(actor) });
  }

  /** A published vendor with a package, as `actor`, returning the vendor and package ids. */
  async function publishedVendor(
    actor: string,
    businessName: string,
  ): Promise<{ vendorId: string; packageId: string }> {
    const profile = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(actor),
      payload: {
        businessName,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
        responseTimeHours: 4,
      },
    });
    expect(profile.statusCode).toBe(201);
    const vendorId = profile.json().id as string;

    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/packages',
      headers: bearer(actor),
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
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: `acct_${actor}` })
      .where(eq(vendorProfiles.id, vendorId));

    return { vendorId, packageId: created.json().id as string };
  }

  interface BookingInput {
    vendorId: string;
    packageId: string;
    /** The request's own date; must be in the future and unique per vendor. */
    requestOffset: number;
    eventOffset: number;
    payoutCents: number;
    status?: BookingStatus;
    releasedAt?: Date;
    debtNettedCents?: number;
    backupWithheldCents?: number;
  }

  async function book(input: BookingInput): Promise<string> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId: input.vendorId,
        packageId: input.packageId,
        eventDate: dayFrom(input.requestOffset),
        eventType: 'wedding',
      },
    });
    expect(created.statusCode).toBe(201);
    const [customer] = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, CUSTOMER));

    const [row] = await harness.database.db
      .insert(bookings)
      .values({
        requestId: created.json().id as string,
        customerId: customer!.id,
        vendorId: input.vendorId,
        eventDate: dayFrom(input.eventOffset),
        totalAmountCents: input.payoutCents + 1_000,
        platformFeeCents: 1_000,
        vendorPayoutCents: input.payoutCents,
        status: input.status ?? 'confirmed',
        payoutModel: 'separate',
        paidAt: new Date(),
        payoutReleasedAt: input.releasedAt ?? null,
        stripeTransferId: input.releasedAt ? `tr_${input.requestOffset}` : null,
        debtNettedCents: input.debtNettedCents ?? 0,
        backupWithheldCents: input.backupWithheldCents ?? 0,
      })
      .returning({ id: bookings.id });

    return row!.id;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [authUserId, role, email, lastName] of [
      [VENDOR, 'vendor', 'grace@example.com', 'Hopper'],
      [OTHER_VENDOR, 'vendor', 'ada@example.com', 'Lovelace'],
      [CUSTOMER, 'customer', 'alan@example.com', 'Nandakumar'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email,
        firstName: 'Test',
        lastName,
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
    harness.stripe.payoutAccounts.clear();
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(servicePackages);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('rejects an unauthenticated read and a customer', async () => {
    expect(
      (await harness.app.inject({ method: 'GET', url: '/v1/vendor/payouts' })).statusCode,
    ).toBe(401);
    expect((await read(CUSTOMER)).statusCode).toBe(403);
  });

  it('answers 404 before the vendor has a profile', async () => {
    expect((await read()).statusCode).toBe(404);
  });

  it('sums every held payout, names the next release and lists rows newest first', async () => {
    const { vendorId, packageId } = await publishedVendor(VENDOR, 'Sunlit Studio');

    const soon = await book({
      vendorId,
      packageId,
      requestOffset: 30,
      eventOffset: 5,
      payoutCents: 175_000,
    });
    const later = await book({
      vendorId,
      packageId,
      requestOffset: 31,
      eventOffset: 20,
      payoutCents: 240_050,
    });
    const releasedAt = new Date('2026-04-14T00:15:00.000Z');
    const paid = await book({
      vendorId,
      packageId,
      requestOffset: 32,
      eventOffset: -30,
      payoutCents: 98_000,
      releasedAt,
      debtNettedCents: 3_000,
      backupWithheldCents: 1_000,
    });

    const response = await read();
    expect(response.statusCode).toBe(200);
    const body = response.json() as PayoutsBody;

    // Two held, one paid: on hold is exactly the two held, never the paid one.
    expect(body.summary.pendingCents + body.summary.heldCents).toBe(415_050);
    expect(body.summary.pendingCount + body.summary.heldCount).toBe(2);
    expect(body.summary.next).toEqual({
      cents: 175_000,
      customerFirstName: 'Test',
      releaseAt: payoutReleaseAt(dayFrom(5))!.toISOString(),
      isDue: false,
    });
    expect(body.nextBookingId).toBe(soon);

    expect(body.rows).toEqual([
      {
        bookingId: later,
        customerName: 'Nandakumar',
        eventType: 'wedding',
        eventDate: dayFrom(20),
        cents: 240_050,
        payoutStatus: 'pending',
        releaseAt: payoutReleaseAt(dayFrom(20))!.toISOString(),
        paidAt: null,
      },
      {
        bookingId: soon,
        customerName: 'Nandakumar',
        eventType: 'wedding',
        eventDate: dayFrom(5),
        cents: 175_000,
        payoutStatus: 'pending',
        releaseAt: payoutReleaseAt(dayFrom(5))!.toISOString(),
        paidAt: null,
      },
      {
        bookingId: paid,
        customerName: 'Nandakumar',
        eventType: 'wedding',
        eventDate: dayFrom(-30),
        // What was sent: the share less the debt netted and the withholding.
        cents: 94_000,
        payoutStatus: 'released',
        releaseAt: payoutReleaseAt(dayFrom(-30))!.toISOString(),
        paidAt: releasedAt.toISOString(),
      },
    ]);
  });

  it('counts a disputed payout as on hold with no release date', async () => {
    const { vendorId, packageId } = await publishedVendor(VENDOR, 'Sunlit Studio');
    const disputed = await book({
      vendorId,
      packageId,
      requestOffset: 30,
      eventOffset: -1,
      payoutCents: 50_000,
      status: 'disputed',
    });

    const body = (await read()).json() as PayoutsBody;

    expect(body.summary.heldCents).toBe(50_000);
    expect(body.summary.next).toBeNull();
    expect(body.nextBookingId).toBeNull();
    expect(body.rows).toMatchObject([
      { bookingId: disputed, payoutStatus: 'held', releaseAt: null, paidAt: null },
    ]);
  });

  it('still answers when a customer name is 100 emoji, past a UTF-16 cap', async () => {
    const { vendorId, packageId } = await publishedVendor(VENDOR, 'Sunlit Studio');
    await book({ vendorId, packageId, requestOffset: 30, eventOffset: 5, payoutCents: 10_000 });
    const emojiName = '😀'.repeat(100);
    await harness.database.db
      .update(users)
      .set({ lastName: emojiName })
      .where(eq(users.authUserId, CUSTOMER));

    const response = await read();

    expect(response.statusCode).toBe(200);
    expect((response.json() as PayoutsBody).rows[0]?.customerName).toBe(emojiName);
  });

  it("never shows another vendor's payouts", async () => {
    const mine = await publishedVendor(VENDOR, 'Sunlit Studio');
    const theirs = await publishedVendor(OTHER_VENDOR, 'Other Light');
    const own = await book({
      vendorId: mine.vendorId,
      packageId: mine.packageId,
      requestOffset: 30,
      eventOffset: 10,
      payoutCents: 10_000,
    });
    await book({
      vendorId: theirs.vendorId,
      packageId: theirs.packageId,
      requestOffset: 31,
      eventOffset: 8,
      payoutCents: 99_000,
    });
    await book({
      vendorId: theirs.vendorId,
      packageId: theirs.packageId,
      requestOffset: 32,
      eventOffset: -20,
      payoutCents: 77_000,
      releasedAt: new Date(),
    });

    const body = (await read()).json() as PayoutsBody;

    expect(body.rows.map((row) => row.bookingId)).toEqual([own]);
    expect(body.summary.pendingCents).toBe(10_000);
    expect(body.nextBookingId).toBe(own);
  });

  it("names the bank Stripe pays out to, and nothing when Stripe can't say", async () => {
    await publishedVendor(VENDOR, 'Sunlit Studio');

    harness.stripe.payoutAccounts.set(`acct_${VENDOR}`, { bankName: 'Chase', last4: '4821' });
    expect(((await read()).json() as PayoutsBody).account).toEqual({
      bankName: 'Chase',
      last4: '4821',
    });

    harness.stripe.payoutAccounts.set(`acct_${VENDOR}`, new Error('Stripe is down'));
    const failed = await read();
    expect(failed.statusCode).toBe(200);
    expect((failed.json() as PayoutsBody).account).toBeNull();
  });
});
