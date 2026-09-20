import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  operatorAlerts,
  refundAttempts,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { releaseDuePayouts } from './payouts.service.js';

/**
 * VEN-469: money that was refunded is never refunded again, and never paid out,
 * whichever side started the refund.
 */
const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';
const PRICE_CENTS = 145_000;
const GOODWILL_CENTS = 10_000;
const VENDOR_ACCOUNT = 'acct_test_vendor';
const START = new Date('2026-06-01T12:00:00Z');
const EVENT_DATE = toDateString(addDays(START, 30));
const AFTER_RELEASE = addDays(START, 34);

let clockNow = START;

describe('a refund made outside the app', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function inject(
    method: 'POST' | 'PUT',
    url: string,
    actor: string,
    payload?: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method,
      url,
      headers: bearer(actor),
      ...(payload ? { payload } : {}),
    });
  }

  async function currentBooking(): Promise<typeof bookings.$inferSelect> {
    const [row] = await harness.database.db.select().from(bookings);

    return row!;
  }

  async function webhook(
    type: string,
    objectId: string,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    harness.stripe.nextEvent = { type, accountId: null, objectId };

    return harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: { id: 'evt_test', type },
    });
  }

  /** `charge.refunded` for the charge behind an intent. */
  const chargeRefunded = (paymentIntentId: string) =>
    webhook('charge.refunded', `ch_${paymentIntentId}`);

  async function paidBooking(): Promise<typeof bookings.$inferSelect & { intentId: string }> {
    const profile = await inject('POST', '/vendor/profile', VENDOR, {
      businessName: 'Sunlit Studio',
      categoryIds: [photographyId],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    const vendorId: string = profile.json().id;
    const servicePackage = await inject('POST', '/vendor/packages', VENDOR, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: PRICE_CENTS,
      priceType: 'fixed',
      durationHours: 6,
      inclusions: ['6 hours'],
    });

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: VENDOR_ACCOUNT })
      .where(eq(vendorProfiles.id, vendorId));
    await inject('POST', '/vendor/agreement/accept', VENDOR, {
      version: CURRENT_VENDOR_AGREEMENT_VERSION,
    });

    const request = await inject('POST', '/booking-requests', CUSTOMER, {
      vendorId,
      packageId: servicePackage.json().id,
      eventDate: EVENT_DATE,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      guestCount: 120,
    });
    const requestId: string = request.json().id;
    await inject('POST', `/booking-requests/${requestId}/accept`, VENDOR);
    const checkout = await inject(
      'POST',
      `/customer/booking-requests/${requestId}/checkout`,
      CUSTOMER,
    );
    const intentId: string = checkout.json().paymentIntentId;
    harness.stripe.succeed(intentId);
    expect((await webhook('payment_intent.succeeded', intentId)).statusCode).toBe(200);

    return { ...(await currentBooking()), intentId };
  }

  function sweep(): ReturnType<typeof releaseDuePayouts> {
    return releaseDuePayouts(
      {
        db: harness.database.db,
        stripe: harness.stripe,
        log: harness.app.log,
        alerts: harness.app.operatorAlerts,
      },
      AFTER_RELEASE,
    );
  }

  async function refundAlerts(): Promise<string[]> {
    await harness.flushEmail();
    const rows = await harness.database.db.select().from(operatorAlerts);

    return rows.filter((row) => row.kind === 'refund_unrecorded').map((row) => row.subjectId);
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => clockNow });

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

    harness.stripe.accountStatuses.set(VENDOR_ACCOUNT, {
      transfersActive: true,
      payoutsActive: true,
    });
    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  afterEach(async () => {
    clockNow = START;
    harness.stripe.paymentIntents.clear();
    harness.stripe.intentsByKey.clear();
    harness.stripe.refunds.length = 0;
    harness.stripe.transfers.length = 0;
    harness.stripe.refundsToRefuse.clear();
    harness.stripe.failedRefundKeys.clear();
    harness.email.sent.length = 0;
    await harness.database.db.delete(operatorAlerts);
    await harness.database.db.delete(refundAttempts);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('charge.refunded', () => {
    it('holds the payout, records the difference and tells the operator, and the sweep then leaves it', async () => {
      const paid = await paidBooking();
      harness.stripe.refundExternally(paid.intentId, GOODWILL_CENTS);

      const response = await chargeRefunded(paid.intentId);

      expect(response.statusCode).toBe(200);
      expect(response.json().outcome).toBe('refund-held');
      const held = await currentBooking();
      expect(held.status).toBe('disputed');
      expect(held.externalRefundCents).toBe(GOODWILL_CENTS);
      expect(held.disputeReason).toBe(
        '$100 was refunded at Stripe outside the platform, so the payout is on hold until an operator rules',
      );
      expect(await refundAlerts()).toEqual([`${paid.id}:${GOODWILL_CENTS}`]);

      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
    });

    it('changes nothing and tells nobody when the refund is our own cancellation echoed back', async () => {
      const paid = await paidBooking();

      expect(
        (await inject('PUT', `/customer/bookings/${paid.id}/cancel`, CUSTOMER, {})).statusCode,
      ).toBe(200);
      const cancelled = await currentBooking();
      expect(cancelled.refundAmountCents).toBeGreaterThan(0);

      const response = await chargeRefunded(paid.intentId);

      expect(response.json().outcome).toBe('refund-unchanged');
      expect(await currentBooking()).toEqual(cancelled);
      expect(await refundAlerts()).toEqual([]);
    });

    it('does not mistake our own refund for a foreign one while the cancellation is still writing its row', async () => {
      const paid = await paidBooking();
      await harness.stripe.createRefund({
        paymentIntentId: paid.intentId,
        amountCents: PRICE_CENTS,
        idempotencyKey: `cancel_${paid.id}_marked`,
      });

      const response = await chargeRefunded(paid.intentId);

      expect(response.json().outcome).toBe('refund-unchanged');
      expect((await currentBooking()).status).toBe('confirmed');
      expect(await refundAlerts()).toEqual([]);
    });

    it('changes nothing further on a duplicate delivery', async () => {
      const paid = await paidBooking();
      harness.stripe.refundExternally(paid.intentId, GOODWILL_CENTS);

      expect((await chargeRefunded(paid.intentId)).json().outcome).toBe('refund-held');
      const afterFirst = await currentBooking();
      const second = await chargeRefunded(paid.intentId);

      expect(second.json().outcome).toBe('refund-unchanged');
      expect(await currentBooking()).toEqual(afterFirst);
      expect(await refundAlerts()).toHaveLength(1);
    });

    it('holds again for a further refund on the same booking', async () => {
      const paid = await paidBooking();
      harness.stripe.refundExternally(paid.intentId, GOODWILL_CENTS);
      await chargeRefunded(paid.intentId);
      harness.stripe.refundExternally(paid.intentId, 5_000);

      const response = await chargeRefunded(paid.intentId);

      expect(response.json().outcome).toBe('refund-recorded');
      expect((await currentBooking()).externalRefundCents).toBe(GOODWILL_CENTS + 5_000);
      expect(await refundAlerts()).toHaveLength(2);
    });

    it('only alerts when the payout has already been released', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      harness.stripe.refundExternally(paid.intentId, GOODWILL_CENTS);

      const response = await chargeRefunded(paid.intentId);

      expect(response.json().outcome).toBe('refund-recorded');
      const after = await currentBooking();
      expect(after.status).toBe('confirmed');
      expect(after.externalRefundCents).toBe(GOODWILL_CENTS);
      expect(harness.stripe.transfers).toHaveLength(1);
      expect(await refundAlerts()).toEqual([`${paid.id}:${GOODWILL_CENTS}`]);
    });

    it('acknowledges a charge the platform cannot read, as a connected account has', async () => {
      const paid = await paidBooking();
      harness.stripe.refundExternally(paid.intentId, GOODWILL_CENTS);

      const response = await webhook('charge.refunded', 'py_on_a_connected_account');

      expect(response.statusCode).toBe(200);
      expect(response.json().outcome).toBe('refund-unchanged');
      expect((await currentBooking()).status).toBe('confirmed');
    });

    it('acknowledges a charge that belongs to no booking', async () => {
      const response = await chargeRefunded('pi_not_ours');

      expect(response.statusCode).toBe(200);
      expect(response.json().outcome).toBe('refund-unchanged');
    });
  });

  describe('the payout claim, with no webhook at all', () => {
    it('holds a due booking whose charge shows an unrecorded refund, and alerts once', async () => {
      const paid = await paidBooking();
      harness.stripe.refundExternally(paid.intentId, GOODWILL_CENTS);
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 0, skipped: 1, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
      expect((await currentBooking()).status).toBe('disputed');

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(await refundAlerts()).toEqual([`${paid.id}:${GOODWILL_CENTS}`]);
    });

    it('still pays a booking with no foreign refund', async () => {
      await paidBooking();
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toHaveLength(1);
      expect(await refundAlerts()).toEqual([]);
    });

    it('does not pay when Stripe cannot be asked, and records the failed attempt', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      const original = harness.stripe.findRefund;
      harness.stripe.findRefund = () => Promise.reject(new Error('stripe unreachable'));

      try {
        expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 1 });
      } finally {
        harness.stripe.findRefund = original;
      }

      expect(harness.stripe.transfers).toEqual([]);
      expect((await currentBooking()).payoutAttempts).toBe(1);
      expect(paid.payoutReleasedAt).toBeNull();
    });
  });

  describe('the refund key', () => {
    it('is new after Stripe refused a refund, and the retry then succeeds (D36)', async () => {
      const paid = await paidBooking();
      harness.stripe.refundsToRefuse.add(paid.intentId);

      const refused = await inject('PUT', `/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});

      expect(refused.statusCode).toBeGreaterThanOrEqual(500);
      expect(harness.stripe.refunds).toEqual([]);
      expect(harness.stripe.failedRefundKeys.has(`cancel_${paid.id}_marked`)).toBe(true);
      const [recorded] = await harness.database.db.select().from(refundAttempts);
      expect(recorded).toMatchObject({ scope: `cancel_${paid.id}`, failedAttempts: 1 });

      harness.stripe.refundsToRefuse.clear();
      const retried = await inject('PUT', `/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});

      expect(retried.statusCode).toBe(200);
      expect(harness.stripe.refunds).toHaveLength(1);
      expect(harness.stripe.refunds[0]?.idempotencyKey).toBe(`cancel_${paid.id}_marked_1`);
    });

    it('keeps one key for two cancellations made together', async () => {
      const paid = await paidBooking();

      const [first, second] = await Promise.all([
        inject('PUT', `/customer/bookings/${paid.id}/cancel`, CUSTOMER, {}),
        inject('PUT', `/customer/bookings/${paid.id}/cancel`, CUSTOMER, {}),
      ]);

      expect([first.statusCode, second.statusCode].sort()).toContain(200);
      expect(harness.stripe.refunds).toHaveLength(1);
      expect(harness.stripe.refunds[0]?.idempotencyKey).toBe(`cancel_${paid.id}_marked`);
    });
  });
});
