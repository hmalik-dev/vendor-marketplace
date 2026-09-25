import {
  BACKUP_WITHHOLDING_RATE_BPS,
  backupWithholdingCents,
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
import { payoutFailedAlert, type AdminAlerts } from '../admin-alerts/admin-alerts.service.js';
import { findVendorUserId } from '../booking-requests/booking-requests.dao.js';
import { notifyVendorUser, PAYOUT_NOTICES, type NotifyDeps } from '../notifications/notify-user.js';
import { readPlatformSwitchesUncached } from '../platform-settings/platform-settings.service.js';
import { findBookingById } from './payments.dao.js';
import {
  applyDebtRecovery,
  claimReleasableBooking,
  planDebtRecovery,
  findDuePayoutBookingIds,
  findBackupWithholdingSetter,
  recordBackupWithholdingWithheld,
  recordPayoutFailure,
  recordPayoutRelease,
} from './payouts.dao.js';
import { announceExternalRefund, externalRefundReason } from './refund-reconciliation.js';
import { recordExternalRefund, type ExternalRefundFinding } from './refunds.dao.js';

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

export const PAYOUT_AGREEMENT_MISSING_REASON =
  'The vendor has not accepted the vendor agreement yet, so the transfer could not be made';

export interface PayoutContext {
  db: AppDatabase;
  stripe: StripeConnectGateway;
  log: FastifyBaseLogger;
  /**
   * Where a payout that keeps failing is reported (VEN-405). The scheduled
   * sweep passes it; an admin's own retry does not, because the admin is
   * already looking at the result.
   */
  alerts?: Pick<AdminAlerts, 'dispatch'>;
  /** How the vendor is told a payout went out (VEN-525). Absent in a suite that does not read the bell. */
  notify?: NotifyDeps;
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
  const result: PayoutSweepResult = { released: 0, skipped: 0, failed: 0 };

  if (await payoutReleasePaused(context)) {
    return result;
  }

  const ids = await findDuePayoutBookingIds(context.db, dueThroughDate, RELEASE_BATCH_SIZE);

  for (const bookingId of ids) {
    /*
     * Re-read before every booking rather than once per sweep (VEN-404), so a
     * pause flipped mid-sweep stops the very next transfer. Everything not yet
     * reached stays due and goes out on the first sweep after the unpause.
     */
    if (await payoutReleasePaused(context)) {
      break;
    }

    const outcome = await releaseOnePayout(context, bookingId, dueThroughDate, now, {
      honourVendorHold: true,
    });
    result[outcome] += 1;
  }

  if (result.released > 0 || result.failed > 0) {
    context.log.info({ ...result, dueThroughDate }, 'Payout sweep finished');
  }

  return result;
}

async function payoutReleasePaused(context: PayoutContext): Promise<boolean> {
  return (await readPlatformSwitchesUncached(context.db)).payoutReleasePaused;
}

/**
 * What one admin-driven retry did, and the payout state it left behind.
 *
 * The refreshed row travels back with the outcome so the console can redraw the
 * row it acted on without a second request — and, more importantly, so the
 * admin is told the **new** failure reason rather than the one they were
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
 * Retries one stuck payout on an admin's say-so, through the **sweep's own
 * path** rather than a second transfer implementation (#432).
 *
 * The sweep already retries every fifteen minutes, so this buys the admin an
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
 * it would replay that cached failure for 24 hours and the admin would learn
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

  /*
   * Neither the platform pause nor a vendor hold applies here (VEN-404): this
   * is the admin releasing one payout by hand, which is what both exist to
   * make the only way money moves.
   */
  const outcome = await releaseOnePayout(context, bookingId, dueThroughDate, now, {
    honourVendorHold: false,
  });
  const after = await findBookingById(context.db, bookingId);

  if (!after) {
    throw notFound('No booking with that id');
  }

  return {
    /*
     * A `skipped` claim means a concurrent sweep holds the row lock — it is
     * neither a refusal nor a failure, and telling the admin "that failed"
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
 * Refusing rather than quietly returning "nothing happened": the admin
 * pressed a button on a row they believed was stuck, and the one thing they
 * must not be handed is a no-op that reads like a retry.
 *
 * **`cancelled` is refused even though the sweep releases it.** A cancellation
 * inside D3's window leaves the vendor a residual the sweep still pays on the
 * original schedule (D31), so no money is stranded by this refusal — the
 * fifteen-minute sweep keeps working the row. What is withheld is the admin
 * *forcing* it on the one status where the amount owed was rewritten after the
 * fact, and the message says that rather than implying nothing is owed.
 */
function refusePayoutRetry(subject: BookingRow, dueThroughDate: string): void {
  /*
   * `payoutStatusOf` for the first two, rather than `payoutReleasedAt` and
   * `status === 'disputed'` read by hand. That function's own comment forbids
   * the literal: `HELD_PAYOUT_STATUSES` is what the vendor dashboard and the
   * booking report test membership in, and a hold status added there but read
   * as an equality here would leave the admin retry refusing on a set the
   * rest of the product no longer agrees with.
   */
  const payoutStatus = payoutStatusOf(subject);

  if (payoutStatus === 'released') {
    throw conflict('This payout was already released.');
  }

  if (payoutStatus === 'held') {
    throw conflict('This payout is on hold while the reported problem is being resolved');
  }

  if (subject.status === 'cancelled') {
    throw conflict(
      'This booking was canceled. The scheduled sweep releases anything the vendor is still owed.',
    );
  }

  if (subject.payoutModel !== 'separate') {
    throw conflict('The vendor was paid when the card succeeded. No transfer is owed.');
  }

  if (subject.vendorPayoutCents <= 0) {
    throw conflict('Nothing is owed to the vendor on this booking');
  }

  if (subject.eventDate > dueThroughDate) {
    throw conflict(
      `This payout is not due yet. It is released ${PAYOUT_RELEASE_HOURS} hours after the event.`,
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
  options: { honourVendorHold: boolean },
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
  let owedCents = 0;
  let releasedVendorId: string | null = null;
  /** Refunds made outside the platform that this claim found; told to the admin once the transaction has committed. */
  const findings: ExternalRefundFinding[] = [];

  const outcome = await context.db.transaction(async (tx) => {
    const booking = await claimReleasableBooking(tx, bookingId, dueThroughDate);

    /*
     * The hold is re-read under the lock too: one set between the id scan and
     * this claim must still win over the sweep.
     */
    if (!booking || (options.honourVendorHold && booking.vendorPayoutHold)) {
      return 'skipped';
    }

    owedCents = booking.vendorPayoutCents;

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

    /*
     * No acceptance row at all (VEN-509): money is not released to a vendor who
     * never agreed to the commission and payout terms. A failure like the one
     * above, so the sweep keeps retrying and it self-heals on acceptance. Only
     * *no* row holds it; captured money under an older version is owed under it.
     */
    if (!booking.vendorHasAcceptedAgreement) {
      failure = PAYOUT_AGREEMENT_MISSING_REASON;
      context.log.warn({ bookingId, vendorId: booking.vendorId }, 'Payout held: no agreement');

      return 'failed';
    }

    /*
     * Asked of Stripe before the money moves (VEN-469). The `charge.refunded`
     * reconciliation is inert until the endpoint subscribes to it and cannot
     * recover a delivery that never came, so the claim looks for itself: a
     * booking refunded in the Dashboard would otherwise be paid its full vendor
     * share. A refund found here is recorded and held under the row lock this
     * transaction already holds, and the sweep leaves the booking alone.
     *
     * A failed read is a failed attempt like any other Stripe error below —
     * paying out on a refund state nobody could read is the mistake.
     */
    let external: ExternalRefundFinding | null = null;

    if (booking.stripePaymentIntentId) {
      try {
        const found = await context.stripe.findRefund(booking.stripePaymentIntentId);

        external = found
          ? await recordExternalRefund(tx, bookingId, found, externalRefundReason)
          : null;
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
        context.log.error({ bookingId, err: error }, 'Could not read the charge before a payout');

        return 'failed';
      }
    }

    if (external) {
      findings.push(external);

      /*
       * Not transferred on this run whether or not the booking could be held: a
       * cancelled booking cannot be, but paying the residual in the same
       * transaction that found the refund would send the money the alert says
       * is being looked at.
       */
      return 'skipped';
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
      const existing = await context.stripe.findTransfer(transferGroup, { live: true });

      /*
       * Backup withholding comes off the vendor's share first (VEN-723, D49): it
       * is owed to the IRS, so debts are recovered from what is left, never
       * from that money. Read from the claimed row, and computed by the one
       * function the vendor's dashboard shows it with.
       *
       * A transfer found under the group carries what its own attempt withheld,
       * stamped on it, and that is what is recorded: today's setting may have
       * moved since, and neither clearing it nor switching it on rewrites a
       * payment already made.
       */
      const backupCents = existing
        ? Math.min(existing.backupWithheldCents ?? 0, booking.vendorPayoutCents)
        : booking.vendorBackupWithholding
          ? backupWithholdingCents(booking.vendorPayoutCents)
          : 0;
      const payableCents = booking.vendorPayoutCents - backupCents;
      /* Before any money moves: a withholding nobody can be named for fails the payout, not the audit. */
      const withholdingActorId =
        backupCents > 0 ? await findBackupWithholdingSetter(tx, booking.vendorId) : null;

      /*
       * What the vendor owes from lost chargebacks is kept back from this
       * payout (VEN-658), oldest debt first, and whatever is left carries to
       * the next. A transfer found under the group was already sent for a
       * netted amount, so the recovery follows what Stripe holds rather than
       * being planned again; planned either way, it is only written after the
       * transfer stands, so a failed transfer recovers nothing.
       *
       * The idempotency key is per attempt and the amount can differ between
       * attempts when a debt appears in between. That is safe: `findTransfer`
       * catches the retry of a transfer that landed, and a request Stripe
       * refuses for a changed amount is a failure that increments the attempt.
       */
      /* What a found transfer already withheld is a fact to record, not a plan to redo against today's debts. */
      const withheldCents = existing
        ? Math.max(payableCents - (existing.amountCents - existing.reversedCents), 0)
        : 0;
      const recovery = await planDebtRecovery(
        tx,
        booking.vendorId,
        existing ? withheldCents : payableCents,
      );
      const plannedCents = recovery.reduce((sum, item) => sum + item.cents, 0);

      if (existing && plannedCents < withheldCents) {
        context.log.warn(
          { bookingId, withheldCents, plannedCents },
          'A transfer withheld more than the vendor now owes; the difference is recorded as netted',
        );
      }

      const nettedCents = existing ? withheldCents : plannedCents;
      const sendCents = payableCents - nettedCents;

      const transfer =
        existing ??
        (sendCents > 0
          ? await context.stripe.createTransfer({
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
               * The stored figure less the debt recovered, never a freshly computed
               * fee. The rate in force when the card succeeded is already written to
               * this row, and recomputing the split at release time would silently
               * reprice every unreleased booking the moment `STRIPE_PLATFORM_FEE_RATE`
               * changed.
               */
              amountCents: sendCents,
              destinationAccountId: booking.vendorStripeAccountId,
              transferGroup,
              backupWithheldCents: backupCents,
            })
          : null);

      /*
       * A transfer found under the group was made for the obligation as it
       * stood then. If the booking was cancelled since (the 50% tier), what the
       * vendor holds net of reversals exceeds what is owed now, so the surplus
       * is clawed back before the release is recorded — otherwise the full
       * share is booked as the release of a half-share.
       */
      const surplusCents = existing
        ? existing.amountCents - existing.reversedCents - payableCents
        : 0;

      if (existing && surplusCents > 0) {
        context.log.warn(
          { bookingId, transferId: existing.transferId, surplusCents },
          'Found a transfer larger than what is owed; reversing the surplus',
        );
        await context.stripe.reverseTransfer({
          transferId: existing.transferId,
          amountCents: surplusCents,
          idempotencyKey: `release_${bookingId}_surplus_${booking.payoutAttempts}`,
        });
      }

      await applyDebtRecovery(tx, recovery);
      await recordPayoutRelease(tx, bookingId, {
        stripeTransferId: transfer?.transferId ?? null,
        releasedAt: now,
        debtNettedCents: nettedCents,
        backupWithheldCents: backupCents,
      });

      if (withholdingActorId !== null) {
        await recordBackupWithholdingWithheld(tx, {
          actorId: withholdingActorId,
          bookingId,
          vendorId: booking.vendorId,
          cents: backupCents,
          rateBps: BACKUP_WITHHOLDING_RATE_BPS,
          at: now,
        });
      }

      releasedVendorId = booking.vendorId;

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

  if (releasedVendorId !== null && context.notify) {
    await announcePayout(context.notify, releasedVendorId, bookingId);
  }

  for (const finding of findings) {
    announceExternalRefund(context.alerts, bookingId, finding);
  }

  if (failure !== null) {
    /*
     * Its own failure is not allowed to abandon the sweep either — a booking
     * whose attempt could not even be recorded is retried next run exactly as
     * one whose attempt was.
     */
    try {
      const attempts = await recordPayoutFailure(context.db, bookingId, failure);
      const alert = payoutFailedAlert({
        bookingId,
        attempts,
        amountCents: owedCents,
        reason: failure,
      });

      if (alert) {
        context.alerts?.dispatch(alert);
      }
    } catch (error) {
      context.log.error({ bookingId, err: error }, 'Could not record a failed payout attempt');
    }
  }

  return outcome;
}

/** After the release has committed, so a notice that fails cannot un-send the money. */
async function announcePayout(
  notify: NotifyDeps,
  vendorId: string,
  bookingId: string,
): Promise<void> {
  try {
    const userId = await findVendorUserId(notify.mail.db, vendorId);

    if (userId) {
      await notifyVendorUser(notify, userId, { ...PAYOUT_NOTICES.sent, data: { bookingId } });
    }
  } catch (error) {
    // The transfer is committed; a lookup that fails here must not abandon the sweep.
    notify.mail.log.error({ bookingId, err: error }, 'Could not tell the vendor about a payout');
  }
}
