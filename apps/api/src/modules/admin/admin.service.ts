import {
  addDays,
  generateSlug,
  isPayoutFailing,
  payoutStatusOf,
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
  AdminPackageActiveResult,
  AdminPaymentPage,
  AdminPaymentQuery,
  AdminPayoutRetryResult,
  AdminReviewPage,
  AdminReviewQuery,
  AdminReviewVisibilityResult,
  AdminTagList,
  AdminTagRow,
  AdminTagSuggestionPage,
  AdminTagSuggestionQuery,
  AdminTagSuggestionResult,
  AdminTagSuggestionRow,
  AdminVendorFacets,
  AdminVendorPage,
  AdminVendorPublishResult,
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
import { resolveCasesForBooking } from '../cases/cases.dao.js';
import { conflict, forbidden, notFound, validationFailed } from '../../lib/errors.js';
import { queueNotificationEmail } from '../notifications/notification-email.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import {
  bestEffortNotice,
  unwindAccountBookings,
  SUSPENSION_UNWIND,
  type AdminContext,
} from './account-unwind.js';

import type { ObjectStorage } from '../../lib/storage.js';
import { countActivePackages, updatePackageById } from '../packages/packages.dao.js';
import { deletePortfolioItemById } from '../portfolio/portfolio.dao.js';
import { reapObjects } from '../portfolio/portfolio.service.js';
import {
  deleteReviewAndRecalculate,
  setReviewVisibilityAndRecalculate,
} from '../reviews/reviews.dao.js';
import {
  findVendorCategoryIds,
  findVendorProfileById,
  updateVendorProfileById,
} from '../vendors/vendors.dao.js';
import { publishBlockers, unpublishForMissingPackages } from '../vendors/vendors.service.js';
import { normalizeTagName } from '../tags/tags.service.js';
import { resolveDispute } from '../payments/payments.service.js';
import { retryPayoutRelease } from '../payments/payouts.service.js';
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
  findPortfolioItemForModeration,
  findServicePackageForModeration,
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
  lockVendorProfile,
  resolveTagSuggestionRow,
  setBanned,
  updateTagRow,
  type AdminActionRecord,
  type AdminTagSuggestionProjection,
  type AdminVendorFilters,
  type AdminVendorProjection,
  type DailyBucket,
} from './admin.dao.js';

/*
 * Re-exported rather than left where it now lives.
 *
 * `AdminContext` moved to `account-unwind.js` with the unwind that needs it,
 * but `admin.routes.ts` imports it inside a multi-line block from this module
 * that two other lanes are appending to at the same time — so re-pointing that
 * one line would be a textual conflict with both of them for no behavioural
 * gain. The seam is real; this keeps the import stable while it settles. A
 * later ticket can collapse it once those lanes have landed.
 */
export type { AdminContext } from './account-unwind.js';

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
 * The five statuses, derived from the columns that actually record state.
 *
 * Order matters and is the same order `statusCondition` filters in. `retired`
 * is tested first, ahead even of the ban (#433): an account whose owner deleted
 * their Clerk identity cannot be moderated, reinstated or asked anything, so
 * "this account is gone" is the fact that makes every other one moot. A
 * suspension on a retired row is history, not a lever.
 *
 * A banned vendor is then `flagged` whatever their publish flag says, because
 * the ban is the next fact an operator needs to see.
 */
export function deriveVendorStatus(row: {
  isRetired: boolean;
  isBanned: boolean;
  isPublished: boolean;
  stripeOnboarded: boolean;
}): AdminVendorStatus {
  if (row.isRetired) {
    return 'retired';
  }

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
    /*
     * Passed through, never decided here (#432). The console has no writer for
     * any of these three: `stripeOnboarded` is derived from Stripe's capability
     * read by the account webhook and constrained by D29, and the other two are
     * Stripe's own words for why. An operator who could set them by hand would
     * be recording a guess in the column the payout gate reads.
     */
    stripeAccountId: row.stripeAccountId,
    stripeDisabledReason: row.stripeDisabledReason,
    stripeRequirementsDue: row.stripeRequirementsDue,
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

  const unwound = await unwindAccountBookings(
    context,
    targetId,
    profile?.id ?? null,
    now,
    SUSPENSION_UNWIND,
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
      requestsDeclined: unwound.requestsDeclined,
      bookingsCancelled: unwound.bookingsCancelled,
      refundsIssued: unwound.refundsIssued,
      refundsFailed: unwound.refundsFailed,
      profileUnpublished,
    },
  });

  /*
   * Named, not spread. `AccountUnwindResult` carries one field `AdminBanResult`
   * has no place for — `bookingsLeftForReview`, which only an account-holder
   * unwind can ever be non-zero — and spreading it into a response Zod
   * validates would put an undeclared key in the body.
   */
  return {
    userId: targetId,
    isBanned: true,
    requestsDeclined: unwound.requestsDeclined,
    bookingsCancelled: unwound.bookingsCancelled,
    refundsIssued: unwound.refundsIssued,
    refundsFailed: unwound.refundsFailed,
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

  /*
   * **The ruling closes the case, and it has to happen here** (#431).
   *
   * The complaint and the hold are one act — that is why `placeDisputeHold` has
   * a single orchestrator — so the ruling and the case's disposition are one act
   * too. Leaving the row `open` after the money moved would put the queue's
   * oldest-open figure, which is the whole point of that screen, permanently
   * wrong; and a resolution reached from the Bookings table rather than from the
   * case has to close it just the same, which is why this is here and not in the
   * case route.
   *
   * **After the audit write, not before**, because `recordAdminActionBestEffort`
   * states that it is the last thing this function does and that a row therefore
   * exists only where the change really happened. Ordering this ahead of it
   * would have made that comment quietly false.
   *
   * Plural — a booking can carry a second report filed behind the first, and a
   * chargeback beside a report. One ruling settles all of them: the money has
   * moved one way or the other and there is nothing left for a second case to
   * decide.
   *
   * Best-effort for the reason this whole function is: by the time it runs the
   * hold has been lifted or the card refunded, and there is no retry that does
   * either a second time safely.
   */
  await bestEffortNotice(
    context,
    { bookingId },
    async () => {
      await resolveCasesForBooking(context.db, bookingId, actorId, now);
    },
    'A dispute was resolved but its case could not be closed',
  );

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

/**
 * `First Last`, collapsed — the same shape every other admin surface prints.
 *
 * Exported since #431: the case console prints the same three names (the
 * sender, the operator who ruled, the customer on the booking) and a private
 * copy here meant `/admin/cases` and `/admin/bookings` could come to print one
 * person differently.
 */
export function fullName(firstName: string, lastName: string): string {
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
    findAdminPayments(db, query.flag, query.pageSize, offset),
    countAdminPayments(db, query.flag),
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
      vendorSlug: row.vendorSlug,
      customerName: fullName(row.customerFirstName, row.customerLastName),
      paidAt: row.paidAt,
      /*
       * `payoutStatusOf`, not a fourth reading of the status enum. It is the
       * one derivation #423 wrote for this question, already answering it for
       * the vendor dashboard and the booking report — a private copy here is
       * how two surfaces come to disagree about which bookings are held.
       */
      payoutStatus: payoutStatusOf(row),
      payoutReleasedAt: row.payoutReleasedAt,
      payoutAttempts: row.payoutAttempts,
      payoutFailureReason: row.payoutFailureReason,
      stripeTransferId: row.stripeTransferId,
      /*
       * Derived here rather than projected in SQL. `admin.dao.ts` still holds
       * the predicate — a filter has to run in the database — but the *value*
       * comes from the same shared function the sweep's own retry uses, so the
       * filter and the rows it returns cannot answer differently.
       */
      payoutFailing: isPayoutFailing(row),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Retries one stuck payout and records that an operator did it (#432).
 *
 * The transfer itself is `retryPayoutRelease` — the sweep's own path — so this
 * function is only the two things that make it an *admin* action: the audit row
 * and the console's view of what happened.
 *
 * The audit write is **best-effort and last**, which is the rule stated on
 * `recordAdminActionBestEffort` rather than a judgement made here: by the time
 * it runs, money has either moved at Stripe or a refusal has been written
 * against the booking, and failing the request over an unwritten log row would
 * ask the operator to repeat work that has already happened.
 */
export async function retryBookingPayout(
  context: AdminContext,
  actorId: string,
  bookingId: string,
  now: Date,
): Promise<AdminPayoutRetryResult> {
  const result = await retryPayoutRelease(context, bookingId, now);

  await recordAdminActionBestEffort(context, {
    actorId,
    action: 'payout_retried',
    subjectType: 'booking',
    subjectId: bookingId,
    /*
     * The outcome and the attempt, and no Stripe error text. The log exists to
     * be counted and filtered — "how many payouts did we retry by hand last
     * week" — and a gateway message pasted into it is a sentence nobody can
     * group by. The reason itself lives on the booking that produced it.
     */
    detail: { outcome: result.outcome, attempt: result.payoutAttempts },
  });

  /*
   * Returned as it came back. `retryPayoutRelease` derives `payoutStatus` and
   * `payoutFailing` from the row it re-read, so there is nothing left for this
   * layer to decide — and a second reading here is exactly the private copy
   * this ticket exists to stop.
   */
  return result;
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
      isPublic: row.isPublic,
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

// --- Graduated moderation (#435) -------------------------------------------

/*
 * The levers between doing nothing and banning an account.
 *
 * **None of these is a ban, and the difference is the point of them.** A ban
 * declines every open request, cancels and fully refunds every confirmed
 * booking, and unpublishes the storefront — an irreversible response to a
 * reversible problem, which is what an operator was left with when a vendor had
 * one bad photo or an unverified claim in a bio. Everything in this section
 * changes what the public can see and **nothing else**: no request is declined,
 * no booking is cancelled, no money moves.
 *
 * Each writes an `admin_actions` row in the same transaction as the state it
 * changed, because a reversible action nobody can see the history of is not
 * reversible in practice.
 */

/**
 * Takes a storefront off the marketplace, or puts it back.
 *
 * Republishing runs the **same `publishBlockers` the vendor's own editor runs**.
 * An operator reinstating a listing is undoing their own earlier decision, not
 * overriding the rule that a profile without a category or a bookable package
 * cannot be public — and a storefront republished past that rule is one a
 * customer can reach and cannot book.
 *
 * A suspended account is refused outright. Ban already unpublished them, and
 * republishing a banned vendor's storefront would put a business back on the
 * marketplace whose owner cannot sign in to run it.
 */
export async function setVendorPublished(
  context: AdminContext,
  actorId: string,
  vendorId: string,
  isPublished: boolean,
): Promise<AdminVendorPublishResult> {
  return context.db.transaction(async (tx) => {
    /*
     * Locked before it is read, and before `setPackageActive` can reach it.
     *
     * Both transactions decide whether the storefront may be published from a
     * count of its active packages, and both then write. Unlocked, they
     * interleave into the state `publishBlockers` exists to make impossible:
     * this one reads one active package and republishes while the other commits
     * the deactivation of that package and finds `is_published` still false, so
     * `unpublishForMissingPackages` declines — leaving a live storefront with
     * nothing bookable on it. Two operators unpublishing at once would likewise
     * both pass the state check and both append an audit row where one is owed
     * a 409.
     */
    await lockVendorProfile(tx, vendorId);

    const vendor = await findVendorProfileById(tx, vendorId);

    if (!vendor) {
      throw notFound('No storefront with that id');
    }

    const owner = await findUserById(tx, vendor.userId);

    if (vendor.isPublished === isPublished) {
      throw conflict(
        isPublished
          ? 'That storefront is already published'
          : 'That storefront is already unpublished',
      );
    }

    if (isPublished) {
      /*
       * A missing owner is unverifiable, not unbanned.
       *
       * `findUserById` excludes soft-deleted accounts, and the Clerk webhook
       * soft-deletes the user while leaving the vendor profile behind — so
       * `owner?.isBanned` read as `false` for an account that no longer exists,
       * and republished a storefront that would take booking requests nobody
       * can answer. Taking one **down** never needs this check: that is the
       * safe direction, and refusing it would strand the listing.
       */
      if (!owner) {
        throw conflict('That storefront has no active owner account to publish it for');
      }

      if (owner.isBanned) {
        throw conflict('Lift the suspension on this account before republishing its storefront');
      }

      /*
       * Sequential, not `Promise.all`. Both reads run on the transaction's own
       * connection, and firing them concurrently at one connection is how a
       * transaction ends up interleaving statements it was opened to serialise.
       */
      const categoryIds = await findVendorCategoryIds(tx, vendor.id);
      const activePackages = await countActivePackages(tx, vendor.id);
      const blockers = publishBlockers(vendor, categoryIds, activePackages);

      if (blockers.length > 0) {
        throw validationFailed('This storefront is not complete enough to publish.', { blockers });
      }
    }

    const updated = await updateVendorProfileById(tx, vendor.id, { isPublished });

    if (!updated) {
      throw notFound('No storefront with that id');
    }

    await insertAdminAction(tx, {
      actorId,
      action: isPublished ? 'vendor_republished' : 'vendor_unpublished',
      subjectType: 'vendor_profile',
      subjectId: vendor.id,
      /* Ids resolve the rest; the log keeps no copy of vendor-authored text. */
      detail: {},
    });

    return {
      vendorId: vendor.id,
      isPublished,
      /*
       * `isRetired` is **derived, not assumed**. An earlier draft hard-coded
       * `false` on the reasoning that a retired vendor cannot reach this line,
       * and that reasoning was wrong in one direction: `findVendorProfileById`
       * filters `vendor_profiles.is_deleted`, but the console's `retired` is
       * that **or** `users.deleted_at`, and the unpublish branch deliberately
       * skips the owner check. So unpublishing a storefront whose owner had
       * deleted their account answered `status: 'review'` for a row the Vendors
       * table renders as `Retired`.
       *
       * `owner` is exactly the missing half: `findUserById` excludes
       * soft-deleted accounts, so no row means the account is gone.
       */
      status: deriveVendorStatus({
        isRetired: !owner,
        isBanned: owner?.isBanned ?? false,
        isPublished,
        stripeOnboarded: vendor.stripeOnboarded,
      }),
    };
  });
}

/**
 * Hides a review from every public surface, or puts it back.
 *
 * The recompute is `reviews.dao`'s, reached rather than repeated — the same
 * reason `deleteReview` reaches for its deletion. Hiding is deletion's
 * reversible twin and has to reach the same rating for the same set.
 */
export async function setReviewVisibility(
  context: AdminContext,
  actorId: string,
  reviewId: string,
  isPublic: boolean,
): Promise<AdminReviewVisibilityResult> {
  /*
   * The visibility change and its audit row commit together, the same shape
   * `deleteReview` uses: nothing outside Postgres happens on this path, so the
   * best-effort rule does not apply and the row rides the transaction.
   * `setReviewVisibilityAndRecalculate` opens one of its own to take the review
   * lock and re-derive the rating; passing this one in nests it as a savepoint.
   */
  const result = await context.db.transaction(async (tx) => {
    const outcome = await setReviewVisibilityAndRecalculate(tx, reviewId, isPublic);

    if (outcome.outcome === 'updated') {
      await insertAdminAction(tx, {
        actorId,
        action: isPublic ? 'review_unhidden' : 'review_hidden',
        subjectType: 'review',
        subjectId: reviewId,
        /* Never the review's text — that is the thing a moderation log must not copy. */
        detail: {},
      });
    }

    return outcome;
  });

  if (result.outcome === 'missing') {
    throw notFound('No review with that id');
  }

  /*
   * A vendor's private note about a customer. Its `is_public` is the author's
   * own choice, not a moderation state, so this lever does not apply to it —
   * refused here as well as hidden in the console, because the console is not
   * the only caller this route will ever have.
   */
  if (result.outcome === 'not_applicable') {
    throw conflict(
      "Only a review of a vendor can be hidden or shown. This is a vendor's private note about a customer — delete it if it has to go.",
    );
  }

  if (result.outcome === 'unchanged') {
    throw conflict(isPublic ? 'That review is already visible' : 'That review is already hidden');
  }

  context.log.info({ actorId, reviewId, isPublic }, "Admin changed a review's visibility");

  return {
    reviewId,
    isPublic: result.isPublic,
    vendorAvgRating: result.vendorAvgRating,
    vendorReviewCount: result.vendorReviewCount,
  };
}

/**
 * Switches one service package off the storefront, or back on.
 *
 * Deactivating the vendor's **last** bookable package unpublishes the profile,
 * through the same `unpublishForMissingPackages` the vendor's own editor calls:
 * publishing requires a package, so a live profile with none sends customers to
 * a storefront they cannot book. The result says whether that happened, because
 * an operator who removed one service and took a business off the marketplace
 * has to be told which of those two things they did.
 */
export async function setPackageActive(
  context: AdminContext,
  actorId: string,
  packageId: string,
  isActive: boolean,
): Promise<AdminPackageActiveResult> {
  return context.db.transaction(async (tx) => {
    const owning = await findServicePackageForModeration(tx, packageId);

    if (!owning) {
      throw notFound('No package with that id');
    }

    /*
     * The vendor row is the lock both this and `setVendorPublished` take, for
     * the reason that one gives: the publish decision is derived from a count
     * of active packages, so the two writers have to serialise on something,
     * and the vendor is the only row they share. The package is then **re-read
     * under that lock** — an unlocked first read is only how the vendor is
     * found, and two operators deactivating the same package would otherwise
     * both see it active.
     */
    await lockVendorProfile(tx, owning.vendorId);

    const servicePackage = await findServicePackageForModeration(tx, packageId);

    if (!servicePackage) {
      throw notFound('No package with that id');
    }

    if (servicePackage.isActive === isActive) {
      throw conflict(
        isActive ? 'That package is already active' : 'That package is already deactivated',
      );
    }

    const updated = await updatePackageById(tx, servicePackage.vendorId, packageId, { isActive });

    if (!updated) {
      throw notFound('No package with that id');
    }

    await insertAdminAction(tx, {
      actorId,
      action: isActive ? 'package_reactivated' : 'package_deactivated',
      subjectType: 'service_package',
      subjectId: packageId,
      detail: { vendorId: servicePackage.vendorId },
    });

    if (isActive) {
      return { packageId, isActive, vendorUnpublished: false };
    }

    const vendor = await findVendorProfileById(tx, servicePackage.vendorId);
    const vendorUnpublished = vendor ? await unpublishForMissingPackages(tx, vendor) : false;

    if (vendorUnpublished) {
      await insertAdminAction(tx, {
        actorId,
        action: 'vendor_unpublished',
        subjectType: 'vendor_profile',
        subjectId: servicePackage.vendorId,
        detail: { reason: 'last_active_package_deactivated', packageId },
      });
    }

    return { packageId, isActive, vendorUnpublished };
  });
}

/**
 * Removes one portfolio photo, permanently.
 *
 * The only irreversible action in this section, and deliberately so: an image
 * that must not be on the platform must leave the bucket as well as the page.
 * It reuses the vendor-side delete whole — the row commits first and the objects
 * are reaped after, never inside the transaction — so an operator's removal
 * promotes the next cover and reaps exactly what a vendor's own removal would.
 *
 * `reapObjects` is given the **vendor's** user id, not the operator's: it
 * refuses any key whose owner segment does not match, and an operator's id would
 * fail that check on every object and silently leave the photo in the bucket.
 */
export async function removePortfolioItemAsAdmin(
  context: AdminContext,
  storage: ObjectStorage,
  actorId: string,
  itemId: string,
): Promise<void> {
  const item = await findPortfolioItemForModeration(context.db, itemId);

  if (!item) {
    throw notFound('No portfolio photo with that id');
  }

  /*
   * The row delete and its audit row commit together; the **reap happens after**
   * and deliberately outside, because an object store round trip inside a
   * transaction holds it open across a network call. `deletePortfolioItemById`
   * opens a transaction of its own to promote the next cover, so passing this
   * one in nests it as a savepoint.
   */
  const deleted = await context.db.transaction(async (tx) => {
    const removed = await deletePortfolioItemById(tx, item.vendorId, itemId);

    if (!removed) {
      throw notFound('No portfolio photo with that id');
    }

    await insertAdminAction(tx, {
      actorId,
      action: 'portfolio_item_removed',
      subjectType: 'portfolio_item',
      subjectId: itemId,
      detail: { vendorId: item.vendorId },
    });

    return removed;
  });

  await reapObjects(
    context.db,
    storage,
    item.vendorUserId,
    [deleted.imageUrl, deleted.thumbnailUrl],
    context.log,
  );
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
    payoutsBlockedVendorsCount: totals.payoutsBlockedVendorsCount,
    payoutsFailingBookingsCount: totals.payoutsFailingBookingsCount,
    revenueByDay: fillWindow(series.revenueByDay, since, ADMIN_METRICS_WINDOW_DAYS),
    bookingsByDay: fillWindow(series.bookingsByDay, since, ADMIN_METRICS_WINDOW_DAYS),
    signupsByDay: fillWindow(series.signupsByDay, since, ADMIN_METRICS_WINDOW_DAYS),
    completedByDay: fillWindow(series.completedByDay, since, ADMIN_METRICS_WINDOW_DAYS),
  };
}

export async function readVendorFacets(db: AppDatabase): Promise<AdminVendorFacets> {
  return findVendorFilterFacets(db);
}
