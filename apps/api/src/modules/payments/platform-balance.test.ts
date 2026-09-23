import {
  bookingRequests,
  bookings,
  operatorAlerts,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, TEST_ENV, type TestHarness } from '../../testing/test-server.js';
import { reconcilePlatformBalance } from './platform-balance.service.js';

const NOW = new Date('2026-09-23T09:00:00Z');
const LATER_THAT_DAY = new Date('2026-09-23T21:00:00Z');
const PAST_THE_CHARGEBACK_WINDOW = new Date('2026-05-25T09:00:00Z');

/*
 * What the fixtures below owe, worked by hand:
 * - confirmed, unreleased: its $880.00 payout plus the $120.00 rest of its total
 * - cancelled at 50%, unreleased: its $220.00 residual payout, nothing refundable
 * - confirmed, unreleased, $50.00 refunded at Stripe: its $176.00 payout, and no
 *   more than the $150.00 left, which the payout already covers
 * - released today: nothing to the vendor, but its $36.00 commission could still
 *   be charged back
 * - released 121 days ago, and a legacy destination charge: nothing
 */
const OWED_PAYOUTS_CENTS = 88_000 + 22_000 + 17_600;
const OWED_REFUNDS_CENTS = 12_000 + 3_600;
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
    harness = await createTestHarness({});
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
    ): Promise<void> => {
      const [request] = await db
        .insert(bookingRequests)
        .values({ customerId: customer!.id, vendorId: vendor!.id, eventDate, status: 'accepted' })
        .returning({ id: bookingRequests.id });
      await db.insert(bookings).values({
        requestId: request!.id,
        customerId: customer!.id,
        vendorId: vendor!.id,
        eventDate,
        platformFeeCents: values.totalAmountCents - values.vendorPayoutCents,
        paidAt: NOW,
        ...values,
      });
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
    await booking('2026-11-04', {
      payoutModel: 'destination',
      totalAmountCents: 40_000,
      vendorPayoutCents: 35_200,
    });
  });

  afterEach(async () => {
    const db = harness.database.db;
    await db.delete(operatorAlerts);
    await db.delete(bookings);
    await db.delete(bookingRequests);
    await db.delete(vendorProfiles);
    await db.delete(users);
    harness.email.sent.length = 0;
    harness.stripe.platformBalance = { availableCents: 0, pendingCents: 0 };
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
      requiredCents: 143_200,
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
      balanceCents: 143_199,
      requiredCents: 143_200,
      alert: 'sent',
    });
    expect(harness.email.sent).toHaveLength(1);
    expect(harness.email.sent[0]).toMatchObject({
      to: TEST_ENV.OPERATOR_ALERT_EMAIL,
      subject: expect.stringContaining('The platform balance is $0.01 short of what it owes'),
    });
    expect(harness.email.sent[0]!.text).toContain(
      'Stripe holds $1,431.99 ($1,000 available, $431.99 pending) against $1,432 still owed.',
    );
    expect(harness.email.sent[0]!.text).toContain(
      'Owed: $1,276 in vendor payouts not yet sent, and $156 more that bookings could still refund.',
    );
    expect(
      await harness.database.db
        .select({ kind: operatorAlerts.kind, subjectId: operatorAlerts.subjectId })
        .from(operatorAlerts),
    ).toEqual([{ kind: 'platform_balance_short', subjectId: '2026-09-23' }]);

    expect((await reconcile(LATER_THAT_DAY)).alert).toBe('deduplicated');
    expect(harness.email.sent).toHaveLength(1);
  });
});
