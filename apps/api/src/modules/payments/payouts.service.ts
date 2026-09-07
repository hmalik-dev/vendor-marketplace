import {
  isPayoutFailing,
  PAYOUT_RELEASE_HOURS,
  payoutDueThroughDate,
  payoutStatusOf,
  type PayoutStatus,
} from '@vendor-marketplace/shared';
import type { BookingRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import type { FastifyBaseLogger } from 'fastify';
import { conflict, notFound } from '../../lib/errors.js';
import { transferGroupFor, type StripeConnectGateway } from '../../lib/stripe.js';
import { findBookingById } from './payments.dao.js';
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
 * 3. `payout_${bookingId}_${attempt}` as the Stripe idempotency key, and
 *    `findTransfer` before sending. The transfer goes out inside the
 *    transaction that claims the booking, so a commit that never lands leaves
 *    the money moved and the row unchanged; the key catches that retry for a
 *    day and the lookup catches it forever.
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
 * What one operator-driven retry did, and the payout state it left behind.
 *
 * The refreshed row travels back with the outcome so the console can redraw the
 * row it acted on without a second request — and, more importantly, so the
 * operator is told the **new** failure reason rather than the one they were
 * looking at when they pressed the button.
 */
export interface PayoutRetryResult {
  outcome: 'released' | 'failed' | 'busy';
  /**
   * Derived here rather than by the caller, from the row this function just
   * re-read. A console that took the raw columns and applied its own reading
   * would be the fourth definition of "held" and the second of "failing", on
   * the one screen whose whole job is to agree with the sweep.
   */
  payoutStatus: PayoutStatus;
  payoutFailing: boolean;
  payoutAttempts: number;
  payoutFailureReason: string | null;
  payoutReleasedAt: Date | null;
  stripeTransferId: string | null;
}

/**
 * Retries one stuck payout on an operator's say-so, through the **sweep's own
 * path** rather than a second transfer implementation (#432).
 *
 * The sweep already retries every fifteen minutes, so this buys the operator an
 * answer *now* — did it work, and if not what does Stripe say today — rather
 * than a capability the platform lacked. That is also why it reuses
 * `releaseOnePayout` verbatim: a separate transfer call here would be a second
 * place for the transfer group, the fee split and the idempotency key to be
 * decided, and money is the worst place in the codebase to hold two opinions.
 *
 * **D36 is satisfied structurally, not by remembering it.** The key is
 * `payout_<bookingId>_<attempt>` and the attempt is read from the row inside
 * the claim; a failure increments that counter durably, so a retry necessarily
 * mints a different key from the one whose refusal Stripe has cached. Reusing
 * it would replay that cached failure for 24 hours and the operator would learn
 * nothing, which is the state the sweep itself was in before #423.
 */
export async function retryPayoutRelease(
  context: PayoutContext,
  bookingId: string,
  now: Date,
): Promise<PayoutRetryResult> {
  const dueThroughDate = payoutDueThroughDate(now);
  const subject = await findBookingById(context.db, bookingId);

  if (!subject) {
    throw notFound('No booking with that id');
  }

  refusePayoutRetry(subject, dueThroughDate);

  const outcome = await releaseOnePayout(context, bookingId, dueThroughDate, now);
  const after = await findBookingById(context.db, bookingId);

  if (!after) {
    throw notFound('No booking with that id');
  }

  return {
    /*
     * A `skipped` claim means a concurrent sweep holds the row lock — it is
     * neither a refusal nor a failure, and telling the operator "that failed"
     * would be false. `busy` is the honest third answer: nothing was attempted
     * here because something else is attempting it right now.
     */
    outcome: outcome === 'skipped' ? 'busy' : outcome,
    payoutStatus: payoutStatusOf(after),
    payoutFailing: isPayoutFailing(after),
    payoutAttempts: after.payoutAttempts,
    payoutFailureReason: after.payoutFailureReason,
    payoutReleasedAt: after.payoutReleasedAt,
    stripeTransferId: after.stripeTransferId,
  };
}

/**
 * The states a retry is refused from, most specific first, each saying which.
 *
 * Refusing rather than quietly returning "nothing happened": the operator
 * pressed a button on a row they believed was stuck, and the one thing they
 * must not be handed is a no-op that reads like a retry.
 *
 * **`cancelled` is refused even though the sweep releases it.** A cancellation
 * inside D3's window leaves the vendor a residual the sweep still pays on the
 * original schedule (D31), so no money is stranded by this refusal — the
 * fifteen-minute sweep keeps working the row. What is withheld is the operator
 * *forcing* it on the one status where the amount owed was rewritten after the
 * fact, and the message says that rather than implying nothing is owed.
 */
function refusePayoutRetry(subject: BookingRow, dueThroughDate: string): void {
  /*
   * `payoutStatusOf` for the first two, rather than `payoutReleasedAt` and
   * `status === 'disputed'` read by hand. That function's own comment forbids
   * the literal: `HELD_PAYOUT_STATUSES` is what the vendor dashboard and the
   * booking report test membership in, and a hold status added there but read
   * as an equality here would leave the operator retry refusing on a set the
   * rest of the product no longer agrees with.
   */
  const payoutStatus = payoutStatusOf(subject);

  if (payoutStatus === 'released') {
    throw conflict('This payout has already been released, so there is nothing to retry');
  }

  if (payoutStatus === 'held') {
    throw conflict('This payout is on hold while the reported problem is being resolved');
  }

  if (subject.status === 'cancelled') {
    throw conflict(
      'This booking was cancelled. Any residual the vendor is still owed is released by the ' +
        'scheduled sweep, not by hand',
    );
  }

  if (subject.payoutModel !== 'separate') {
    throw conflict(
      'The vendor was paid as the card succeeded on this booking, so no transfer is owed',
    );
  }

  if (subject.vendorPayoutCents <= 0) {
    throw conflict('Nothing is owed to the vendor on this booking');
  }

  if (subject.eventDate > dueThroughDate) {
    throw conflict(
      `This payout is not due yet — it is released ${PAYOUT_RELEASE_HOURS} hours after the event`,
    );
  }
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
  /*
   * The failure is recorded **after** the transaction rather than inside it.
   *
   * Writing it in place looked right and was not: if the write that *failed*
   * was `recordPayoutRelease` itself, the Postgres transaction is already
   * aborted, so the failure write throws `current transaction is aborted` —
   * which escapes the callback, escapes this function, and abandons every
   * remaining booking in the batch for the next quarter of an hour. That is the
   * exact outcome the catch block was written to prevent.
   */
  let failure: string | null = null;

  const outcome = await context.db.transaction(async (tx) => {
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
      failure =
        'The vendor is not set up to receive payouts yet, so the transfer could not be made';
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
       * Caught rather than thrown, so the attempt is recorded and the booking
       * is left releasable — a payout failing silently every quarter of an hour
       * forever is the state acceptance 7 exists to forbid. One failure must
       * not abandon the rest of the sweep either, which is why this does not
       * escape to `releaseDuePayouts`.
       */
      failure = error instanceof Error ? error.message : String(error);
      context.log.error({ bookingId, err: error }, 'Payout transfer failed and will be retried');

      return 'failed';
    }
  });

  if (failure !== null) {
    /*
     * Its own failure is not allowed to abandon the sweep either — a booking
     * whose attempt could not even be recorded is retried next run exactly as
     * one whose attempt was.
     */
    try {
      await recordPayoutFailure(context.db, bookingId, failure);
    } catch (error) {
      context.log.error({ bookingId, err: error }, 'Could not record a failed payout attempt');
    }
  }

  return outcome;
}
