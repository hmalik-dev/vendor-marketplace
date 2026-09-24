import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  not,
  notInArray,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';
import {
  bookings,
  legalAcceptances,
  supportCases,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  HELD_PAYOUT_STATUSES,
  REFUND_EXPOSURE_AFTER_RELEASE_DAYS,
  STRIPE_FEE_ALLOWANCE_BPS,
  STRIPE_FEE_ALLOWANCE_FIXED_CENTS,
  type LegalAcceptanceDocument,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/** Typed so a renamed enum member is a compile error, not an `EXISTS` that matches nothing. */
const VENDOR_AGREEMENT: LegalAcceptanceDocument = 'vendor_agreement';

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
 * A cancelled booking's residual that must not be sent while the platform has
 * been refunded-against or charged back beyond what its own cancellation
 * recorded (VEN-543), as one SQL expression.
 *
 * `disputed` is the hold for a booking still `confirmed` or `completed`, and
 * `placeDisputeHold` and `recordExternalRefund` both refuse a `cancelled` one,
 * so neither can freeze the residual: the sweep skipped it once and paid it on
 * the next tick, while the customer held the money back. A hold that is a
 * **fact on the row** survives every tick, and both facts already are one:
 *
 * - `external_refund_cents > 0` — a refund made at Stripe outside the platform,
 *   written only by `recordExternalRefund`.
 * - an `open` chargeback case on the booking. It stays open until an admin
 *   rules, so resolving it is what lifts the hold; the sweep then pays.
 *
 * Not folded into `payoutOwedClauses`: the vendor dashboard selects owed rows
 * with those clauses and must still see a held one to report it. It composes
 * this expression instead, as a column, and the sweep negates it, so the two
 * cannot name different sets.
 */
export function payoutResidualHeld(): SQL<boolean> {
  /*
   * Every column is written with its table. In a single-table select Drizzle
   * drops the qualifier, and inside the subquery an unqualified `status` is
   * `support_cases.status` — the dashboard's grouped read would compare the
   * wrong column and 500 on the ambiguity it created.
   */
  function qualified(table: SQLWrapper, column: { name: string }): SQL {
    return sql`${table}.${sql.identifier(column.name)}`;
  }

  return sql<boolean>`(${qualified(bookings, bookings.status)} = 'cancelled' and (
    ${qualified(bookings, bookings.externalRefundCents)} > 0
    or exists (
      select 1 from ${supportCases}
      where ${qualified(supportCases, supportCases.bookingId)} = ${qualified(bookings, bookings.id)}
        and ${qualified(supportCases, supportCases.origin)} = 'chargeback'
        and ${qualified(supportCases, supportCases.status)} = 'open'
    )
  ))`;
}

/**
 * Chargeback outcomes under which the network is **not** holding the platform's
 * money: a won dispute returned it, and an inquiry (`warning_*`) never debited
 * it. Anything else — `lost`, `needs_response`, `under_review`, or no outcome
 * yet — counts as held, so a status Stripe adds later fails closed.
 */
export const DISPUTE_FUNDS_NOT_HELD: readonly string[] = [
  'won',
  'warning_closed',
  'warning_needs_response',
  'warning_under_review',
];

/** The outcomes under which an admin may close a chargeback case and release its payout. */
export const DISPUTE_RESOLVABLE_OUTCOMES: readonly string[] = ['won', 'warning_closed'];

/**
 * A vendor's owner can no longer be paid at all (VEN-569): banned or closed,
 * **and** no working connected Stripe account left to send a transfer to.
 *
 * Both facts, not `is_banned`/`deleted_at` alone — a ban or closure by itself
 * no longer stops a payout, so naming only that half here would be exactly the
 * hand-synced money predicate `payoutOwedClauses`'s own comment warns about.
 * `payoutFailingClauses` below and the admin DAOs' `vendorUnpayable` column
 * both compose this one expression, parameterised on the owner and profile
 * columns because the callers join them under different aliases (`users` here,
 * `vendorOwner` there).
 */
export function vendorUnpayableExpr(
  owner: { isBanned: SQLWrapper; deletedAt: SQLWrapper },
  profile: { stripeOnboarded: SQLWrapper; stripeAccountId: SQLWrapper },
): SQL<boolean> {
  return sql<boolean>`(
    (${owner.isBanned} or ${owner.deletedAt} is not null)
    and (not ${profile.stripeOnboarded} or ${profile.stripeAccountId} is null)
  )`;
}

/**
 * A booking the account-unwind owned and may not have finished (VEN-569).
 *
 * Banning or closing a vendor unwinds every **still-future** confirmed booking
 * by refunding it (`findConfirmedBookingsToUnwind`, `unwindAccountBookings`) —
 * and that refund can fail at Stripe. `account-unwind.ts`'s failure branch
 * alerts the admin and leaves the row exactly as it stood: `confirmed`,
 * fully owed, with nothing durable on it besides the transient alert. D41's
 * "a ban must not change money already earned for an event that happened"
 * holds for every row the unwind actually finished, or never owned in the
 * first place because its event was already past when the ban landed — it
 * does not hold for the one row the unwind **tried and failed** on, where the
 * event was still ahead of the ban and nothing says the customer ever
 * received the service.
 *
 * Comparing the event date against the moment of the ban or closure —
 * `users.banned_at`/`users.deleted_at`, both set atomically with the flag
 * (`setBanned`, `closeAccount`) — is what tells the two cases apart without a
 * new column: a booking already due when banned was never the unwind's
 * concern and is `false` here; one still ahead of the ban was, and stays
 * excluded until an admin resolves it by hand.
 */
export function unfinishedUnwindExpr(
  owner: { isBanned: SQLWrapper; bannedAt: SQLWrapper; deletedAt: SQLWrapper },
  eventDate: SQLWrapper,
): SQL<boolean> {
  return sql<boolean>`(
    (${owner.isBanned} and ${eventDate} > (${owner.bannedAt} at time zone 'UTC')::date)
    or (${owner.deletedAt} is not null and ${eventDate} > (${owner.deletedAt} at time zone 'UTC')::date)
  )`;
}

/**
 * A transfer this sweep still owes and has already tried — the admin's
 * question, as clauses (#432).
 *
 * The SQL twin of `isPayoutFailing`, and here rather than in the console
 * because this is where payout predicates live: `payoutOwedClauses` is its
 * neighbour, and a rule about payouts written in the admin DAO is a special
 * case laid beside shared infrastructure rather than into it. Both readers
 * compose this one expression — the Payments filter and the Overview's count —
 * so the number on the card and the rows behind it cannot name different sets.
 *
 * **`payoutOwedClauses` is half of it, and the half that is easy to drop.**
 * `payout_attempts > 0 and not released` reads like the whole answer and is
 * not: a booking whose transfer failed once and was then fully refunded has
 * `vendor_payout_cents` rewritten to `0` (D37), so this sweep will never work
 * it again — and it would sit in the admin's failing list for ever under an
 * alert promising that the scheduled release keeps trying. The status bound
 * does the same job for a dispute filed after a failed attempt: that row is
 * `held`, which is a different thing to tell an admin.
 */
export function payoutFailingClauses(): SQL[] {
  return [
    ...payoutOwedClauses(),
    gt(bookings.payoutAttempts, 0),
    notInArray(bookings.status, [...HELD_PAYOUT_STATUSES]),
    not(payoutResidualHeld()),
    /*
     * A truly unpayable owner is stranded, not failing (VEN-445, narrowed by
     * VEN-569): the sweep still selects and keeps retrying a merely banned or
     * closed vendor's due row, because a ban must not change money already
     * earned for an event that happened. Only `vendorUnpayableExpr` — closed
     * *and* no connected account — can never self-heal, so that is the one the
     * admin's failing list excludes; "the scheduled release keeps trying"
     * is still true of every other banned or closed row. A subquery, so the
     * count queries need no new join.
     */
    sql`not exists (
      select 1 from ${vendorProfiles}
      inner join ${users} on ${users.id} = ${vendorProfiles.userId}
      where ${vendorProfiles.id} = ${bookings.vendorId}
        and ${vendorUnpayableExpr(
          { isBanned: users.isBanned, deletedAt: users.deletedAt },
          {
            stripeOnboarded: vendorProfiles.stripeOnboarded,
            stripeAccountId: vendorProfiles.stripeAccountId,
          },
        )}
    )`,
  ];
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
  /** What the charge to look at for a refund made outside the platform (VEN-469). */
  stripePaymentIntentId: string | null;
  vendorStripeAccountId: string | null;
  vendorStripeOnboarded: boolean;
  /** An admin is holding this vendor's automatic payouts (VEN-404). */
  vendorPayoutHold: boolean;
  /** Whether the vendor has accepted any version of the vendor agreement (VEN-509). */
  vendorHasAcceptedAgreement: boolean;
}

/** The sweep's scan predicate: what is owed, releasable, unheld and past `dueThroughDate`. */
function duePayoutPredicate(dueThroughDate: string): SQL | undefined {
  return and(
    inArray(bookings.status, [...RELEASABLE_STATUSES]),
    ...payoutOwedClauses(),
    not(payoutResidualHeld()),
    lte(bookings.eventDate, dueThroughDate),
    eq(vendorProfiles.payoutHold, false),
    not(
      unfinishedUnwindExpr(
        { isBanned: users.isBanned, bannedAt: users.bannedAt, deletedAt: users.deletedAt },
        bookings.eventDate,
      ),
    ),
  );
}

/**
 * How many bookings the sweep would pick up for `dueThroughDate`, by the very
 * predicate `findDuePayoutBookingIds` scans with. The digest counts these for a
 * date one sweep interval old: whatever is still here then has been passed over
 * by every sweep since, which is a stopped or failing sweep, not a slow one.
 */
export async function countDuePayoutBookings(
  db: AppDatabase,
  dueThroughDate: string,
): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(bookings.vendorId, vendorProfiles.id))
    .innerJoin(users, eq(vendorProfiles.userId, users.id))
    .where(duePayoutPredicate(dueThroughDate));

  return rows[0]?.count ?? 0;
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
    /*
     * A held vendor's payouts are left out of the batch rather than claimed and
     * skipped (VEN-404), so a long hold cannot fill every batch and starve the
     * vendors behind it. They stay due and come back once the hold is lifted.
     *
     * A banned or closed vendor's owner is **not excluded outright** here
     * (VEN-569): a ban must not change money already earned for an event that
     * happened. The one row still excluded is `unfinishedUnwindExpr` — a
     * booking the account-unwind owned (its event was still ahead of the ban)
     * and may not have finished refunding, which must not be quietly paid to
     * the account it was trying to refund. Whether the account can actually
     * receive the transfer is decided inside the claim, not the scan.
     */
    .innerJoin(vendorProfiles, eq(bookings.vendorId, vendorProfiles.id))
    .innerJoin(users, eq(vendorProfiles.userId, users.id))
    .where(duePayoutPredicate(dueThroughDate))
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
    .orderBy(
      /*
       * Vendors who can receive a transfer come first (VEN-473). Ordering by
       * attempts alone still lets a payable booking that has failed a few times
       * sit behind more unpayable rows than one batch holds, because those rows
       * are tried fewer times than it was. An unonboarded vendor's rows stay in
       * the batch, at the back, so the sweep goes on recording why they are
       * stuck and picks them up the moment the vendor finishes onboarding.
       */
      desc(
        sql`(${vendorProfiles.stripeOnboarded} and ${vendorProfiles.stripeAccountId} is not null)`,
      ),
      asc(bookings.payoutAttempts),
      asc(bookings.eventDate),
    )
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
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      vendorStripeAccountId: vendorProfiles.stripeAccountId,
      vendorStripeOnboarded: vendorProfiles.stripeOnboarded,
      vendorPayoutHold: vendorProfiles.payoutHold,
      vendorHasAcceptedAgreement: sql<boolean>`EXISTS (
        SELECT 1 FROM ${legalAcceptances}
        WHERE ${legalAcceptances.acceptedByUserId} = ${vendorProfiles.userId}
          AND ${legalAcceptances.document} = ${VENDOR_AGREEMENT}
      )`,
    })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(bookings.vendorId, vendorProfiles.id))
    .innerJoin(users, eq(vendorProfiles.userId, users.id))
    .where(
      and(
        eq(bookings.id, bookingId),
        inArray(bookings.status, [...RELEASABLE_STATUSES]),
        ...payoutOwedClauses(),
        not(payoutResidualHeld()),
        lte(bookings.eventDate, dueThroughDate),
        /*
         * Re-read under the lock too, same as `findDuePayoutBookingIds`: a ban
         * or closure that committed after the id scan must still win.
         */
        not(
          unfinishedUnwindExpr(
            { isBanned: users.isBanned, bannedAt: users.bannedAt, deletedAt: users.deletedAt },
            bookings.eventDate,
          ),
        ),
      ),
    )
    .for('update', { of: bookings, skipLocked: true })
    .limit(1);

  return rows?.[0] ?? null;
}

/** One booking's share of a vendor's debt that a payout is about to recover. */
export interface DebtRecovery {
  bookingId: string;
  cents: number;
}

/**
 * Decides which of a vendor's outstanding debts a payout of `capCents` recovers
 * (VEN-658): oldest first, never more than the cap, never more than is owed.
 *
 * Reads only; the writes are `applyDebtRecovery`, called once the transfer has
 * succeeded, so a transfer that fails leaves every debt as it was. The rows are
 * locked `SKIP LOCKED` in id order, so two sweeps netting the same vendor's
 * debts cannot deadlock — the one that loses a row simply recovers less now and
 * the rest carries over.
 */
export async function planDebtRecovery(
  tx: AppDatabase,
  vendorId: string,
  capCents: number,
): Promise<DebtRecovery[]> {
  if (capCents <= 0) {
    return [];
  }

  const rows = await tx
    .select({
      id: bookings.id,
      outstandingCents: sql<number>`(${bookings.vendorOwedCents} - ${bookings.vendorOwedRecoveredCents})::int`,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        gt(bookings.vendorOwedCents, bookings.vendorOwedRecoveredCents),
      ),
    )
    .orderBy(asc(bookings.id))
    .for('update', { skipLocked: true });

  const plan: DebtRecovery[] = [];
  let remaining = capCents;

  for (const row of rows) {
    const cents = Math.min(row.outstandingCents, remaining);

    if (cents > 0) {
      plan.push({ bookingId: row.id, cents });
      remaining -= cents;
    }
  }

  return plan;
}

/** Writes a `planDebtRecovery` plan onto the debts it recovers. Same transaction as the release. */
export async function applyDebtRecovery(tx: AppDatabase, plan: DebtRecovery[]): Promise<void> {
  for (const { bookingId, cents } of plan) {
    await tx
      .update(bookings)
      .set({
        vendorOwedRecoveredCents: sql`${bookings.vendorOwedRecoveredCents} + ${cents}`,
        updatedAt: sql`now()`,
      })
      .where(eq(bookings.id, bookingId));
  }
}

/** A vendor's debt for lost chargebacks, and how much of it later payouts have recovered. */
export interface VendorDebtTotals {
  outstandingCents: number;
  recoveredCents: number;
}

export async function findVendorDebtTotals(
  db: AppDatabase,
  vendorId: string,
): Promise<VendorDebtTotals> {
  const rows = await db
    .select({
      owed: sql<number>`coalesce(sum(${bookings.vendorOwedCents}), 0)::int`,
      recovered: sql<number>`coalesce(sum(${bookings.vendorOwedRecoveredCents}), 0)::int`,
    })
    .from(bookings)
    .where(eq(bookings.vendorId, vendorId));
  const row = rows?.[0];

  return {
    outstandingCents: (row?.owed ?? 0) - (row?.recovered ?? 0),
    recoveredCents: row?.recovered ?? 0,
  };
}

/**
 * Records the transfer that moved this payout, and clears any prior failure.
 *
 * `stripeTransferId` is null when recovery consumed the whole payout, so no
 * transfer was made; the payout is released all the same.
 */
export async function recordPayoutRelease(
  tx: AppDatabase,
  bookingId: string,
  release: { stripeTransferId: string | null; releasedAt: Date; debtNettedCents: number },
): Promise<void> {
  await tx
    .update(bookings)
    .set({
      stripeTransferId: release.stripeTransferId,
      payoutReleasedAt: release.releasedAt,
      debtNettedCents: release.debtNettedCents,
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
): Promise<number> {
  const rows = await tx
    .update(bookings)
    .set({
      payoutAttempts: sql`${bookings.payoutAttempts} + 1`,
      payoutFailureReason: reason,
      updatedAt: sql`now()`,
    })
    .where(eq(bookings.id, bookingId))
    .returning({ payoutAttempts: bookings.payoutAttempts });

  // The count after this failure; 0 only if the booking vanished underneath.
  return rows[0]?.payoutAttempts ?? 0;
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

/** What the platform balance must still cover (VEN-644), in cents. */
export interface PlatformLiabilities {
  /** Vendors' shares not yet transferred: `payoutOwedClauses`' rows. */
  unreleasedPayoutCents: number;
  /**
   * What a live booking could still refund beyond the vendor's share: its
   * total, less what was already refunded and less that share. The share is
   * counted above while unreleased, and after release a refund takes it back
   * by reversing the transfer (D31), so only the commission part is the
   * platform's own. Released bookings count while a chargeback can still land
   * (`REFUND_EXPOSURE_AFTER_RELEASE_DAYS`); older commission is headroom.
   *
   * Net of the Stripe fee the charge already lost (`STRIPE_FEE_ALLOWANCE_*`):
   * the balance never held it, so counting it would read every booking as a
   * shortfall from the day it was paid.
   */
  refundableExposureCents: number;
}

/**
 * The money the platform holds for other people, read for the daily balance
 * reconciliation. Composes `payoutOwedClauses` so the figure owed to vendors
 * names exactly the rows the sweep will pay.
 *
 * A booking whose open chargeback the network still holds (no outcome,
 * `needs_response`, `under_review`, `lost`) is left out altogether. Stripe took
 * the disputed amount out of the balance when the dispute opened, and the row
 * records no amount for it, so counting the booking would ask the balance to
 * hold that money twice. A won dispute returned the funds and an inquiry never
 * debited them, so those bookings count again.
 */
export async function readPlatformLiabilities(
  db: AppDatabase,
  now: Date,
): Promise<PlatformLiabilities> {
  const exposureFrom = new Date(
    now.getTime() - REFUND_EXPOSURE_AFTER_RELEASE_DAYS * 24 * 60 * 60_000,
  );
  // Qualified by hand: Drizzle drops the table from a single-table select, and
  // an unqualified `id` inside the subquery would be `support_cases.id`.
  const bookingId = sql`${bookings}.${sql.identifier(bookings.id.name)}`;
  const rows = await db
    .select({
      unreleasedPayoutCents:
        sql<number>`coalesce(sum(${bookings.vendorPayoutCents}) filter (where ${and(...payoutOwedClauses())}), 0)`.mapWith(
          Number,
        ),
      refundableExposureCents:
        sql<number>`coalesce(sum(greatest(${bookings.totalAmountCents} - coalesce(${bookings.refundAmountCents}, 0) - ${bookings.externalRefundCents} - ${bookings.vendorPayoutCents} - (${bookings.totalAmountCents} * ${STRIPE_FEE_ALLOWANCE_BPS}::integer / 10000 + ${STRIPE_FEE_ALLOWANCE_FIXED_CENTS}::integer), 0)) filter (where ${bookings.status} <> 'cancelled'), 0)`.mapWith(
          Number,
        ),
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.payoutModel, 'separate'),
        or(isNull(bookings.payoutReleasedAt), gte(bookings.payoutReleasedAt, exposureFrom)),
        sql`not exists (
          select 1 from ${supportCases}
          where ${supportCases.bookingId} = ${bookingId}
            and ${supportCases.origin} = 'chargeback'
            and ${supportCases.status} = 'open'
            and (
              ${supportCases.networkOutcome} is null
              or ${supportCases.networkOutcome} not in (${sql.join(
                DISPUTE_FUNDS_NOT_HELD.map((outcome) => sql`${outcome}`),
                sql`, `,
              )})
            )
        )`,
      ),
    );

  return rows[0] ?? { unreleasedPayoutCents: 0, refundableExposureCents: 0 };
}
