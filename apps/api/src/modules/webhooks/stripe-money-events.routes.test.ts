import {
  bookingRequests,
  bookings,
  categories,
  notifications,
  adminAlerts,
  supportCases,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  TEST_ENV,
  type TestHarness,
} from '../../testing/test-server.js';

/**
 * VEN-645: the money events Stripe raises after checkout — a reversed transfer,
 * a vendor's failed bank payout, an issuer's early fraud warning. Each is
 * delivered through the fake Stripe, which is what proves the handler re-read
 * the object instead of trusting the payload.
 */
const VENDOR = 'user_vendor_money_events';
const CUSTOMER = 'user_customer_money_events';
const ACCOUNT_ID = 'acct_money_events';
const TOTAL_CENTS = 120_000;
const PAYOUT_CENTS = 105_600;
const PAYMENT_INTENT_ID = 'pi_money_events';
const TRANSFER_ID = 'tr_money_events';

describe('money events after checkout (VEN-645)', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function signIn(authUserId: string): Promise<string> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/v1/users/me',
      headers: bearer(authUserId),
    });
    expect(response.statusCode).toBe(200);

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, authUserId))
      .limit(1);

    return rows[0]!.id;
  }

  /** A paid booking whose payout was released as a transfer. */
  async function seedReleasedBooking(): Promise<{ bookingId: string; vendorId: string }> {
    const customerId = await signIn(CUSTOMER);
    await signIn(VENDOR);

    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });
    expect(created.statusCode).toBe(201);

    const [profile] = await harness.database.db
      .update(vendorProfiles)
      .set({ stripeAccountId: ACCOUNT_ID })
      .returning({ id: vendorProfiles.id });
    const vendorId = profile!.id;

    const [request] = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId,
        eventDate: '2020-06-01',
        status: 'accepted',
        finalPriceCents: TOTAL_CENTS,
      })
      .returning({ id: bookingRequests.id });

    const [booking] = await harness.database.db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId,
        vendorId,
        eventDate: '2020-06-01',
        totalAmountCents: TOTAL_CENTS,
        platformFeeCents: TOTAL_CENTS - PAYOUT_CENTS,
        vendorPayoutCents: PAYOUT_CENTS,
        payoutModel: 'separate',
        status: 'confirmed',
        paidAt: new Date('2020-05-01T00:00:00Z'),
        payoutReleasedAt: new Date('2020-06-05T00:00:00Z'),
        stripePaymentIntentId: PAYMENT_INTENT_ID,
        stripeTransferId: TRANSFER_ID,
      })
      .returning({ id: bookings.id });

    harness.stripe.paymentIntents.set(PAYMENT_INTENT_ID, {
      id: PAYMENT_INTENT_ID,
      status: 'succeeded',
      amountReceivedCents: TOTAL_CENTS,
      clientSecret: null,
      metadata: {},
    });
    harness.stripe.transfers.push({
      transferId: TRANSFER_ID,
      bookingId: booking!.id,
      amountCents: PAYOUT_CENTS,
      destinationAccountId: ACCOUNT_ID,
      transferGroup: 'booking_money_events',
      idempotencyKey: 'transfer_money_events',
      reversedCents: 0,
    });

    return { bookingId: booking!.id, vendorId };
  }

  async function deliver(type: string, objectId: string, accountId: string | null = null) {
    harness.stripe.nextEvent = { type, accountId, objectId };

    const response = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_money', object: 'event' }),
    });
    await harness.flushEmail();

    return response;
  }

  async function readBooking(bookingId: string) {
    const [row] = await harness.database.db
      .select({
        status: bookings.status,
        vendorPayoutCents: bookings.vendorPayoutCents,
        payoutReleasedAt: bookings.payoutReleasedAt,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    return row!;
  }

  const alertSubjects = () =>
    harness.email.sent
      .filter((message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL)
      .map((message) => message.subject);

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [authUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
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
    await harness.database.db.delete(adminAlerts);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(supportCases);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.email.sent.length = 0;
    harness.stripe.transfers.length = 0;
    harness.stripe.payouts.clear();
    harness.stripe.fraudWarnings.clear();
    harness.stripe.paymentIntents.clear();
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('transfer.reversed', () => {
    it('lowers the vendor share to what Stripe says is left, and keeps the release', async () => {
      const { bookingId } = await seedReleasedBooking();
      harness.stripe.transfers[0]!.reversedCents = 40_000;

      const response = await deliver('transfer.reversed', TRANSFER_ID);

      expect(response.statusCode).toBe(200);
      expect(response.json().outcome).toBe('transfer-reversed');

      const booking = await readBooking(bookingId);
      expect(booking.vendorPayoutCents).toBe(65_600);
      // Still released: the sweep must not send a reversed transfer out again.
      expect(booking.payoutReleasedAt).not.toBeNull();
    });

    it('changes nothing on a redelivery, or when the row already agrees with Stripe', async () => {
      const { bookingId } = await seedReleasedBooking();
      harness.stripe.transfers[0]!.reversedCents = 40_000;

      expect((await deliver('transfer.reversed', TRANSFER_ID)).json().outcome).toBe(
        'transfer-reversed',
      );
      const replay = await deliver('transfer.reversed', TRANSFER_ID);

      expect(replay.json().outcome).toBe('transfer-unchanged');
      expect((await readBooking(bookingId)).vendorPayoutCents).toBe(65_600);
    });

    it('takes a reversal off what a lost chargeback left the vendor owing, and follows a cancelled booking too', async () => {
      const { bookingId } = await seedReleasedBooking();
      await harness.database.db
        .update(bookings)
        .set({ vendorOwedCents: PAYOUT_CENTS, status: 'cancelled', cancelledBy: 'admin' })
        .where(eq(bookings.id, bookingId));
      harness.stripe.transfers[0]!.reversedCents = 40_000;

      const response = await deliver('transfer.reversed', TRANSFER_ID);

      expect(response.json().outcome).toBe('transfer-reversed');
      const [row] = await harness.database.db
        .select({
          vendorPayoutCents: bookings.vendorPayoutCents,
          vendorOwedCents: bookings.vendorOwedCents,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      expect(row).toEqual({ vendorPayoutCents: 65_600, vendorOwedCents: 65_600 });
    });

    it('acknowledges a transfer no booking here paid without asking Stripe about it', async () => {
      await seedReleasedBooking();

      const response = await deliver('transfer.reversed', 'tr_someone_elses');

      expect(response.statusCode).toBe(200);
      expect(response.json().outcome).toBe('transfer-unchanged');
    });
  });

  describe('payout.failed', () => {
    it('alerts the admin naming the vendor when Stripe still reports the payout failed', async () => {
      await seedReleasedBooking();
      harness.stripe.payouts.set('po_failed', {
        payoutId: 'po_failed',
        status: 'failed',
        amountCents: 50_000,
        failureMessage: 'Account closed',
      });

      const response = await deliver('payout.failed', 'po_failed', ACCOUNT_ID);

      expect(response.statusCode).toBe(200);
      expect(response.json().outcome).toBe('payout-failed');
      expect(alertSubjects()).toEqual(["[Orla ops] Sunlit Studio's bank payout failed"]);
    });

    it('stays quiet when the payout read back is not failed', async () => {
      await seedReleasedBooking();
      harness.stripe.payouts.set('po_paid', {
        payoutId: 'po_paid',
        status: 'paid',
        amountCents: 50_000,
        failureMessage: null,
      });

      const response = await deliver('payout.failed', 'po_paid', ACCOUNT_ID);

      expect(response.json().outcome).toBe('payout-unchanged');
      expect(alertSubjects()).toEqual([]);
    });
  });

  describe('radar.early_fraud_warning.created', () => {
    async function warn(warningId: string) {
      harness.stripe.fraudWarnings.set(warningId, {
        warningId,
        fraudType: 'fraudulent',
        chargeId: `ch_${PAYMENT_INTENT_ID}`,
      });

      return deliver('radar.early_fraud_warning.created', warningId);
    }

    it('opens one case and alerts the admin, refunding and freezing nothing', async () => {
      const { bookingId } = await seedReleasedBooking();

      const first = await warn('issfr_1');
      expect(first.statusCode).toBe(200);
      expect(first.json().outcome).toBe('fraud-warning-opened');
      expect(alertSubjects()).toEqual([`[Orla ops] Early fraud warning on booking ${bookingId}`]);

      const replay = await warn('issfr_1');
      expect(replay.json().outcome).toBe('fraud-warning-recorded');

      const cases = await harness.database.db
        .select({ origin: supportCases.origin, bookingId: supportCases.bookingId })
        .from(supportCases);
      expect(cases).toEqual([{ origin: 'fraud_warning', bookingId }]);
      expect(harness.stripe.refunds).toHaveLength(0);
      expect((await readBooking(bookingId)).status).toBe('confirmed');
    });

    it('ignores a warning on a charge no booking here owns', async () => {
      await seedReleasedBooking();
      harness.stripe.fraudWarnings.set('issfr_other', {
        warningId: 'issfr_other',
        fraudType: 'misc',
        chargeId: 'ch_pi_unknown',
      });
      harness.stripe.paymentIntents.set('pi_unknown', {
        id: 'pi_unknown',
        status: 'succeeded',
        amountReceivedCents: 100,
        clientSecret: null,
        metadata: {},
      });

      const response = await deliver('radar.early_fraud_warning.created', 'issfr_other');

      expect(response.json().outcome).toBe('ignored');
      expect(await harness.database.db.select().from(supportCases)).toHaveLength(0);
    });
  });
});
