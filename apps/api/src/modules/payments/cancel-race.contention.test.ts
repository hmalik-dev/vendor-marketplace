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
import { PassThrough } from 'node:stream';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * VEN-472, on a real Postgres: two cancels of one booking genuinely overlap.
 *
 * PGlite is one connection, so the routes suite only ever interleaves them at
 * an await. Here each request holds its own connection, both pass the
 * `confirmed` check, both reach Stripe, and the guarded update picks one. The
 * loser's cancellation worked, so it answers 200 with the winner's body, and the
 * false-positive error log a person would investigate is never written.
 */
describe('two cancels racing one booking, on two real connections', () => {
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';
  const PRICE_CENTS = 145_000;

  const START = new Date('2026-06-01T12:00:00Z');
  const EVENT_DATE = toDateString(addDays(START, 30));

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let bookingId: string;
  const logged: string[] = [];

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

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    const loggerStream = new PassThrough();
    loggerStream.on('data', (chunk: Buffer) => logged.push(chunk.toString()));
    harness = await createTestHarness({ database, clock: () => START, loggerStream });

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

  it('answers both with the same cancellation, refunds once and logs no error', async () => {
    logged.length = 0;

    const responses = await Promise.all([
      inject('PUT', `/customer/bookings/${bookingId}/cancel`, CUSTOMER, {}),
      inject('PUT', `/customer/bookings/${bookingId}/cancel`, CUSTOMER, {}),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(responses[0]!.json()).toEqual(responses[1]!.json());
    expect(responses[0]!.json().refundCents).toBe(PRICE_CENTS);
    expect(new Set(harness!.stripe.refunds.map((refund) => refund.idempotencyKey)).size).toBe(1);

    const [row] = await harness!.database.db.select().from(bookings);
    expect(row).toMatchObject({ status: 'cancelled', cancelledBy: 'customer' });
    expect(logged.filter((line) => line.includes('could not be cancelled'))).toEqual([]);
  });
});
