import {
  bookingRequests,
  bookings,
  categories,
  supportCases,
  users,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The case queue's two concurrency guards, on a real Postgres (#431).
 *
 * **PGlite cannot prove either of them**, which is the whole reason this file
 * exists (`.claude/rules/db-schema.md`): it is a single connection, so each
 * transaction runs to completion before the next begins and two writes fired
 * with `Promise.all` never actually overlap. Delete
 * `insertSupportCase`'s `onConflictDoNothing` or `markCaseResolved`'s
 * `status = 'open'` predicate and the entire `pnpm test` suite stays green — the
 * serial replay test in `cases.routes.test.ts` passes on the read-then-write
 * check alone, and the serial second press passes because the first has already
 * committed.
 *
 * Both guards are money-adjacent. A double-opened chargeback is two cases and
 * two holds for one dispute; a case closed twice overwrites the record of which
 * operator ruled on somebody's payout.
 */
describe('the case queue under contention, against a real Postgres', () => {
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';
  const ADMIN = 'user_admin';
  const OTHER_ADMIN = 'user_admin_two';

  /** A past event, so `placeDisputeHold` will take the booking. */
  const EVENT_DATE = '2020-06-01';
  const TOTAL_CENTS = 145_000;
  const PAYMENT_INTENT_ID = 'pi_contention_case';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let bookingId: string;
  let customerId: string;

  async function signIn(clerkUserId: string, promoteToAdmin = false): Promise<string> {
    const response = await harness!.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(clerkUserId),
    });
    expect(response.statusCode).toBe(200);

    if (promoteToAdmin) {
      await harness!.database.db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.clerkUserId, clerkUserId));
    }

    const rows = await harness!.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    return rows[0]!.id;
  }

  /** One `charge.dispute.created` delivery, as Stripe makes it. */
  async function deliverChargeback(disputeId: string) {
    harness!.stripe.disputes.set(disputeId, {
      id: disputeId,
      status: 'needs_response',
      reason: 'fraudulent',
      amountCents: TOTAL_CENTS,
      paymentIntentId: PAYMENT_INTENT_ID,
    });
    harness!.stripe.nextEvent = {
      type: 'charge.dispute.created',
      accountId: disputeId,
      objectId: disputeId,
    };

    return harness!.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_contention', object: 'event' }),
    });
  }

  beforeAll(async () => {
    /*
     * Four connections, so two requests really can be in flight at once. That
     * is the entire point of the file: with one, the second waits and every
     * assertion below passes with the guards removed.
     */
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const [clerkUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
      [ADMIN, 'customer'],
      [OTHER_ADMIN, 'customer'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    await signIn(ADMIN, true);
    await signIn(OTHER_ADMIN, true);
    customerId = await signIn(CUSTOMER);

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photography!.id],
        city: 'Austin',
        state: 'TX',
      },
    });
    expect(profile.statusCode).toBe(201);
    const vendorProfileId: string = profile.json().id;

    const [request] = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendorProfileId,
        eventDate: EVENT_DATE,
        status: 'accepted',
        finalPriceCents: TOTAL_CENTS,
      })
      .returning({ id: bookingRequests.id });

    const [booking] = await harness.database.db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate: EVENT_DATE,
        totalAmountCents: TOTAL_CENTS,
        platformFeeCents: 17_400,
        vendorPayoutCents: 127_600,
        status: 'confirmed',
        paidAt: new Date('2020-05-01T00:00:00Z'),
        stripePaymentIntentId: PAYMENT_INTENT_ID,
      })
      .returning({ id: bookings.id });

    bookingId = booking!.id;
  });

  afterAll(async () => {
    /*
     * `harness.close()` owns the database it was handed, so closing it twice —
     * or reaching for a `drop` that is not on the type — is how this file ends
     * green tests with a red suite. Same shape as
     * `dispute-hold.contention.test.ts`, which is the file this one sits beside.
     */
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  it('opens one case and places one hold when a chargeback is delivered twice at once', async () => {
    /*
     * Two genuinely simultaneous deliveries of the same event — Stripe's
     * at-least-once delivery racing its own retry. `openChargebackCase` reads
     * `findCaseByStripeDisputeId` first, and on a real engine both reads answer
     * "no case" before either write lands.
     *
     * **Two guards then fire, at different depths, and which one catches the
     * loser depends on the interleaving.** This test exists to pin that the
     * answer is safe either way rather than to pin which:
     *
     * - the loser's `placeDisputeHold` finds the row already moved to
     *   `disputed` and raises `StaleBookingError` — a **409**, deliberately
     *   rethrown rather than filed as a refusal, so Stripe redelivers; or
     * - the hold is not where they collide, and `insertSupportCase`'s
     *   `onConflictDoNothing` on the unique `stripe_dispute_id` makes the second
     *   write a no-op answering `already-recorded` with **200**.
     *
     * What must never happen is two cases or two holds, and that is what is
     * asserted. PGlite cannot reach either branch: its single connection makes
     * the second request wait, so it always takes the ordinary replay path.
     */
    const [first, second] = await Promise.all([
      deliverChargeback('dp_contention_race'),
      deliverChargeback('dp_contention_race'),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses[0]).toBe(200);
    expect([200, 409]).toContain(statuses[1]);

    // Exactly one of them opened the case.
    const opened = [first, second].filter(
      (response) => response.statusCode === 200 && response.json().outcome === 'dispute-opened',
    );
    expect(opened).toHaveLength(1);

    const cases = await harness!.database.db
      .select({ id: supportCases.id })
      .from(supportCases)
      .where(eq(supportCases.stripeDisputeId, 'dp_contention_race'));
    expect(cases).toHaveLength(1);

    // And exactly one hold: the booking is `disputed` once, not held twice.
    const [row] = await harness!.database.db
      .select({ status: bookings.status, reason: bookings.disputeReason })
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    expect(row?.status).toBe('disputed');
    expect(row?.reason).toContain('dp_contention_race');

    /*
     * **And the 409 converges.** A retryable refusal is only correct if the
     * retry settles it — otherwise Stripe redelivers for three days against an
     * endpoint that keeps refusing. The redelivery finds the case and stops.
     */
    const retry = await deliverChargeback('dp_contention_race');
    expect(retry.statusCode).toBe(200);
    expect(retry.json().outcome).toBe('already-recorded');

    const afterRetry = await harness!.database.db
      .select({ id: supportCases.id })
      .from(supportCases)
      .where(eq(supportCases.stripeDisputeId, 'dp_contention_race'));
    expect(afterRetry).toHaveLength(1);
  });

  it('lets exactly one of two operators close the same case', async () => {
    /*
     * The other guard. `markCaseResolved`'s `UPDATE … WHERE status = 'open'` is
     * what makes the loser's `returning()` empty, so `resolveCase` answers 409
     * rather than overwriting the first operator's name and timestamp with the
     * second's. Read-then-act in the service would let both through here.
     *
     * A case with no booking, so neither press is refused for holding a payout.
     */
    const [row] = await harness!.database.db
      .insert(supportCases)
      .values({
        reference: 'ORL-RACE-99',
        origin: 'support_message',
        topic: 'something-else',
        message: 'Two operators are about to press this at the same moment.',
        senderUserId: customerId,
        senderEmail: `${CUSTOMER}@example.com`,
      })
      .returning({ id: supportCases.id });

    const close = async (actor: string) =>
      harness!.app.inject({
        method: 'PUT',
        url: `/admin/cases/${row!.id}/resolve`,
        headers: bearer(actor),
      });

    const [a, b] = await Promise.all([close(ADMIN), close(OTHER_ADMIN)]);

    const statuses = [a.statusCode, b.statusCode].sort();
    expect(statuses).toEqual([200, 409]);

    // One resolver on the row, and it is whichever one got the 200.
    const [closed] = await harness!.database.db
      .select({ status: supportCases.status, resolvedBy: supportCases.resolvedBy })
      .from(supportCases)
      .where(eq(supportCases.id, row!.id));

    expect(closed?.status).toBe('resolved');
    expect(closed?.resolvedBy).not.toBeNull();
  });
});
