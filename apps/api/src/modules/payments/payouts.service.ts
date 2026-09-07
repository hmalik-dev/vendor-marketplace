import { payoutDueThroughDate } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import type { FastifyBaseLogger } from 'fastify';
import { transferGroupFor, type StripeConnectGateway } from '../../lib/stripe.js';
import {
  claimReleasableBooking,
  findDuePayoutBookingIds,
  recordPayoutFailure,
  recordPayoutRelease,
} from './payouts.dao.js';

/**
 * How many due payouts one sweep will attempt.
 *
 * A ceiling rather than "all of them", because the sweep runs on a timer with
 * no supervision: a backlog built up by an outage must be worked through over
 * several runs instead of opening one long transaction chain against a pool
 * sized for request traffic. Nothing is lost — the next run picks up where this
 * one stopped, oldest event first.
 */
const RELEASE_BATCH_SIZE = 100;

export interface PayoutContext {
  db: AppDatabase;
  stripe: StripeConnectGateway;
  log: FastifyBaseLogger;
}

/** What one sweep did, for the log line and for the tests to assert on. */
export interface PayoutSweepResult {
  /** Bookings whose transfer went out on this run. */
  released: number;
  /** Bookings a concurrent sweep had already claimed, or that stopped being due. */
  skipped: number;
  /** Bookings whose transfer failed and which remain releasable. */
  failed: number;
}

/**
 * Transfers the vendor's share for every booking whose event is far enough
 * behind us, and does nothing else (#423).
 *
 * **Safe to run twice, and it has to be**, because every API instance runs the
 * timer and a deploy overlaps two of them. Three separate things make that
 * true, and none of them alone is enough:
 *
 * 1. `FOR UPDATE SKIP LOCKED` on the claim. A second sweep reaching the same
 *    booking moves on rather than queueing, so it issues **no transfer at all**
 *    — which is what makes the idempotency provable by call count instead of by
 *    the row's end state.
 * 2. The predicate is re-read inside that lock. A cancellation or a dispute
 *    that committed between the id scan and the claim wins.
 * 3. `payout_${bookingId}` as the Stripe idempotency key, and `findTransfer`
 *    before sending. The transfer goes out inside the transaction that claims
 *    the booking, so a commit that never lands leaves the money moved and the
 *    row unchanged; the key catches that retry for a day and the lookup catches
 *    it forever.
 *
 * One booking at a time, deliberately. The set is a rolling handful, each item
 * holds a row lock across a network call, and money is the wrong place to buy
 * throughput with concurrency.
 */
export async function releaseDuePayouts(
  context: PayoutContext,
  now: Date,
): Promise<PayoutSweepResult> {
  const dueThroughDate = payoutDueThroughDate(now);
  const ids = await findDuePayoutBookingIds(context.db, dueThroughDate, RELEASE_BATCH_SIZE);

  const result: PayoutSweepResult = { released: 0, skipped: 0, failed: 0 };

  for (const bookingId of ids) {
    const outcome = await releaseOnePayout(context, bookingId, dueThroughDate, now);
    result[outcome] += 1;
  }

  if (result.released > 0 || result.failed > 0) {
    context.log.info({ ...result, dueThroughDate }, 'Payout sweep finished');
  }

  return result;
}

/**
 * One booking, claimed and released or left releasable, in one transaction.
 *
 * The Stripe call is inside the transaction on purpose. It is the only
 * arrangement in which a second sweep cannot reach the same booking while the
 * transfer is in flight, and the failure it costs — a transfer that succeeded
 * under a transaction that never committed — is the one `findTransfer` repairs
 * on the next run. The other way round, releasing the lock first, produces two
 * transfers that only Stripe's 24-hour key would catch.
 */
async function releaseOnePayout(
  context: PayoutContext,
  bookingId: string,
  dueThroughDate: string,
  now: Date,
): Promise<keyof PayoutSweepResult> {
  return context.db.transaction(async (tx) => {
    const booking = await claimReleasableBooking(tx, bookingId, dueThroughDate);

    if (!booking) {
      return 'skipped';
    }

    /*
     * A vendor whose account is not able to receive a transfer is a failure and
     * not a skip: the money is genuinely stuck, the row has to say so, and the
     * sweep must keep retrying so it self-heals the moment they finish
     * onboarding. Recording it as "nothing to do" would leave a payout that
     * never moves and never complains.
     */
    if (!booking.vendorStripeOnboarded || !booking.vendorStripeAccountId) {
      await recordPayoutFailure(
        tx,
        bookingId,
        'The vendor is not set up to receive payouts yet, so the transfer could not be made',
      );
      context.log.warn(
        { bookingId, vendorId: booking.vendorId },
        'Payout held: vendor not onboarded',
      );

      return 'failed';
    }

    const transferGroup = transferGroupFor(booking.requestId);

    try {
      /*
       * Asked before told, the same guard `cancelBooking` applies to refunds.
       * A transfer that reached Stripe under a transaction that then failed to
       * commit is invisible on this row, and past the 24-hour idempotency
       * window the retry would be a second transfer of the vendor's whole
       * share out of the platform's balance.
       */
      const existing = await context.stripe.findTransfer(transferGroup);

      const transfer =
        existing ??
        (await context.stripe.createTransfer({
          bookingId,
          /*
           * The attempt this is, so a retry is a new request at Stripe rather
           * than a replay of the last failure. Read from the row, which is
           * where the count durably lives — a rolled-back transaction never
           * incremented it, so the one case that *must* replay (a transfer that
           * reached Stripe under a commit that did not land) still does.
           */
          attempt: booking.payoutAttempts,
          /*
           * The stored figure, never a freshly computed fee. The rate in force
           * when the card succeeded is already written to this row, and
           * recomputing the split at release time would silently reprice every
           * unreleased booking the moment `STRIPE_PLATFORM_FEE_RATE` changed.
           */
          amountCents: booking.vendorPayoutCents,
          destinationAccountId: booking.vendorStripeAccountId,
          transferGroup,
        }));

      await recordPayoutRelease(tx, bookingId, {
        stripeTransferId: transfer.transferId,
        releasedAt: now,
      });

      return 'released';
    } catch (error) {
      /*
       * Caught rather than thrown, so the *failure record* commits under the
       * lock this transaction is holding. Rethrowing would roll the attempt
       * back with it and leave the booking indistinguishable from one nobody
       * has reached — and a payout failing silently every quarter of an hour
       * forever is the state acceptance 7 exists to forbid.
       *
       * One failure must not abandon the rest of the sweep either, which is why
       * this does not escape to `releaseDuePayouts`.
       */
      const reason = error instanceof Error ? error.message : String(error);
      await recordPayoutFailure(tx, bookingId, reason);
      context.log.error({ bookingId, err: error }, 'Payout transfer failed and will be retried');

      return 'failed';
    }
  });
}
