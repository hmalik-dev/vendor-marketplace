import {
  adminActions,
  bookings,
  categories,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  toDateString,
} from '@vendor-marketplace/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';
import type { BookingContext } from '../payments/payments.service.js';
import { setUserBanned } from './admin.service.js';

/**
 * Reinstating an account stops a suspension that is still cancelling its
 * bookings (VEN-693).
 *
 * The unban lands while the first booking's refund is in flight, held open by
 * the fake Stripe's `duringNextRefund`. Without the per-booking re-read the
 * loop carries on and cancels and refunds the other two bookings of an account
 * that is live again. Real Postgres, like the other ban races in this folder.
 */
describe('an unban during a suspension unwind', () => {
  const ADMIN = 'user_unban_unwind_admin';
  const VENDOR = 'user_unban_unwind_vendor';
  const CUSTOMER = 'user_unban_unwind_customer';
  const START = new Date('2026-06-01T12:00:00Z');

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let adminId: string;
  let customerId: string;

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

  async function inject(
    method: 'POST' | 'PUT',
    url: string,
    actor: string,
    payload?: Record<string, unknown>,
  ) {
    return harness!.app.inject({
      method,
      url,
      headers: bearer(actor),
      ...(payload ? { payload } : {}),
    });
  }

  /** One accepted and paid booking for the customer, through the product's own routes. */
  async function paidBooking(vendorId: string, packageId: string, daysOut: number) {
    const request = await inject('POST', '/v1/booking-requests', CUSTOMER, {
      vendorId,
      packageId,
      eventDate: toDateString(addDays(START, daysOut)),
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      guestCount: 120,
    });
    expect(request.statusCode).toBe(201);
    const requestId: string = request.json().id;

    const accepted = await inject('POST', `/v1/booking-requests/${requestId}/accept`, VENDOR);
    expect(accepted.statusCode).toBe(200);

    const checkout = await inject(
      'POST',
      `/v1/customer/booking-requests/${requestId}/checkout`,
      CUSTOMER,
    );
    expect(checkout.statusCode).toBe(200);
    const intentId: string = checkout.json().paymentIntentId;
    harness!.stripe.succeed(intentId);
    harness!.stripe.nextEvent = {
      type: 'payment_intent.succeeded',
      accountId: null,
      objectId: intentId,
    };
    const webhook = await harness!.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: { id: `evt_${requestId}`, type: 'payment_intent.succeeded' },
    });
    expect(webhook.statusCode).toBe(200);
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database, clock: () => START });

    for (const [authUserId, roleHint] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint,
        avatarUrl: null,
      });
    }

    adminId = await signInAs(harness, ADMIN, true);
    customerId = await signInAs(harness, CUSTOMER);
    await signInAs(harness, VENDOR);
  });

  afterAll(async () => {
    await harness?.close();
    await database?.close();
  });

  it('cancels and refunds one booking and leaves the other two confirmed', async () => {
    const db = harness!.database.db;
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await inject('POST', '/v1/vendor/profile', VENDOR, {
      businessName: 'Sunlit Studio',
      categoryIds: [category!.id],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    expect(profile.statusCode).toBe(201);
    const vendorId: string = profile.json().id;

    const created = await inject('POST', '/v1/vendor/packages', VENDOR, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: 120_000,
      durationHours: 6,
    });
    expect(created.statusCode).toBe(201);

    await db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_unban_unwind' })
      .where(eq(vendorProfiles.id, vendorId));
    const agreement = await inject('POST', '/v1/vendor/agreement/accept', VENDOR, {
      version: CURRENT_VENDOR_AGREEMENT_VERSION,
    });
    expect(agreement.statusCode).toBe(200);

    for (const daysOut of [60, 70, 80]) {
      await paidBooking(vendorId, created.json().id, daysOut);
    }

    let unbanned: Promise<unknown> | undefined;
    harness!.stripe.duringNextRefund = async () => {
      unbanned = setUserBanned(context(), adminId, customerId, false, START);
      await unbanned;
    };

    const response = await inject('PUT', `/v1/admin/users/${customerId}/ban`, ADMIN);
    await unbanned;

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      isBanned: false,
      bookingsCancelled: 1,
      refundsIssued: 1,
    });

    const rows = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.customerId, customerId));
    expect(rows.map((row) => row.status).sort()).toEqual(['cancelled', 'confirmed', 'confirmed']);
    expect(harness!.stripe.refunds).toHaveLength(1);

    const [customer] = await db
      .select({ isBanned: users.isBanned })
      .from(users)
      .where(eq(users.id, customerId));
    expect(customer!.isBanned).toBe(false);

    const [halt] = await db
      .select({ detail: adminActions.detail })
      .from(adminActions)
      .where(
        and(
          eq(adminActions.action, 'account_unwind_finished'),
          eq(adminActions.subjectId, customerId),
        ),
      );
    expect(halt!.detail).toMatchObject({
      halted: 'account reinstated',
      bookingsCancelled: 1,
      bookingsLeftUntouched: 2,
    });
  });
});
