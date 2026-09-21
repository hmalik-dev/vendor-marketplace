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
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * VEN-499, on a real Postgres: a Dashboard refund's `charge.refunded` arrives
 * after our cancellation's top-up exists at Stripe and before the cancellation
 * has written its row.
 *
 * The webhook used to see the foreign cents as unaccounted for and move the
 * booking to `disputed`, which failed the cancellation's guarded update
 * (`status = confirmed`) after the money had moved. It now records the cents,
 * leaves the status alone, and the cancellation finishes.
 */
describe('a late charge.refunded landing beside a cancellation top-up, on two real connections', () => {
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';
  const PRICE_CENTS = 145_000;
  const FOREIGN_CENTS = 10_000;

  const START = new Date('2026-06-01T12:00:00Z');
  const EVENT_DATE = toDateString(addDays(START, 30));

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let bookingId: string;
  let intentId: string;

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

  function webhook(
    type: string,
    objectId: string,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    harness!.stripe.nextEvent = { type, accountId: null, objectId };

    return harness!.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: { id: 'evt_test', type },
    });
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({
      database,
      clock: () => START,
      env: { LOG_LEVEL: 'error' },
    });

    for (const [authUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
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

    intentId = checkout.json().paymentIntentId;
    harness.stripe.succeed(intentId);
    expect((await webhook('payment_intent.succeeded', intentId)).statusCode).toBe(200);

    const [row] = await harness.database.db.select().from(bookings);
    bookingId = row!.id;
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  it("records the foreign cents, and the cancellation still ends cancelled with Stripe's total", async () => {
    const stripe = harness!.stripe;
    stripe.refundExternally(intentId, FOREIGN_CENTS);
    const createRefund = stripe.createRefund;
    let delivered: Awaited<ReturnType<TestHarness['app']['inject']>> | undefined;

    stripe.createRefund = async (input) => {
      const created = await createRefund(input);

      delivered = await webhook('charge.refunded', `ch_${intentId}`);

      return created;
    };

    const cancelled = await inject('PUT', `/customer/bookings/${bookingId}/cancel`, CUSTOMER, {});

    stripe.createRefund = createRefund;
    expect(delivered?.json().outcome).toBe('refund-recorded');
    expect(cancelled.statusCode).toBe(200);
    expect(stripe.refunds.map((refund) => refund.amountCents)).toEqual([
      FOREIGN_CENTS,
      PRICE_CENTS - FOREIGN_CENTS,
    ]);
    const [row] = await harness!.database.db.select().from(bookings);
    expect(row).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'customer',
      refundAmountCents: PRICE_CENTS,
      externalRefundCents: FOREIGN_CENTS,
    });
  });
});
