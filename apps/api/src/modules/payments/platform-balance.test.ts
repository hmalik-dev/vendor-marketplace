import {
  bookingRequests,
  bookings,
  operatorAlerts,
  supportCases,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, TEST_ENV, type TestHarness } from '../../testing/test-server.js';
import { reconcilePlatformBalance } from './platform-balance.service.js';

const NOW = new Date('2026-09-23T09:00:00Z');
/** Past `alertNow`'s six-hour window, so only the per-day check can hold it back. */
const LATER_THAT_DAY = new Date('2026-09-23T21:00:00Z');
const NEXT_DAY = new Date('2026-09-24T09:00:00Z');
let clockNow = NOW;
const PAST_THE_CHARGEBACK_WINDOW = new Date('2026-05-25T09:00:00Z');

/*
 * What the fixtures below owe, worked by hand. Refundable commission is net of
 * the fee allowance, 4.4% + 30¢ of the total.
 * - confirmed, unreleased: its $880.00 payout, plus the $120.00 rest of its
 *   total less a $44.30 fee: $75.70
 * - cancelled at 50%, unreleased: its $220.00 residual payout, nothing refundable
 * - confirmed, unreleased, $50.00 refunded at Stripe: its $176.00 payout, and no
 *   more than the $150.00 left, which the payout already covers
 * - released today: nothing to the vendor, but its $36.00 commission less a
 *   $13.50 fee could still be charged back: $22.50
 * - released 121 days ago, under an open chargeback, and a legacy destination
 *   charge: nothing
 */
const OWED_PAYOUTS_CENTS = 88_000 + 22_000 + 17_600;
const OWED_REFUNDS_CENTS = 7_570 + 2_250;
const REQUIRED_CENTS = OWED_PAYOUTS_CENTS + OWED_REFUNDS_CENTS;

describe('the platform balance reconciliation (VEN-644)', () => {
  let harness: TestHarness;

  function reconcile(now: Date = NOW): ReturnType<typeof reconcilePlatformBalance> {
    return reconcilePlatformBalance(
      {
        db: harness.database.db,
        stripe: harness.stripe,
        alerts: harness.app.operatorAlerts,
        log: harness.app.log,
      },
      now,
    );
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => clockNow });
  });

  beforeEach(async () => {
    const db = harness.database.db;
    const [customer] = await db
      .insert(users)
      .values({
        authUserId: 'user_balance_customer',
        email: 'balance-customer@example.com',
        role: 'customer',
        firstName: 'Casey',
        lastName: 'Rivera',
      })
      .returning({ id: users.id });
    const [owner] = await db
      .insert(users)
      .values({
        authUserId: 'user_balance_vendor',
        email: 'balance-vendor@example.com',
        role: 'vendor',
        firstName: 'Wren',
        lastName: 'Field',
      })
      .returning({ id: users.id });
    const [vendor] = await db
      .insert(vendorProfiles)
      .values({ userId: owner!.id, businessName: 'Wren & Field', slug: 'wren-field-balance' })
      .returning({ id: vendorProfiles.id });

    const booking = async (
      eventDate: string,
      values: Omit<
        typeof bookings.$inferInsert,
        'requestId' | 'customerId' | 'vendorId' | 'eventDate' | 'platformFeeCents'
      >,
    ): Promise<string> => {
      const [request] = await db
        .insert(bookingRequests)
        .values({ customerId: customer!.id, vendorId: vendor!.id, eventDate, status: 'accepted' })
        .returning({ id: bookingRequests.id });
      const [row] = await db
        .insert(bookings)
        .values({
          requestId: request!.id,
          customerId: customer!.id,
          vendorId: vendor!.id,
          eventDate,
          platformFeeCents: values.totalAmountCents - values.vendorPayoutCents,
          paidAt: NOW,
          ...values,
        })
        .returning({ id: bookings.id });
      return row!.id;
    };

    await booking('2026-11-01', {
      payoutModel: 'separate',
      totalAmountCents: 100_000,
      vendorPayoutCents: 88_000,
    });
    await booking('2026-11-02', {
      payoutModel: 'separate',
      status: 'cancelled',
      totalAmountCents: 50_000,
      vendorPayoutCents: 22_000,
      refundAmountCents: 25_000,
    });
    await booking('2026-11-03', {
      payoutModel: 'separate',
      totalAmountCents: 20_000,
      vendorPayoutCents: 17_600,
      externalRefundCents: 5_000,
    });
    await booking('2026-08-01', {
      payoutModel: 'separate',
      status: 'completed',
      totalAmountCents: 30_000,
      vendorPayoutCents: 26_400,
      payoutReleasedAt: NOW,
    });
    await booking('2026-05-01', {
      payoutModel: 'separate',
      status: 'completed',
      totalAmountCents: 60_000,
      vendorPayoutCents: 52_800,
      payoutReleasedAt: PAST_THE_CHARGEBACK_WINDOW,
    });
    const chargedBack = await booking('2026-11-05', {
      payoutModel: 'separate',
      status: 'disputed',
      totalAmountCents: 40_000,
      vendorPayoutCents: 35_200,
    });
    await db.insert(supportCases).values({
      reference: 'ORL-CB0001',
      origin: 'chargeback',
      message: 'A card network opened a dispute.',
      bookingId: chargedBack,
    });
    await booking('2026-11-04', {
      payoutModel: 'destination',
      totalAmountCents: 40_000,
      vendorPayoutCents: 35_200,
    });
  });

  afterEach(async () => {
    const db = harness.database.db;
    await db.delete(operatorAlerts);
    await db.delete(supportCases);
    await db.delete(bookings);
    await db.delete(bookingRequests);
    await db.delete(vendorProfiles);
    await db.delete(users);
    harness.email.sent.length = 0;
    harness.stripe.platformBalance = { availableCents: 0, pendingCents: 0 };
    clockNow = NOW;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('says nothing when available plus pending covers exactly what is owed', async () => {
    harness.stripe.platformBalance = {
      availableCents: 100_000,
      pendingCents: REQUIRED_CENTS - 100_000,
    };

    expect(await reconcile()).toEqual({
      balanceCents: REQUIRED_CENTS,
      requiredCents: 137_420,
      alert: null,
    });
    expect(harness.email.sent).toEqual([]);
    expect(await harness.database.db.select().from(operatorAlerts)).toEqual([]);
  });

  it('alerts the operator once a day when the balance is a cent short', async () => {
    harness.stripe.platformBalance = {
      availableCents: 100_000,
      pendingCents: REQUIRED_CENTS - 100_001,
    };

    expect(await reconcile()).toEqual({
      balanceCents: 137_419,
      requiredCents: 137_420,
      alert: 'sent',
    });
    expect(harness.email.sent).toHaveLength(1);
    expect(harness.email.sent[0]).toMatchObject({
      to: TEST_ENV.OPERATOR_ALERT_EMAIL,
      subject: expect.stringContaining('The platform balance is $0.01 short of what it owes'),
    });
    expect(harness.email.sent[0]!.text).toContain(
      'Stripe holds $1,374.19 ($1,000 available, $374.19 pending) against $1,374.20 still owed.',
    );
    expect(harness.email.sent[0]!.text).toContain(
      'Owed: $1,276 in vendor payouts not yet sent, and $98.20 more that bookings could still refund.',
    );
    expect(
      await harness.database.db
        .select({ kind: operatorAlerts.kind, subjectId: operatorAlerts.subjectId })
        .from(operatorAlerts),
    ).toEqual([{ kind: 'platform_balance_short', subjectId: '2026-09-23' }]);

    clockNow = LATER_THAT_DAY;
    expect((await reconcile(LATER_THAT_DAY)).alert).toBe('deduplicated');
    expect(harness.email.sent).toHaveLength(1);

    clockNow = NEXT_DAY;
    expect((await reconcile(NEXT_DAY)).alert).toBe('sent');
    expect(harness.email.sent).toHaveLength(2);
  });

  /*
   * The open chargeback case seeded above sits on a $400 disputed booking that
   * owes its $352 payout and $30.10 of refundable commission. The network's
   * outcome decides whether the platform's balance must cover it again.
   */
  const CHARGED_BACK_CENTS = 35_200 + 3_010;

  it.each([
    { outcome: null, counted: false },
    { outcome: 'needs_response', counted: false },
    { outcome: 'lost', counted: false },
    { outcome: 'won', counted: true },
    { outcome: 'warning_closed', counted: true },
    { outcome: 'warning_needs_response', counted: true },
    { outcome: 'warning_under_review', counted: true },
  ])(
    'counts a booking with an open chargeback only when the outcome is $outcome → $counted',
    async ({ outcome, counted }) => {
      await harness.database.db
        .update(supportCases)
        .set({ networkOutcome: outcome })
        .where(eq(supportCases.reference, 'ORL-CB0001'));
      harness.stripe.platformBalance = { availableCents: 1_000_000, pendingCents: 0 };

      const result = await reconcile();

      expect(result.requiredCents).toBe(REQUIRED_CENTS + (counted ? CHARGED_BACK_CENTS : 0));
    },
  );
});
