import { bookings, categories, vendorProfiles } from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { liftDisputeHold, placeDisputeHold, type BookingContext } from './payments.service.js';

/**
 * #425's compensating unwind, on a real Postgres — the debt PGlite cannot pay.
 *
 * The unwind lifts **the hold it placed**, not whichever one is open, and it
 * says so by passing the `updated_at` it read back as a guard. `updated_at` is
 * a `timestamptz`: Postgres keeps it to the **microsecond** and the driver
 * hands it back as a JavaScript `Date`, which holds milliseconds. So the value
 * the caller has is already truncated, and a plain equality against the stored
 * column matches nothing at all.
 *
 * **PGlite rounds it, so the PGlite suite is green either way.** The first
 * report driven through a browser against the Docker Postgres refused every
 * unwind and left the booking `disputed` with no complaint anywhere — the exact
 * state the ticket exists to prevent, produced by the guard meant to prevent
 * it. The engine is the whole difference, which is what puts this here.
 */
describe('withdrawing a dispute hold, against a real Postgres', () => {
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';
  const PRICE_CENTS = 145_000;

  const START = new Date('2026-06-01T12:00:00Z');
  const EVENT_DATE = toDateString(addDays(START, 30));
  /** After the event, before the release: the window a hold can be placed in. */
  const AFTER_EVENT = addDays(START, 31);

  let clockNow = START;
  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let bookingId: string;

  async function inject(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    actor: string,
    payload?: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness!.app.inject({
      method,
      url,
      headers: bearer(actor),
      ...(payload ? { payload } : {}),
    });
  }

  function context(): BookingContext {
    return {
      db: harness!.database.db,
      stripe: harness!.stripe,
      hub: harness!.app.events,
      log: harness!.app.log,
      mail: {
        db: harness!.database.db,
        email: harness!.email,
        log: harness!.app.log,
        webOrigin: 'http://localhost:3000',
        background: harness!.app.background,
      },
    };
  }

  /** The customer, as the guards read them. */
  function customer(customerId: string): AuthenticatedUser {
    return { id: customerId, clerkUserId: CUSTOMER, role: 'customer' };
  }

  async function currentBooking(): Promise<typeof bookings.$inferSelect> {
    const [row] = await harness!.database.db.select().from(bookings);

    return row!;
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database, clock: () => clockNow });

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

    harness.stripe.accountStatuses.set('acct_test_vendor', {
      transfersActive: true,
      payoutsActive: true,
    });

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await inject('POST', '/vendor/profile', VENDOR, {
      businessName: 'Sunlit Studio',
      categoryIds: [photography!.id],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    expect(profile.statusCode).toBe(201);

    const servicePackage = await inject('POST', '/vendor/packages', VENDOR, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: PRICE_CENTS,
      priceType: 'fixed',
      inclusions: ['6 hours', '2 photographers'],
    });
    expect(servicePackage.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, profile.json().id));

    /*
     * A vendor cannot take payment until they hold the current vendor
     * agreement (#427), and this fixture reaches checkout — so without this the
     * booking under test never exists and there is nothing to hold.
     */
    const agreed = await inject('POST', '/vendor/agreement/accept', VENDOR, {
      version: CURRENT_VENDOR_AGREEMENT_VERSION,
    });
    expect(agreed.statusCode).toBe(200);

    const request = await inject('POST', '/booking-requests', CUSTOMER, {
      vendorId: profile.json().id,
      packageId: servicePackage.json().id,
      eventDate: EVENT_DATE,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      guestCount: 120,
    });
    expect(request.statusCode).toBe(201);
    const requestId: string = request.json().id;

    expect((await inject('POST', `/booking-requests/${requestId}/accept`, VENDOR)).statusCode).toBe(
      200,
    );

    const checkout = await inject(
      'POST',
      `/customer/booking-requests/${requestId}/checkout`,
      CUSTOMER,
    );
    expect(checkout.statusCode).toBe(200);

    const intentId: string = checkout.json().paymentIntentId;
    harness.stripe.succeed(intentId);
    harness.stripe.nextEvent = {
      type: 'payment_intent.succeeded',
      accountId: null,
      objectId: intentId,
    };

    expect(
      (
        await harness.app.inject({
          method: 'POST',
          url: '/webhooks/stripe',
          headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
          payload: { id: 'evt_test', type: 'payment_intent.succeeded' },
        })
      ).statusCode,
    ).toBe(200);

    bookingId = (await currentBooking()).id;
    clockNow = AFTER_EVENT;
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  /**
   * The case that was broken in production and green in the suite: the guard
   * has to match the row it was read from.
   *
   * A `timestamptz` carries more precision than the `Date` that reads it, so
   * this is the whole assertion — the value the caller holds still identifies
   * the row it came from.
   */
  it('lifts the hold it placed, with the timestamp it read back', async () => {
    const auth = customer((await currentBooking()).customerId);
    const held = await placeDisputeHold(context(), auth, bookingId, 'The first report.', clockNow);
    expect(held.status).toBe('disputed');

    const lifted = await liftDisputeHold(context(), held, held.updatedAt);

    expect(lifted).not.toBeNull();
    expect((await currentBooking()).status).toBe('confirmed');
    expect((await currentBooking()).disputeReason).toBeNull();
  });

  /* And it still refuses a row that has moved on since — the race it closes. */
  it('refuses to lift a hold that is no longer the one it placed', async () => {
    const auth = customer((await currentBooking()).customerId);
    const first = await placeDisputeHold(context(), auth, bookingId, 'The first report.', clockNow);

    /* The operator settles it, and the customer reports again. */
    expect(await liftDisputeHold(context(), first)).not.toBeNull();
    const second = await placeDisputeHold(
      context(),
      auth,
      bookingId,
      'The second report.',
      clockNow,
    );
    expect(second.updatedAt).not.toEqual(first.updatedAt);

    expect(await liftDisputeHold(context(), first, first.updatedAt)).toBeNull();

    const row = await currentBooking();
    expect(row.status).toBe('disputed');
    expect(row.disputeReason).toBe('The second report.');
  });
});
