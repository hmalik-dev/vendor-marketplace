import type { FastifyBaseLogger } from 'fastify';
import {
  addDays,
  generateSlug,
  isLegacyDestinationPayout,
  toDateString,
} from '@vendor-marketplace/shared';
import type {
  AdminActivityPage,
  AdminActivityQuery,
  AdminBanResult,
  AdminBookingPage,
  AdminBookingQuery,
  AdminCustomerPage,
  AdminCustomerQuery,
  AdminMetrics,
  AdminPaymentPage,
  AdminPaymentQuery,
  AdminReviewPage,
  AdminReviewQuery,
  AdminTagList,
  AdminTagRow,
  AdminTagSuggestionPage,
  AdminTagSuggestionQuery,
  AdminTagSuggestionResult,
  AdminTagSuggestionRow,
  AdminVendorFacets,
  AdminVendorPage,
  AdminVendorQuery,
  AdminVendorRow,
  AdminVendorStatus,
  Booking,
  DisputeOutcome,
  FieldErrorDetails,
  ResolveTagSuggestion,
  TagCategory,
  UpdateTag,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import type { EventHub } from '../../lib/event-stream.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import { conflict, forbidden, notFound, validationFailed } from '../../lib/errors.js';
import {
  queueNotificationEmail,
  type NotificationEmailDeps,
} from '../notifications/notification-email.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import { cancelBookingAndFreeDate } from '../payments/payments.dao.js';
import { deleteReviewAndRecalculate } from '../reviews/reviews.dao.js';
import { normalizeTagName } from '../tags/tags.service.js';
import { resolveDispute } from '../payments/payments.service.js';
import {
  assignTagToVendor,
  countAdminActions,
  countAdminBookings,
  countAdminCustomers,
  countAdminPayments,
  countAdminReviews,
  countAdminTagSuggestions,
  countAdminVendors,
  countVendorsHoldingTag,
  declineOpenRequests,
  findAdminActions,
  findAdminBookings,
  findAdminCustomers,
  findAdminMetricSeries,
  findAdminMetricTotals,
  findAdminPayments,
  findAdminReviews,
  findAdminTagSuggestionById,
  findAdminTagSuggestions,
  findAdminTags,
  findAdminVendors,
  findConfirmedBookingsToUnwind,
  findTagByCategoryAndName,
  findTagById,
  findTagBySlug,
  findTagSuggestionById,
  findUserById,
  findVendorFilterFacets,
  findVendorProfileByUserId,
  findVendorProfileIdByUserId,
  insertAdminAction,
  insertTag,
  resolveTagSuggestionRow,
  setBanned,
  updateTagRow,
  type AdminActionRecord,
  type AdminTagSuggestionProjection,
  type AdminVendorFilters,
  type AdminVendorProjection,
  type DailyBucket,
} from './admin.dao.js';

/**
 * The page window's offset.
 *
 * One line, six call sites. An off-by-one here silently repeats or skips a row
 * rather than failing, which makes it the most expensive one-line bug this file
 * can host — so it is written once.
 */
function offsetOf(query: { page: number; pageSize: number }): number {
  return (query.page - 1) * query.pageSize;
}

/** Everything an admin operation needs. Mirrors `PaymentContext`, for the same reason. */
export interface AdminContext {
  db: AppDatabase;
  stripe: StripeConnectGateway;
  hub: EventHub;
  log: FastifyBaseLogger;
  /**
   * Everything the transactional email needs.
   *
   * Carried on the context beside `hub` because the email *is* the
   * notification: an event that rings the bell and does not reach the inbox has
   * drifted, and threading them separately is how that happens.
   */
  mail: NotificationEmailDeps;
}

// --- The action log (#434) -------------------------------------------------

/**
 * Writes the audit row, and never lets it undo the work it records.
 *
 * **The rule, in one line: best-effort if and only if the operation has already
 * committed an irreversible effect outside Postgres. Otherwise the row rides
 * the transaction.**
 *
 * That is deliberately a test a future author can apply rather than a judgement
 * they have to make, and exactly two call sites meet it — `setUserBanned`'s ban
 * path, which has refunded cards through Stripe, and `resolveBookingDispute`,
 * which has moved the money one way or the other. Both would answer 500 on work
 * whose retry re-enters a half-applied state, so a failed audit write there is
 * loud in the logs and invisible to the caller. It is also the **last** thing
 * each of them does, so a row exists only where the change really happened.
 *
 * Every other writer — the unban, the review deletion, the three tag paths —
 * hands its own transaction to `insertAdminAction`, so the row and the change
 * it describes commit or roll back together and a failed log write leaves an
 * operation the operator can simply repeat.
 *
 * Built **on** `bestEffortNotice` rather than beside it. The two started as the
 * same try/catch-and-log body forty lines apart, which is precisely how #408's
 * rule became a special case the first time.
 */
async function recordAdminActionBestEffort(
  context: AdminContext,
  record: AdminActionRecord,
): Promise<void> {
  await bestEffortNotice(
    context,
    {
      actorId: record.actorId,
      action: record.action,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
    },
    () => insertAdminAction(context.db, record),
    'The admin operation succeeded but its action could not be logged',
  );
}

/**
 * The activity feed — "who did what, to whom, and when".
 *
 * Filtered by actor and by subject, which are the two questions it exists to
 * answer: "what has this operator been doing" and "what did the console do to
 * this account". Without the second it is a firehose rather than a record.
 */
export async function listActivity(
  db: AppDatabase,
  query: AdminActivityQuery,
): Promise<AdminActivityPage> {
  const offset = offsetOf(query);
  /* `AdminActivityQuery` already carries the three filter fields the DAO reads. */
  const [rows, total] = await Promise.all([
    findAdminActions(db, query, query.pageSize, offset),
    countAdminActions(db, query),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      actorName: fullName(row.actorFirstName, row.actorLastName),
      action: row.action,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      detail: row.detail,
      createdAt: row.createdAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * The four statuses, derived from the three columns that actually record state.
 *
 * Order matters and is the same order `statusCondition` filters in: a banned
 * vendor is `flagged` whatever their publish flag says, because the ban is the
 * fact an operator needs to see first.
 */
export function deriveVendorStatus(row: {
  isBanned: boolean;
  isPublished: boolean;
  stripeOnboarded: boolean;
}): AdminVendorStatus {
  if (row.isBanned) {
    return 'flagged';
  }

  if (row.isPublished) {
    return 'live';
  }

  return row.stripeOnboarded ? 'paused' : 'review';
}

function toVendorRow(row: AdminVendorProjection): AdminVendorRow {
  return {
    id: row.id,
    userId: row.userId,
    businessName: row.businessName,
    slug: row.slug,
    categoryName: row.categoryName,
    city: row.city,
    state: row.state,
    avgRating: row.avgRating,
    reviewCount: row.reviewCount,
    bookingsCount: row.bookingsCount,
    status: deriveVendorStatus(row),
    stripeOnboarded: row.stripeOnboarded,
    createdAt: row.createdAt,
  };
}

export async function listVendors(
  db: AppDatabase,
  query: AdminVendorQuery,
): Promise<AdminVendorPage> {
  const filters: AdminVendorFilters = {
    q: query.q,
    category: query.category,
    city: query.city,
    payouts: query.payouts,
    status: query.status,
  };
  const offset = offsetOf(query);

  /*
   * The counts run against the same filters as the page, so the count line can
   * never describe a different set from the rows under it. See
   * `countAdminVendors` for why `awaitingReview` ignores `status`.
   */
  const [rows, counts] = await Promise.all([
    findAdminVendors(db, filters, query.pageSize, offset),
    countAdminVendors(db, filters),
  ]);

  return {
    items: rows.map(toVendorRow),
    ...counts,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Bans or unbans an account.
 *
 * **A ban is not just a flag.** It has to leave the marketplace in a state where
 * nobody is waiting on an account that can no longer answer: open requests are
 * declined, future confirmed bookings are cancelled and refunded **in full**,
 * and a vendor's storefront comes down.
 *
 * The refund is deliberately full rather than D3's cancellation tiers. Those
 * tiers price a *customer's* change of mind. Here the platform is removing a
 * party from a transaction the other side did nothing wrong in, so charging
 * them a cancellation penalty for our moderation decision would be indefensible.
 *
 * Order is the same one `cancelBooking` argues for and for the same reason: the
 * money moves before the row does. A refund that succeeded against a booking
 * that then failed to update is recoverable; a cancelled booking whose refund
 * never happened tells someone their money is coming back when it is not.
 */
export async function setUserBanned(
  context: AdminContext,
  actorId: string,
  targetId: string,
  isBanned: boolean,
  now: Date,
): Promise<AdminBanResult> {
  if (actorId === targetId) {
    /*
     * 403 rather than 400: this is a refusal about who the caller is, not about
     * the shape of what they sent. An admin who could ban themselves could lock
     * the platform's only operator out of it, and nothing else could undo it.
     */
    throw forbidden('You cannot ban your own account');
  }

  const target = await findUserById(context.db, targetId);

  if (!target) {
    throw notFound('No account with that id');
  }

  if (target.isBanned === isBanned) {
    throw conflict(isBanned ? 'That account is already banned' : 'That account is not banned');
  }

  /*
   * The log line, kept beside the audit row rather than replaced by it.
   *
   * It used to be the whole record, and the comment here said so — "a log line
   * is not an audit table". It is one now (#434): the row this function writes
   * before it returns is what answers "which operator suspended this account",
   * queryably and for ever. This stays because the two answer different
   * questions — the row is the record, and this is what an operator greps while
   * a ban is still in flight, before any of the work below has committed.
   */
  context.log.info({ actorId, targetId, isBanned }, "Admin changed an account's ban state");

  const profile = await findVendorProfileByUserId(context.db, targetId);

  if (!isBanned) {
    /*
     * Unban is only the flag. The vendor republishes themselves — reinstating an
     * account is not the same as reinstating a listing, and the operator does not
     * decide when a vendor is ready to trade again.
     */
    /*
     * The unban and its audit row commit together.
     *
     * Nothing outside Postgres has happened on this path — no refund, no
     * cancellation, only the flag — so it does not meet the best-effort rule
     * above, and it should not use it. `setBanned` opens a transaction of its
     * own; passing this one in makes that a savepoint inside it, so a failed
     * audit write rolls the reinstatement back to a state the operator can
     * simply repeat, rather than leaving an account quietly unbanned with no
     * record of who did it.
     */
    const { profileUnpublished } = await context.db.transaction(async (tx) => {
      const result = await setBanned(tx, targetId, profile?.id ?? null, false, now);

      await insertAdminAction(tx, {
        actorId,
        action: 'user_unbanned',
        subjectType: 'user',
        subjectId: targetId,
        detail: { profileUnpublished: result.profileUnpublished },
      });

      return result;
    });

    return {
      userId: targetId,
      isBanned: false,
      requestsDeclined: 0,
      bookingsCancelled: 0,
      refundsIssued: 0,
      refundsFailed: 0,
      profileUnpublished,
    };
  }

  const today = toDateString(now);
  const affected = await findConfirmedBookingsToUnwind(
    context.db,
    targetId,
    profile?.id ?? null,
    today,
  );

  let refundsIssued = 0;
  let bookingsCancelled = 0;
  let refundsFailed = 0;

  for (const booking of affected) {
    /*
     * What actually came back, for the row to record (#415). `null` while no
     * refund has moved, which is both the unpaid booking and the one whose
     * refund the loop below is about to fail on.
     */
    let refundedCents: number | null = null;

    /*
     * A pre-#423 destination charge is refused here for the same reason
     * `refundAndUnwind` refuses it: Stripe split that charge as the card
     * succeeded, so the vendor already holds their share, and this path's
     * refund no longer carries `reverse_transfer` — it would return the
     * customer's money and claw back nothing.
     *
     * The old comment here reasoned that "a ban cannot reach a booking that has
     * been transferred" because it only unwinds *future* events. That is true
     * of the new model and false of the old one: `0028`'s backfill marks every
     * legacy row released regardless of its event date, so a legacy booking for
     * an event next month is exactly the row this loop selects.
     */
    if (isLegacyDestinationPayout(booking)) {
      context.log.error(
        { bookingId: booking.id },
        'Skipped a legacy destination-charge booking during a ban; it needs an operator refund',
      );
      refundsFailed += 1;
      continue;
    }

    if (booking.stripePaymentIntentId) {
      try {
        /*
         * Asked before told, for the same reason the customer's cancellation
         * asks: a key Stripe has forgotten is no guard at all, and a ban
         * re-issued a day after one that failed to cancel its bookings would
         * otherwise refund every one of them twice (D31).
         */
        const alreadyRefunded = await context.stripe.findRefund(booking.stripePaymentIntentId);

        if (!alreadyRefunded) {
          const refund = await context.stripe.createRefund({
            paymentIntentId: booking.stripePaymentIntentId,
            amountCents: booking.totalAmountCents,
            /*
             * One refund per booking, however many times a ban is issued. The
             * `isBanned` check above is a read and not a lock, so two concurrent
             * bans both reach this loop; without a key they would both refund.
             *
             * Versioned with the request: Stripe refuses a key replayed with
             * different parameters. D31 changed them once, and #423 changed
             * them again — the refund now carries neither `reverse_transfer`
             * nor `refund_application_fee`, because the charge is a plain one
             * into the platform balance. A ban re-issued within 24 hours of one
             * attempted under the old params would otherwise be refused with an
             * `idempotency_error` rather than refunded.
             *
             * There is deliberately no transfer reversal on this path. It only
             * ever unwinds bookings whose event date is still ahead
             * (`findConfirmedBookingsToUnwind`), and a payout is not released
             * until well after the event — so a ban cannot reach a booking that
             * has been transferred, and the money is all still Orla's to give
             * back.
             */
            idempotencyKey: `ban-refund:direct:${booking.id}`,
          });

          refundedCents = refund.amountCents;
        } else {
          /*
           * Read off the money that moved, not off the amount this call asked
           * for. They agree on every first attempt and part company on the one
           * that matters: a booking the customer had already half-refunded
           * through their own cancellation, whose row never moved, is found
           * here — and recording `totalAmountCents` for it would tell them
           * they got everything back when half of it never left Stripe.
           */
          refundedCents = alreadyRefunded.amountCents;
        }

        refundsIssued += 1;
      } catch (error) {
        /*
         * One failed refund must not abandon the rest of the ban. The account is
         * still removed, the remaining bookings are still unwound, and this one
         * is logged loudly because the money did not move and only a human can
         * finish it.
         */
        context.log.error(
          { bookingId: booking.id, err: error },
          'Refund failed while banning an account',
        );
        /*
         * Counted, not only logged (#400). The `continue` is right — a booking
         * whose money did not come back must not be cancelled underneath the
         * customer, and one failure must not abandon the rest of the ban — but
         * it leaves a **confirmed** booking on a suspended account with neither
         * party told, and the result used to have no field to say so. The
         * operator saw a clean success and a log line nobody was reading.
         */
        refundsFailed += 1;
        continue;
      }
    }

    const cancelled = await cancelBookingAndFreeDate(context.db, booking.id, {
      cancelledAt: now,
      cancellationReason: "The other party's account was suspended",
      /*
       * The column, not the sentence above it (#415). Both parties' screens
       * have to distinguish an operator's unwind from a customer's own
       * cancellation, and reading that off `cancellation_reason` would make
       * this string load-bearing copy.
       */
      cancelledBy: 'admin',
      refundAmountCents: refundedCents,
      /*
       * A ban refunds in **full**, so the vendor keeps nothing and the payout
       * sweep must never pay this booking out. Stating it rather than leaving
       * `vendor_payout_cents` at the figure settled at payment is what stops
       * the row staying releasable after the money went back to the customer.
       */
      vendorPayoutCents: 0,
      disputeReason: null,
    });

    if (!cancelled) {
      continue;
    }

    bookingsCancelled += 1;

    const recipients = [booking.customerId, booking.vendorUserId].filter(
      (id): id is string => typeof id === 'string' && id !== targetId,
    );

    /*
     * The body is per recipient, and per whether money actually moved.
     *
     * One string went to both sides claiming "your payment has been refunded in
     * full" — to the vendor, who did not pay but was about to be paid, and on
     * an unpaid booking, where no refund happened at all. Both are the product
     * telling somebody something untrue about their money.
     *
     * The vendor's line says *reversed*, not "no payout will follow" (D31). A
     * transfer already paid out is clawed back rather than withheld, and a
     * vendor whose balance is about to go negative learns it here.
     */
    const refunded = booking.stripePaymentIntentId !== null;

    for (const recipient of recipients) {
      await bestEffortNotice(
        context,
        { bookingId: booking.id, recipient },
        async () => {
          const body =
            recipient === booking.customerId
              ? refunded
                ? "The other party's account was suspended. Your payment has been refunded in full."
                : "The other party's account was suspended. Nothing was charged for this booking."
              : refunded
                ? "The customer's account was suspended and the booking was cancelled. Their payment has been refunded, and your share of it has been reversed out of your Stripe balance."
                : "The customer's account was suspended and the booking was cancelled. Nothing had been charged for it.";

          const stored = await insertNotification(context.db, {
            userId: recipient,
            type: 'booking_cancelled',
            title: 'A booking was cancelled',
            body,
            data: { bookingId: booking.id },
          });

          if (stored) {
            context.hub.publish(recipient, {
              type: 'new_notification',
              notification: {
                id: stored.id,
                type: stored.type,
                title: stored.title,
                body: stored.body,
                href: '/bookings',
                isRead: false,
                createdAt: stored.createdAt,
              },
            });

            /*
             * Per recipient, which is the point. One shared string here once told a
             * vendor their payment had been refunded — they had not paid, and on an
             * unpaid booking nothing was refunded at all. The email carries the
             * body written for *this* reader, so both parties read the same refund
             * figure and neither reads the other's.
             */
            queueNotificationEmail(
              context.mail,
              stored,
              recipient === booking.customerId ? 'customer' : 'vendor',
            );
          }
        },
        'The operation succeeded but its notification could not be recorded',
      );
    }
  }

  const requestsDeclined = await declineOpenRequests(
    context.db,
    targetId,
    profile?.id ?? null,
    now,
  );
  const { profileUnpublished } = await setBanned(
    context.db,
    targetId,
    profile?.id ?? null,
    true,
    now,
  );

  /*
   * Last, and best-effort. Everything above has already happened — cards
   * refunded, bookings cancelled, the account suspended — so a row exists only
   * where the ban really landed, and a database that refused the row must not
   * turn a completed ban into a 500 the operator would retry against a
   * half-applied one.
   *
   * `refundsFailed` is in the payload because it is the number that needs a
   * human (#400): a ban carrying one left money with Stripe and a booking still
   * standing, and the log is where that is found again later.
   */
  await recordAdminActionBestEffort(context, {
    actorId,
    action: 'user_banned',
    subjectType: 'user',
    subjectId: targetId,
    detail: {
      requestsDeclined,
      bookingsCancelled,
      refundsIssued,
      refundsFailed,
      profileUnpublished,
    },
  });

  return {
    userId: targetId,
    isBanned: true,
    requestsDeclined,
    bookingsCancelled,
    refundsIssued,
    refundsFailed,
    profileUnpublished,
  };
}

/**
 * An operator settles a reported problem, and the console records that they did.
 *
 * A thin wrapper over `payments.service.ts`'s `resolveDispute` rather than an
 * `actorId` parameter threaded into it, and the direction of the dependency is
 * the whole reason. The money is the payments module's to move and this is the
 * admin module's log; teaching `resolveDispute` to write an `admin_actions` row
 * would make `payments` import the admin DAO, which is backwards — a customer
 * cancelling a booking runs most of that same code and has no operator to
 * record. The actor stops here, where every caller is an operator by
 * construction.
 *
 * Best-effort logging, and this is the case that most needs it: by the time it
 * returns, either the hold has been lifted or the card has been refunded in
 * full. There is no retry that does either of those a second time safely.
 */
export async function resolveBookingDispute(
  context: AdminContext,
  actorId: string,
  bookingId: string,
  outcome: DisputeOutcome,
  now: Date,
): Promise<Booking> {
  const booking = await resolveDispute(context, bookingId, outcome, now);

  await recordAdminActionBestEffort(context, {
    actorId,
    action: 'dispute_resolved',
    subjectType: 'booking',
    subjectId: bookingId,
    /*
     * Which way it went, and the money that moved with it. `refundAmountCents`
     * is what an operator asks the log for later — "was this one refunded, and
     * how much" — and it is a figure the platform computed, not content a user
     * wrote.
     */
    detail: {
      outcome,
      status: booking.status,
      refundAmountCents: booking.refundAmountCents ?? null,
    },
  });

  return booking;
}

export async function listCustomers(
  db: AppDatabase,
  query: AdminCustomerQuery,
): Promise<AdminCustomerPage> {
  const offset = offsetOf(query);
  const [rows, total] = await Promise.all([
    findAdminCustomers(db, query.q, query.pageSize, offset),
    countAdminCustomers(db, query.q),
  ]);

  return { items: rows, total, page: query.page, pageSize: query.pageSize };
}

/** `First Last`, collapsed — the same shape every other admin surface prints. */
function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export async function listBookings(
  db: AppDatabase,
  query: AdminBookingQuery,
  now: Date,
): Promise<AdminBookingPage> {
  const offset = offsetOf(query);
  /*
   * The day, because `refund-stuck` mirrors the unwind's own `event_date`
   * bound (#415). Passed from the clock rather than read as `current_date` so
   * the filter answers the same question a test's fake clock asks.
   */
  const filters = { status: query.status, flag: query.flag, today: toDateString(now) };
  const [rows, total] = await Promise.all([
    findAdminBookings(db, filters, query.pageSize, offset),
    countAdminBookings(db, filters),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      status: row.status,
      eventDate: row.eventDate,
      totalCents: row.totalAmountCents,
      customerName: fullName(row.customerFirstName, row.customerLastName),
      vendorName: row.vendorName,
      vendorSlug: row.vendorSlug,
      refundStuck: row.refundStuck,
      createdAt: row.createdAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listPayments(
  db: AppDatabase,
  query: AdminPaymentQuery,
): Promise<AdminPaymentPage> {
  const offset = offsetOf(query);
  const [rows, total] = await Promise.all([
    findAdminPayments(db, query.pageSize, offset),
    countAdminPayments(db),
  ]);

  return {
    items: rows.map((row) => ({
      bookingId: row.id,
      status: row.status,
      totalAmountCents: row.totalAmountCents,
      platformFeeCents: row.platformFeeCents,
      vendorPayoutCents: row.vendorPayoutCents,
      stripePaymentIntentId: row.stripePaymentIntentId,
      vendorName: row.vendorName,
      customerName: fullName(row.customerFirstName, row.customerLastName),
      paidAt: row.paidAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listReviews(
  db: AppDatabase,
  query: AdminReviewQuery,
): Promise<AdminReviewPage> {
  const offset = offsetOf(query);
  const [rows, total] = await Promise.all([
    findAdminReviews(db, query.type, query.pageSize, offset),
    countAdminReviews(db, query.type),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      content: row.content,
      type: row.type,
      authorName: fullName(row.authorFirstName, row.authorLastName),
      vendorName: row.vendorName,
      vendorSlug: row.vendorSlug,
      createdAt: row.createdAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Deletes a review and re-derives the rating it contributed to.
 *
 * `deleteReviewAndRecalculate` is the reviews module's own write — reached from
 * here rather than reimplemented, because a second recompute is how the two come
 * to disagree. Deleting the last review leaves `0 / 0`, not `NULL`.
 */
export async function deleteReview(
  context: AdminContext,
  actorId: string,
  reviewId: string,
): Promise<void> {
  /*
   * The deletion and its audit row commit together.
   *
   * Nothing outside Postgres happens here, so the best-effort rule does not
   * apply — and this is the path where riding the transaction is worth the
   * most. A row deleted with no record of who deleted it is unrecoverable in
   * both directions: the review is gone and so is the reason. Rolling both back
   * leaves the operator a button that still works.
   *
   * `deleteReviewAndRecalculate` opens a transaction of its own to re-derive
   * the rating; passing this one in nests it as a savepoint, so the rating and
   * the audit row share the deletion's fate.
   *
   * The id and nothing else in `detail`. The review's text is exactly what a
   * moderation log must not keep a second copy of.
   */
  await context.db.transaction(async (tx) => {
    const deleted = await deleteReviewAndRecalculate(tx, reviewId);

    if (!deleted) {
      throw notFound('No review with that id');
    }

    await insertAdminAction(tx, {
      actorId,
      action: 'review_deleted',
      subjectType: 'review',
      subjectId: reviewId,
      detail: {},
    });
  });

  // Greppable while it happens; the row above is the record that survives.
  context.log.info({ actorId, reviewId }, 'Admin deleted a review');
}

// --- Tag moderation --------------------------------------------------------

function toSuggestionRow(row: AdminTagSuggestionProjection): AdminTagSuggestionRow {
  return {
    id: row.id,
    vendorId: row.vendorId,
    suggestedName: row.suggestedName,
    category: row.category,
    status: row.status,
    resolvedTagId: row.resolvedTagId,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    /*
     * The storefront name where there is one, the account name otherwise: a
     * suggestion can come from a vendor who has not built a profile yet, and
     * "· suggested by" with nothing after it is worse than the account name.
     */
    vendorName: row.vendorBusinessName ?? fullName(row.vendorFirstName, row.vendorLastName),
    resolvedTagName: row.resolvedTagName,
  };
}

export async function listTagSuggestions(
  db: AppDatabase,
  query: AdminTagSuggestionQuery,
): Promise<AdminTagSuggestionPage> {
  const offset = offsetOf(query);
  const [rows, total] = await Promise.all([
    findAdminTagSuggestions(db, query.status, query.pageSize, offset),
    countAdminTagSuggestions(db, query.status),
  ]);

  return {
    items: rows.map(toSuggestionRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * The tag vocabulary is category-scoped, so the slug is too — `tags_slug_key` is
 * global and "Korean" is legitimately both a language and a culture.
 */
function tagSlug(category: TagCategory, name: string): string {
  return `${category}-${generateSlug(name)}`;
}

/**
 * Runs a notification, and never lets it undo the work it announces.
 *
 * Both notification writes in this file follow work that has already
 * committed — `setUserBanned` has issued refunds through Stripe and cancelled
 * the bookings, `approveSuggestion`'s tag transaction has closed and the
 * suggestion is no longer `pending`. A throw at that point answered 500 on an
 * operation the operator cannot repeat: the retry re-enters a partly applied
 * ban, or finds a suggestion it can no longer resolve. Same rule as
 * `bestEffortAnnouncement` in the booking-request service and `bestEffortNotice`
 * in payments; #408 added it there and left these two, which is exactly how a
 * rule becomes a special case.
 *
 * The message became a parameter with #434, which gave this a second kind of
 * caller: the audit write follows the identical rule for a sharper reason, and
 * a second copy of this body — which is what it started as — would have been
 * the same drift again, one ticket later. It is the **last** parameter so the
 * two notification callers keep the shape they already had.
 */
async function bestEffortNotice(
  context: AdminContext,
  subject: Record<string, string>,
  work: () => Promise<void>,
  message: string,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    context.log.error({ ...subject, err: error }, message);
  }
}

async function notifyVendorOfTag(
  context: AdminContext,
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  await bestEffortNotice(
    context,
    { userId },
    async () => {
      const stored = await insertNotification(context.db, {
        userId,
        type: 'tag_suggestion_approved',
        title,
        body,
        data: {},
      });

      if (stored) {
        context.hub.publish(userId, {
          type: 'new_notification',
          notification: {
            id: stored.id,
            type: stored.type,
            title: stored.title,
            body: stored.body,
            href: '/vendor/profile/edit',
            isRead: false,
            createdAt: stored.createdAt,
          },
        });

        // Always the vendor: a tag suggestion is theirs, and so is the surface.
        queueNotificationEmail(context.mail, stored, 'vendor');
      }
    },
    'The operation succeeded but its notification could not be recorded',
  );
}

/**
 * Approve, reject or merge one suggestion.
 *
 * **Concurrency is settled by the write, not by the read.** The `status =
 * 'pending'` predicate lives on the UPDATE in `resolveTagSuggestionRow`, so two
 * operators acting on the same suggestion cannot both succeed however the reads
 * interleave — the second gets a 409 rather than overwriting the first's
 * decision. Checking the status here first only makes that failure legible; it
 * is not what makes it correct.
 */
export async function resolveTagSuggestion(
  context: AdminContext,
  actorId: string,
  suggestionId: string,
  input: ResolveTagSuggestion,
  now: Date,
): Promise<AdminTagSuggestionResult> {
  const suggestion = await findTagSuggestionById(context.db, suggestionId);

  if (!suggestion) {
    throw notFound('No tag suggestion with that id');
  }

  if (suggestion.status !== 'pending') {
    throw conflict('That suggestion has already been resolved');
  }

  const suggesterProfileId = await findVendorProfileIdByUserId(context.db, suggestion.vendorId);

  if (input.action === 'reject') {
    await context.db.transaction(async (tx) => {
      const resolved = await resolveTagSuggestionRow(tx, {
        suggestionId,
        status: 'rejected',
        resolvedTagId: null,
        adminNote: input.adminNote,
        resolvedAt: now,
      });

      if (!resolved) {
        /*
         * Another operator got there first. Throwing inside the transaction is
         * what keeps the audit row from recording a decision that did not
         * happen — the same reason the approve path below throws inside its own.
         */
        throw conflict('That suggestion has already been resolved');
      }

      await insertAdminAction(tx, {
        actorId,
        action: 'tag_suggestion_resolved',
        subjectType: 'tag_suggestion',
        subjectId: suggestionId,
        /*
         * The disposition, never the note. `adminNote` is free text an operator
         * typed and it is already stored on the suggestion itself; copying it
         * here would put user-supplied prose into the audit table for no reader
         * who cannot follow `subjectId` to the original.
         */
        detail: { outcome: 'rejected' },
      });
    });

    /*
     * No notification, by design. The queue records why; telling a vendor their
     * idea was turned down is how a product stops receiving suggestions.
     */
    return { suggestion: await readResolved(context.db, suggestionId), tag: null };
  }

  if (input.action === 'merge') {
    const target = await findTagById(context.db, input.mergeTagId);

    if (!target) {
      throw notFound('No tag with that id');
    }

    if (target.category !== suggestion.category) {
      /*
       * A merge across categories would file "Kosher" under languages. The
       * vocabulary is category-scoped and so is every reader of it.
       */
      throw validationFailed('That tag is in a different category', {
        field: 'mergeTagId',
      } satisfies FieldErrorDetails);
    }

    /*
     * Three writes, one transaction — the resolution, the vendor's new tag, and
     * the audit row. They were two loose statements before the log arrived, and
     * `.claude/rules/db-schema.md` asks for multi-statement mutations to be
     * atomic; a suggestion resolved without the tag it promised the vendor is
     * the failure that leaves behind.
     */
    await context.db.transaction(async (tx) => {
      const resolved = await resolveTagSuggestionRow(tx, {
        suggestionId,
        status: 'approved',
        resolvedTagId: target.id,
        adminNote: input.adminNote ?? `Merged with ${target.name}`,
        resolvedAt: now,
      });

      if (!resolved) {
        throw conflict('That suggestion has already been resolved');
      }

      if (suggesterProfileId) {
        await assignTagToVendor(tx, suggesterProfileId, target.id);
      }

      await insertAdminAction(tx, {
        actorId,
        action: 'tag_suggestion_resolved',
        subjectType: 'tag_suggestion',
        subjectId: suggestionId,
        detail: { outcome: 'merged', tagId: target.id },
      });
    });

    await notifyVendorOfTag(
      context,
      suggestion.vendorId,
      'Your tag suggestion matched an existing tag',
      `“${suggestion.suggestedName}” matched our existing tag “${target.name}” — it has been added to your profile.`,
    );

    return { suggestion: await readResolved(context.db, suggestionId), tag: target };
  }

  const normalized = normalizeTagName(suggestion.suggestedName);
  /*
   * Name match first, then slug. The ticket lists them the other way round, but
   * the slug is *derived from* the name — so checking it first would reject
   * every exact duplicate that step 3 says to merge, and step 3 would be
   * unreachable. Same-name is therefore treated as the merge it is; a slug
   * collision that survives this check is a *different* name that slugifies the
   * same ("Gluten Free" vs "gluten-free"), which is the case the operator has to
   * rule on rather than the machine.
   */
  const sameName = await findTagByCategoryAndName(context.db, suggestion.category, normalized);

  if (sameName) {
    return resolveTagSuggestion(
      context,
      actorId,
      suggestionId,
      /*
       * The note travels. Approving a duplicate is still a decision, and the
       * reasoning the operator typed is the only record of why it was made —
       * dropping it left the queue reading the machine's "Merged with X" and
       * nothing else.
       */
      {
        action: 'merge',
        mergeTagId: sameName.id,
        ...(input.adminNote ? { adminNote: input.adminNote } : {}),
      },
      now,
    );
  }

  const slug = tagSlug(suggestion.category, suggestion.suggestedName);
  const slugTaken = await findTagBySlug(context.db, slug);

  if (slugTaken) {
    throw conflict(`A similar tag already exists: ${slugTaken.name}. Merge into it instead.`);
  }

  const created = await context.db.transaction(async (tx) => {
    const tag = await insertTag(tx, {
      name: suggestion.suggestedName,
      slug,
      category: suggestion.category,
    });

    const resolved = await resolveTagSuggestionRow(tx, {
      suggestionId,
      status: 'approved',
      resolvedTagId: tag.id,
      adminNote: input.adminNote ?? null,
      resolvedAt: now,
    });

    if (!resolved) {
      /*
       * Another operator resolved it between the read and this write. Throwing
       * inside the transaction rolls the new tag back, which is the point: a
       * tag created for a decision that did not happen is orphaned vocabulary.
       */
      throw conflict('That suggestion has already been resolved');
    }

    if (suggesterProfileId) {
      await assignTagToVendor(tx, suggesterProfileId, tag.id);
    }

    await insertAdminAction(tx, {
      actorId,
      action: 'tag_suggestion_resolved',
      subjectType: 'tag_suggestion',
      subjectId: suggestionId,
      detail: { outcome: 'approved', tagId: tag.id },
    });

    return tag;
  });

  await notifyVendorOfTag(
    context,
    suggestion.vendorId,
    'Your tag suggestion was approved',
    `“${created.name}” is now available, and has been added to your profile.`,
  );

  return { suggestion: await readResolved(context.db, suggestionId), tag: created };
}

/** Re-reads the suggestion through the list projection, so the response and the queue agree. */
async function readResolved(db: AppDatabase, suggestionId: string): Promise<AdminTagSuggestionRow> {
  const row = await findAdminTagSuggestionById(db, suggestionId);

  if (!row) {
    throw notFound('No tag suggestion with that id');
  }

  return toSuggestionRow(row);
}

export async function listTags(db: AppDatabase): Promise<AdminTagList> {
  const rows = await findAdminTags(db);

  return { items: rows };
}

/**
 * Renames, reorders or deactivates one tag.
 *
 * A rename regenerates the slug, because the slug is the dedup key every
 * approval checks against — leaving it on the old name would let the same tag be
 * suggested and approved twice. Deactivation is a soft remove: `vendor_tags`
 * rows survive, so a vendor keeps what they chose while the tag stops being
 * offered and stops filtering search.
 */
export async function updateTag(
  context: AdminContext,
  actorId: string,
  tagId: string,
  input: UpdateTag,
): Promise<AdminTagRow> {
  const { db } = context;
  const existing = await findTagById(db, tagId);

  if (!existing) {
    throw notFound('No tag with that id');
  }

  const patch: { name?: string; slug?: string; isActive?: boolean; displayOrder?: number } = {};

  if (
    input.name !== undefined &&
    /*
     * Compared exactly, not through `normalizeTagName`. The normalised compare
     * skipped this whole block for a case-only edit — so renaming `gluten free`
     * to `Gluten Free` answered 200 and changed nothing, with no error to
     * explain it. The clash check now self-excludes instead, the way the slug
     * check below it already did.
     */
    input.name !== existing.name
  ) {
    const clash = await findTagByCategoryAndName(
      db,
      existing.category,
      normalizeTagName(input.name),
    );

    if (clash && clash.id !== tagId) {
      throw conflict(`A tag called ${clash.name} already exists in that category`);
    }

    const slug = tagSlug(existing.category, input.name);
    const slugClash = await findTagBySlug(db, slug);

    if (slugClash && slugClash.id !== tagId) {
      throw conflict(`A similar tag already exists: ${slugClash.name}`);
    }

    patch.name = input.name;
    patch.slug = slug;
  }

  if (input.isActive !== undefined) {
    patch.isActive = input.isActive;
  }

  if (input.displayOrder !== undefined) {
    patch.displayOrder = input.displayOrder;
  }

  if (Object.keys(patch).length === 0) {
    /*
     * Nothing changed, so nothing is logged — deliberately, and it is the one
     * place the log departs from "one row per successful mutating call".
     *
     * This branch answers 200 with the tag exactly as it already was: the
     * request named no field that reached `patch` — either nothing at all, or a
     * `name` identical to the one on the row, which is the only field that
     * self-excludes. Recording it would file a `tag_updated` row whose detail is
     * empty
     * and whose meaning is "an operator opened the rename box and pressed
     * save", which is noise in the one table whose value is that every row in
     * it means something happened.
     */
    return { ...existing, vendorCount: await countVendorsHoldingTag(db, tagId) };
  }

  /*
   * The change and its audit row commit together (#434).
   *
   * This one can afford the transaction where the ban and the dispute cannot:
   * nothing outside Postgres has moved, so a failed log write rolls the rename
   * back to a state the operator can simply retry — which is strictly better
   * than a renamed tag nobody is recorded as having renamed.
   *
   * The payload names what changed rather than restating the whole tag: `patch`
   * holds exactly the fields this call touched, and its values are the tag's own
   * vocabulary, never user-generated content from elsewhere.
   */
  const updated = await db.transaction(async (tx) => {
    const row = await updateTagRow(tx, tagId, patch);

    if (!row) {
      throw notFound('No tag with that id');
    }

    /*
     * Derived from `patch` rather than re-listed field by field, so a fourth
     * updatable tag field cannot be added and silently left out of the one
     * table whose value is that it records what changed.
     *
     * `slug` is dropped because it is derived from `name` and says nothing
     * `name` does not; `previousName` is added because "what it was" is the
     * half a diff needs and the row would otherwise only carry "what it is".
     */
    const { slug: _slug, ...changed } = patch;

    await insertAdminAction(tx, {
      actorId,
      action: 'tag_updated',
      subjectType: 'tag',
      subjectId: tagId,
      detail: {
        ...changed,
        ...(patch.name === undefined ? {} : { previousName: existing.name }),
      },
    });

    return row;
  });

  return { ...updated, vendorCount: await countVendorsHoldingTag(db, tagId) };
}

// --- Overview --------------------------------------------------------------

/** The window every chart on the Overview draws, in days. */
export const ADMIN_METRICS_WINDOW_DAYS = 30;

/**
 * Turns the sparse buckets Postgres returns into a continuous series.
 *
 * A day with no bookings has no row, and a line chart fed a gap draws a
 * straight segment across it as though the value had been interpolated. Every
 * day in the window is present, and a quiet day reads as the zero it was.
 */
function fillWindow(buckets: DailyBucket[], since: Date, days: number): DailyBucket[] {
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket.value]));
  const series: DailyBucket[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = toDateString(addDays(since, offset));
    series.push({ date, value: byDate.get(date) ?? 0 });
  }

  return series;
}

export async function readMetrics(db: AppDatabase, now: Date): Promise<AdminMetrics> {
  /*
   * Midnight UTC `days - 1` back, so the window is thirty whole days ending
   * today rather than a rolling thirty-times-24-hours whose first bucket is
   * always a partial day.
   */
  const since = addDays(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    -(ADMIN_METRICS_WINDOW_DAYS - 1),
  );

  const [totals, series] = await Promise.all([
    findAdminMetricTotals(db),
    findAdminMetricSeries(db, since),
  ]);

  return {
    totalRevenueCents: totals.totalRevenueCents,
    bookingsCount: totals.bookingsCount,
    activeVendorsCount: totals.activeVendorsCount,
    usersCount: totals.usersCount,
    pendingTagSuggestionsCount: totals.pendingTagSuggestionsCount,
    reviewsCount: totals.reviewsCount,
    revenueByDay: fillWindow(series.revenueByDay, since, ADMIN_METRICS_WINDOW_DAYS),
    bookingsByDay: fillWindow(series.bookingsByDay, since, ADMIN_METRICS_WINDOW_DAYS),
    signupsByDay: fillWindow(series.signupsByDay, since, ADMIN_METRICS_WINDOW_DAYS),
    completedByDay: fillWindow(series.completedByDay, since, ADMIN_METRICS_WINDOW_DAYS),
  };
}

export async function readVendorFacets(db: AppDatabase): Promise<AdminVendorFacets> {
  return findVendorFilterFacets(db);
}
