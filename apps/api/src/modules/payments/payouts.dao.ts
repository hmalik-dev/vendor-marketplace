import { and, asc, eq, gt, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { bookings, vendorProfiles } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

/**
 * Statuses a payout may be released from.
 *
 * **`completed` is in the list and that is the whole point** (#423). The vendor
 * is the party who benefits from pressing `Mark complete`, so it evidences
 * nothing about whether the event happened — a vendor who never presses it
 * would strand the money with no owner, and a vendor who presses it early must
 * not be paid early either. The button moves a status and nothing else; the
 * date decides. Both sides of it are therefore releasable, and the release
 * predicate below is the one place in the codebase where that is enforced.
 *
 * **`cancelled` is in it too, and only `vendor_payout_cents > 0` separates the
 * two cases.** A cancellation inside D3's 48-hour cutoff refunds half and
 * leaves the vendor the same proportion of their share (D31) — money they are
 * owed for a date they held and lost. Under the destination charge that share
 * was already in their balance; here it is still Orla's to send, so the
 * cancellation writes the residual down and the sweep pays it on the original
 * schedule. A full refund writes `0`, and a zero payout is excluded by the
 * predicate rather than by the status.
 *
 * `disputed` is the one exclusion: it is the hold.
 */
export const RELEASABLE_STATUSES = ['confirmed', 'completed', 'cancelled'] as const;

/**
 * What makes a payout **owed**, as clauses — everything except the status list
 * and the date bound.
 *
 * The three of them were written out by hand in three places before #424: both
 * queries below, and the vendor dashboard's own read of the same rows. Three
 * hand-synced copies of a money predicate is how the figure a vendor is shown
 * comes to name a different set of rows than the transfer does, and that
 * divergence is silent — nothing fails, the number is simply wrong. Composing
 * them from here is what makes the dashboard's reconciliation structural rather
 * than a test that happens to pass today.
 *
 * The status list is **not** in here, because the two callers legitimately
 * differ: the sweep releases `RELEASABLE_STATUSES` and the dashboard also has
 * to report `HELD_PAYOUT_STATUSES` as held. Folding the difference in would
 * make this a predicate neither caller actually wants.
 *
 * - `payout_released_at is null` — the money has not been sent.
 * - `payout_model = 'separate'` — a destination charge split the money as the
 *   card succeeded, so the vendor already holds their share.
 * - `vendor_payout_cents > 0` — under D37 a full refund writes `0`, and a zero
 *   payout is excluded by the amount rather than by the status.
 */
export function payoutOwedClauses(): SQL[] {
  return [
    isNull(bookings.payoutReleasedAt),
    eq(bookings.payoutModel, 'separate'),
    gt(bookings.vendorPayoutCents, 0),
  ];
}

/**
 * A transfer that has been **tried and has not landed** — the operator's
 * question, as clauses (#432).
 *
 * The SQL twin of `isPayoutFailing`, and here rather than in the console
 * because this is where payout predicates live: `payoutOwedClauses` is its
 * neighbour, and a rule about payouts written in the admin DAO is a special
 * case beside shared infrastructure rather than in it. Both readers compose
 * this one expression — the Payments filter and the Overview's count — so the
 * number on the card and the rows behind it cannot name different sets, which
 * is the single failure this ticket exists to close.
 *
 * Exactly the two columns `isPayoutFailing` reads, and deliberately **not**
 * `payoutOwedClauses` plus an attempt count: those add `payout_model` and
 * `vendor_payout_cents`, which no row with an attempt on it can fail today —
 * so folding them in would make the SQL and the TypeScript two rules that
 * happen to agree rather than one rule stated twice.
 */
export function payoutFailingClauses(): SQL[] {
  return [isNull(bookings.payoutReleasedAt), gt(bookings.payoutAttempts, 0)];
}

/**
 * A booking that is owed its transfer, with the account the money goes to.
 *
 * The vendor's payout account travels with the row because the transfer cannot
 * be made without it and must be refused without the onboarding flag — asking
 * separately would leave a window where the answer changed between the reads,
 * on the one path that moves money out of the platform's balance.
 */
export interface ReleasableBookingRow {
  id: string;
  requestId: string;
  vendorId: string;
  eventDate: string;
  vendorPayoutCents: number;
  /** How many times the transfer has already failed — part of the Stripe key. */
  payoutAttempts: number;
  vendorStripeAccountId: string | null;
  vendorStripeOnboarded: boolean;
}

/**
 * The ids of every booking whose payout has come due, oldest event first.
 *
 * Ids only. The rows are re-read one at a time under `FOR UPDATE SKIP LOCKED`
 * in `claimReleasableBooking`, because anything read here is a snapshot that a
 * concurrent sweep — or a cancellation, or a dispute — may have invalidated by
 * the time this one reaches it. Two sweeps overlapping is the expected case,
 * not the exceptional one: every API instance runs the timer.
 *
 * The date bound is computed from `payoutReleaseAt` in application code rather
 * than in SQL. `event_date` is a `DATE` and the release window is expressed in
 * whole days plus hours, so the honest predicate is "which dates are due", and
 * deriving the cut-off date once here keeps the arithmetic in the one shared
 * helper every surface reads instead of duplicating it as an interval literal.
 */
export async function findDuePayoutBookingIds(
  db: AppDatabase,
  /** The latest event date whose payout window has closed, inclusive. */
  dueThroughDate: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, [...RELEASABLE_STATUSES]),
        ...payoutOwedClauses(),
        lte(bookings.eventDate, dueThroughDate),
      ),
    )
    /*
     * Fewest failures first, then oldest event.
     *
     * `event_date` alone would let a hundred permanently stuck payouts — vendors
     * whose Connect account lost the `transfers` capability, say — occupy the
     * whole batch on every run, oldest first, so no healthy payout behind them
     * is ever attempted. Silently, and forever, because a failure leaves the row
     * releasable by design. Ordering by attempts first keeps a stuck row being
     * retried without letting it starve the queue.
     */
    .orderBy(asc(bookings.payoutAttempts), asc(bookings.eventDate))
    .limit(limit);

  return rows.map((row) => row.id);
}

/**
 * Takes the row lock on one due booking, re-checking the predicate under it.
 *
 * `FOR UPDATE SKIP LOCKED` rather than a plain `FOR UPDATE`: a second sweep
 * that finds this booking already claimed must move on to the next one, not
 * queue behind a transaction holding a network call to Stripe open. Skipping is
 * also what makes the idempotency acceptance provable by **call count** — the
 * second sweep issues no transfer at all rather than issuing one that Stripe
 * dedupes.
 *
 * Returns `null` when the booking is locked elsewhere, or when it no longer
 * satisfies the predicate: a cancellation or a dispute that committed between
 * the id scan and this read has to win, and it does, because this read happens
 * inside the lock.
 */
export async function claimReleasableBooking(
  tx: AppDatabase,
  bookingId: string,
  dueThroughDate: string,
): Promise<ReleasableBookingRow | null> {
  /*
   * The lock is taken on `bookings` alone. `for(..., { of })` names the table
   * whose rows are locked, because a join would otherwise take a lock on
   * `vendor_profiles` too — every sweep would then serialise against any
   * profile edit by the same vendor, for no gain.
   */
  const rows = await tx
    .select({
      id: bookings.id,
      requestId: bookings.requestId,
      vendorId: bookings.vendorId,
      eventDate: bookings.eventDate,
      vendorPayoutCents: bookings.vendorPayoutCents,
      payoutAttempts: bookings.payoutAttempts,
      vendorStripeAccountId: vendorProfiles.stripeAccountId,
      vendorStripeOnboarded: vendorProfiles.stripeOnboarded,
    })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(bookings.vendorId, vendorProfiles.id))
    .where(
      and(
        eq(bookings.id, bookingId),
        inArray(bookings.status, [...RELEASABLE_STATUSES]),
        ...payoutOwedClauses(),
        lte(bookings.eventDate, dueThroughDate),
      ),
    )
    .for('update', { of: bookings, skipLocked: true })
    .limit(1);

  return rows?.[0] ?? null;
}

/** Records the transfer that moved this payout, and clears any prior failure. */
export async function recordPayoutRelease(
  tx: AppDatabase,
  bookingId: string,
  release: { stripeTransferId: string; releasedAt: Date },
): Promise<void> {
  await tx
    .update(bookings)
    .set({
      stripeTransferId: release.stripeTransferId,
      payoutReleasedAt: release.releasedAt,
      payoutFailureReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(bookings.id, bookingId));
}

/**
 * Records a transfer that did not happen, leaving the booking releasable.
 *
 * Written inside the same transaction that holds the row lock, so the attempt
 * is durable even though the transfer is not — a failure the sweep forgot would
 * be indistinguishable from a payout nobody had reached yet, which is the state
 * #423 acceptance 7 exists to forbid.
 */
export async function recordPayoutFailure(
  tx: AppDatabase,
  bookingId: string,
  reason: string,
): Promise<void> {
  await tx
    .update(bookings)
    .set({
      payoutAttempts: sql`${bookings.payoutAttempts} + 1`,
      payoutFailureReason: reason,
      updatedAt: sql`now()`,
    })
    .where(eq(bookings.id, bookingId));
}

/*
 * The dispute hold and its release are **not** written here. Both are
 * `applyBookingTransition` in `payments.dao.ts`, which is the same guarded
 * `update … where id = ? and status = from … returning` plus the
 * `refreshCustomerBookingCounts` call that has to travel in the transaction
 * with it. Writing them separately looked tidier and quietly made this the
 * fourth and fifth booking writer that skipped the counter refresh: moving a
 * `completed` booking to `disputed` and back would have left the customer's
 * completed-bookings figure stale until some unrelated booking of theirs moved.
 */
