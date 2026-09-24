import { and, asc, desc, eq, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  bookings,
  supportCases,
  users,
  vendorProfiles,
  type NewSupportCaseRow,
  type SupportCaseRow,
} from '@vendor-marketplace/db/schema';
import type {
  AdminCaseQuery,
  BookingStatus,
  FilterWidening,
  PayoutModel,
  ReportReason,
  ReportSubject,
  SupportCaseOrigin,
  SupportCaseStatus,
  SupportTopic,
} from '@vendor-marketplace/shared';
import { countWidenings } from '../admin/widenings.js';
import { payoutResidualHeld } from '../payments/payouts.dao.js';
import type { AppDatabase } from '../../lib/database.js';
import { containsInsensitive } from '../../lib/like-pattern.js';

/**
 * Every `support_cases` query (#431).
 *
 * Its own module rather than a section of `admin.dao.ts` because the table has
 * two writers on opposite sides of the product — the public support route and
 * the Stripe webhook — and neither is an admin operation. The console's reads
 * are here for the same reason the rows are one table: a case is a case.
 */

/** The operator who closed a case, aliased off the sender already on the query. */
const resolver = alias(users, 'case_resolver');

export interface SupportCaseProjection {
  id: string;
  reference: string;
  origin: SupportCaseOrigin;
  status: SupportCaseStatus;
  topic: SupportTopic | null;
  senderUserId: string | null;
  senderFirstName: string | null;
  senderLastName: string | null;
  senderEmail: string | null;
  bookingId: string | null;
  /** What an in-product report is about; `null` on the other two origins (#436). */
  subjectType: ReportSubject | null;
  subjectId: string | null;
  reportReason: ReportReason | null;
  createdAt: Date;
}

export interface SupportCaseDetailProjection extends SupportCaseProjection {
  message: string;
  holdRefusal: string | null;
  emailFailedAt: Date | null;
  networkOutcome: string | null;
  stripeDisputeId: string | null;
  resolvedFirstName: string | null;
  resolvedLastName: string | null;
  resolvedAt: Date | null;
}

/**
 * The list projection.
 *
 * The sender join is a **left** join and has to be: a signed-out visitor's case
 * has no `sender_user_id` at all, and an inner join would hide exactly the
 * reports from people who could not get in — which is the population the support
 * form exists for.
 */
const CASE_SELECTION = {
  id: supportCases.id,
  reference: supportCases.reference,
  origin: supportCases.origin,
  status: supportCases.status,
  topic: supportCases.topic,
  senderUserId: supportCases.senderUserId,
  senderFirstName: users.firstName,
  senderLastName: users.lastName,
  senderEmail: supportCases.senderEmail,
  bookingId: supportCases.bookingId,
  subjectType: supportCases.subjectType,
  subjectId: supportCases.subjectId,
  reportReason: supportCases.reportReason,
  createdAt: supportCases.createdAt,
} as const;

/**
 * The search (VEN-388): the reference, the address the case was sent from, or
 * the sender account's name or address.
 *
 * The account half is an `EXISTS` rather than a condition on the list's sender
 * join, so the count and the widening scan — which read `support_cases` alone —
 * stay the same query as the page.
 */
function caseSearchCondition(term: string): SQL | undefined {
  return or(
    containsInsensitive(supportCases.reference, term),
    containsInsensitive(supportCases.senderEmail, term),
    sql`exists (
      select 1 from ${users} as sender
      where sender.id = ${supportCases.senderUserId}
        and (${containsInsensitive(sql`concat_ws(' ', sender.first_name, sender.last_name)`, term)}
          or ${containsInsensitive(sql`sender.email`, term)})
    )`,
  );
}

function caseFilterCondition(query: {
  status?: SupportCaseStatus;
  booking?: AdminCaseQuery['booking'];
  q?: string | undefined;
}): SQL | undefined {
  return and(
    // `undefined` is the widening scan dropping this filter, never a missing value.
    query.status ? eq(supportCases.status, query.status) : undefined,
    query.booking === 'with'
      ? isNotNull(supportCases.bookingId)
      : query.booking === 'without'
        ? isNull(supportCases.bookingId)
        : undefined,
    query.q ? caseSearchCondition(query.q) : undefined,
  );
}

/**
 * **Oldest first**, which is the opposite of every other console list and is the
 * whole point of this one. The queue's number is the age of the oldest open
 * case, because it is money somebody is not being paid; newest-first would put
 * that row on the last page.
 */
export async function findSupportCases(
  db: AppDatabase,
  query: AdminCaseQuery,
  limit: number,
  offset: number,
): Promise<SupportCaseProjection[]> {
  return db
    .select(CASE_SELECTION)
    .from(supportCases)
    .leftJoin(users, eq(users.id, supportCases.senderUserId))
    .where(caseFilterCondition(query))
    .orderBy(asc(supportCases.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * The two filters this queue can be narrowed by.
 *
 * `status` is on the list even though the filter bar offers no "any", and it is
 * the one that needs explaining. `adminCaseQuerySchema` defaults it to `open`,
 * so **there is no URL that means "any status" here** — clearing the parameter
 * lands back on open, which is the reason the bar has no such choice. The
 * widening is therefore a *switch to the other status*, not a drop, and the
 * delta's own worked example is exactly that: `Open cases instead (4)`, seen
 * from a resolved view.
 *
 * That distinction is load-bearing rather than pedantic. Counting `status` as a
 * drop counts every row of both statuses — a set no destination can show — so
 * the button would print a number the page it opens does not have, and on the
 * console's default view it would link straight back to the empty page it was
 * offered from.
 */
export const CASE_FILTER_KEYS = ['status', 'booking', 'q'] as const;
export type CaseFilterKey = (typeof CASE_FILTER_KEYS)[number];

/** The status a `status` widening actually navigates to. Two members, so it is the other one. */
export function otherCaseStatus(status: SupportCaseStatus): SupportCaseStatus {
  return status === 'open' ? 'resolved' : 'open';
}

/**
 * How many cases each single widening would reveal, in one scan (#454).
 *
 * Only called for an empty first page — the caller enforces that. The scan is
 * unfiltered because a widening reaches rows outside the current `WHERE` by
 * construction, and one `count(*) filter (where …)` per key is what keeps it a
 * single pass rather than a query per filter.
 *
 * **Every count is the count of the page its button opens.** `status` counts
 * the *other* status rather than both, because that is where its link goes;
 * `booking` is a genuine drop and counts the status held. A count that
 * described a different set from the destination would be worse than no number
 * at all — the operator would click it and find fewer rows than promised.
 *
 * No sender join, for the reason `countSupportCases` gives: nothing in
 * `caseFilterCondition` leaves `support_cases`, and a left join cannot change a
 * count.
 */
export async function countCaseWidenings(
  db: AppDatabase,
  query: AdminCaseQuery,
): Promise<FilterWidening[]> {
  return countWidenings<CaseFilterKey>({
    active: CASE_FILTER_KEYS.filter((key) => key === 'status' || query[key] !== undefined),
    conditionWithout: (dropped) =>
      caseFilterCondition({
        status: dropped === 'status' ? otherCaseStatus(query.status) : query.status,
        booking: dropped === 'booking' ? undefined : query.booking,
        q: dropped === 'q' ? undefined : query.q,
      }),
    scan: (selection) => db.select(selection).from(supportCases),
  });
}

export async function countSupportCases(db: AppDatabase, query: AdminCaseQuery): Promise<number> {
  /*
   * No sender join, unlike `findAdminBookings`'s count. That one has to repeat
   * its joins because `refundStuck` reads columns from them; nothing in
   * `caseFilterCondition` leaves `support_cases`, and a left join cannot change
   * a count, so counting without it is the same query.
   */
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(supportCases)
    .where(caseFilterCondition(query));

  return rows?.[0]?.total ?? 0;
}

export async function findSupportCaseById(
  db: AppDatabase,
  caseId: string,
): Promise<SupportCaseDetailProjection | null> {
  const rows = await db
    .select({
      ...CASE_SELECTION,
      message: supportCases.message,
      holdRefusal: supportCases.holdRefusal,
      emailFailedAt: supportCases.emailFailedAt,
      networkOutcome: supportCases.networkOutcome,
      stripeDisputeId: supportCases.stripeDisputeId,
      resolvedFirstName: resolver.firstName,
      resolvedLastName: resolver.lastName,
      resolvedAt: supportCases.resolvedAt,
    })
    .from(supportCases)
    .leftJoin(users, eq(users.id, supportCases.senderUserId))
    .leftJoin(resolver, eq(resolver.id, supportCases.resolvedBy))
    .where(eq(supportCases.id, caseId))
    .limit(1);

  return rows[0] ?? null;
}

export interface CaseBookingProjection {
  id: string;
  status: (typeof bookings.$inferSelect)['status'];
  eventDate: string;
  customerFirstName: string;
  customerLastName: string;
  vendorName: string;
  vendorSlug: string;
  totalAmountCents: number;
  platformFeeCents: number;
  vendorPayoutCents: number;
  vendorOwedCents: number;
  payoutModel: PayoutModel;
  refundAmountCents: number | null;
  paidAt: Date | null;
  payoutReleasedAt: Date | null;
  disputeReason: string | null;
  cancelledBy: (typeof bookings.$inferSelect)['cancelledBy'];
  stripePaymentIntentId: string | null;
}

/**
 * The linked booking with the money on it.
 *
 * A second query rather than more joins on the case read above. The case list
 * needs none of this, the detail needs all of it, and folding six more columns
 * and two more joins into the shared selection is how `/admin/payments` once
 * answered 500 on a column its own query did not join (`findAdminBookings`).
 */
export async function findCaseBooking(
  db: AppDatabase,
  bookingId: string,
): Promise<CaseBookingProjection | null> {
  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      eventDate: bookings.eventDate,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
      vendorName: vendorProfiles.businessName,
      vendorSlug: vendorProfiles.slug,
      totalAmountCents: bookings.totalAmountCents,
      platformFeeCents: bookings.platformFeeCents,
      vendorPayoutCents: bookings.vendorPayoutCents,
      vendorOwedCents: bookings.vendorOwedCents,
      payoutModel: bookings.payoutModel,
      refundAmountCents: bookings.refundAmountCents,
      paidAt: bookings.paidAt,
      payoutReleasedAt: bookings.payoutReleasedAt,
      disputeReason: bookings.disputeReason,
      cancelledBy: bookings.cancelledBy,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      residualHeld: payoutResidualHeld(),
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.customerId))
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return rows[0] ?? null;
}

export interface DisputedBookingProjection {
  bookingId: string;
  /**
   * The customer, as `placeDisputeHold` needs them.
   *
   * A chargeback **is** the customer disputing the charge — at their bank
   * rather than through the report form — so the hold is placed as them, which
   * is what keeps `placeDisputeHold` the single writer rather than needing a
   * webhook-shaped second one. Read from the row rather than fabricated: the
   * real `auth_user_id` and `role` reach the primitive, so nothing downstream
   * is looking at a synthetic account.
   */
  customerId: string;
  customerAuthUserId: string;
  customerRole: (typeof users.$inferSelect)['role'];
  /**
   * What the booking was **before** the hold was attempted.
   *
   * Read here so the chargeback path can say, in the platform's own words, why
   * a hold it could not place was not needed — rather than quoting back copy
   * written for the customer's report form. Free: this row is already read.
   */
  bookingStatus: BookingStatus;
  vendorId: string;
  /** What the hold wrote — a chargeback's hold carries its own message here. */
  disputeReason: string | null;
  payoutReleasedAt: Date | null;
  vendorPayoutCents: number;
  payoutModel: (typeof bookings.$inferSelect)['payoutModel'];
}

/** The booking a Stripe dispute is about, found by the intent that paid it. */
export async function findBookingForDispute(
  db: AppDatabase,
  paymentIntentId: string,
): Promise<DisputedBookingProjection | null> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      customerId: users.id,
      customerAuthUserId: users.authUserId,
      customerRole: users.role,
      bookingStatus: bookings.status,
      vendorId: bookings.vendorId,
      disputeReason: bookings.disputeReason,
      payoutReleasedAt: bookings.payoutReleasedAt,
      vendorPayoutCents: bookings.vendorPayoutCents,
      payoutModel: bookings.payoutModel,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.customerId))
    .where(eq(bookings.stripePaymentIntentId, paymentIntentId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Writes the case, or answers `null` because one already exists for this Stripe
 * dispute.
 *
 * `onConflictDoNothing` on `stripe_dispute_id` rather than a read-then-insert
 * alone: the read is what makes an ordinary replay cheap, and this is what makes
 * two deliveries arriving at once safe. Without it the race writes a second case
 * for one chargeback, which is the double-open the ticket names.
 */
export async function insertSupportCase(
  db: AppDatabase,
  values: NewSupportCaseRow,
): Promise<SupportCaseRow | null> {
  const rows = await db
    .insert(supportCases)
    .values(values)
    .onConflictDoNothing({ target: supportCases.stripeDisputeId })
    .returning();

  return rows[0] ?? null;
}

/**
 * The **open** case that authorises reading one conversation (#436).
 *
 * This one query is the whole of the scope on `GET /admin/conversations/:id/messages`:
 * no open case naming the thread, no read. The case id and the conversation id
 * must match **in one row** — an operator holds a case id and could pass any
 * conversation id beside it, so a case that names some other subject grants
 * nothing here.
 *
 * The case id is an input since VEN-412. It used to be looked up from the
 * conversation, oldest open case first, which was harmless while the case only
 * labelled the audit row; once the case also dates the read, a second report
 * filed weeks later would have been handed the first report's week.
 *
 * `status = 'open'` is load-bearing rather than tidy. A resolved case is a
 * finished job, and leaving its grant standing would turn every report ever
 * filed into a permanent key to that thread — the free browse the ticket exists
 * to refuse, arriving one closed case at a time.
 */
export async function findOpenCaseForConversation(
  db: AppDatabase,
  caseId: string,
  conversationId: string,
): Promise<{
  id: string;
  reference: string;
  createdAt: Date;
  eventDate: string | null;
} | null> {
  /*
   * The case's filing time and its booking's event date ride along because the
   * grant also decides *which* messages it grants (VEN-412): the event date
   * when there is a booking, the week before the report when there is not.
   */
  const rows = await db
    .select({
      id: supportCases.id,
      reference: supportCases.reference,
      createdAt: supportCases.createdAt,
      eventDate: bookings.eventDate,
    })
    .from(supportCases)
    .leftJoin(bookings, eq(bookings.id, supportCases.bookingId))
    .where(
      and(
        eq(supportCases.id, caseId),
        eq(supportCases.status, 'open'),
        eq(supportCases.subjectType, 'conversation'),
        eq(supportCases.subjectId, conversationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Is this booking's hold one the customer did **not** place?
 *
 * The question `sendSupportMessage` has to answer before refusing a second
 * report. #425 refuses one deliberately — a duplicate complaint about a dispute
 * already open is a second email a human triages for nothing — and that rule is
 * right for the case it was written for, when the customer's own report was the
 * only thing that could set `disputed`.
 *
 * #431 broke that premise: a chargeback sets it too, and then the refusal tells
 * somebody who filed nothing *"you have already reported a problem"* and sends
 * their message nowhere. This is the narrowest signal that separates the two,
 * so the original rule survives untouched for the case it was written for.
 */
export async function findOpenChargebackCase(
  db: AppDatabase,
  bookingId: string,
): Promise<{ id: string; networkOutcome: string | null } | null> {
  const rows = await db
    .select({ id: supportCases.id, networkOutcome: supportCases.networkOutcome })
    .from(supportCases)
    .where(
      and(
        eq(supportCases.bookingId, bookingId),
        eq(supportCases.origin, 'chargeback'),
        eq(supportCases.status, 'open'),
      ),
    )
    // Newest first: with two chargebacks on one booking the latest is the live one.
    .orderBy(desc(supportCases.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Is this chargeback already in the queue?
 *
 * The id alone, because every caller uses this as a boolean — and it is the
 * first thing the webhook asks, ahead of the round trip to Stripe, so it must
 * be as small as the unique index can make it. The booking and the recorded
 * network outcome ride along (VEN-645) so a redelivered `created` for a lost
 * dispute can finish a settlement that failed after the case was written.
 */
export async function findCaseByStripeDisputeId(
  db: AppDatabase,
  stripeDisputeId: string,
): Promise<{ id: string; bookingId: string | null; networkOutcome: string | null } | null> {
  const rows = await db
    .select({
      id: supportCases.id,
      bookingId: supportCases.bookingId,
      networkOutcome: supportCases.networkOutcome,
    })
    .from(supportCases)
    .where(eq(supportCases.stripeDisputeId, stripeDisputeId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Writes the early fraud warning case for a booking, or answers `null` because
 * one already exists (VEN-645).
 *
 * The uniqueness is a transaction-scoped advisory lock on the booking rather
 * than an index: a partial unique index on `origin = 'fraud_warning'` cannot be
 * created in the migration that adds that enum member, and Stripe does redeliver
 * while a slow first attempt is still running.
 */
export async function insertFraudWarningCase(
  db: AppDatabase,
  values: NewSupportCaseRow & { bookingId: string },
): Promise<SupportCaseRow | null> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`fraud_warning:${values.bookingId}`}))`,
    );

    const existing = await tx
      .select({ id: supportCases.id })
      .from(supportCases)
      .where(
        and(eq(supportCases.bookingId, values.bookingId), eq(supportCases.origin, 'fraud_warning')),
      )
      .limit(1);

    if (existing[0]) {
      return null;
    }

    const rows = await tx.insert(supportCases).values(values).returning();

    return rows[0] ?? null;
  });
}

/** Records that the report never reached the inbox. See `email_failed_at`. */
export async function markCaseEmailFailed(
  db: AppDatabase,
  caseId: string,
  failedAt: Date,
): Promise<void> {
  await db
    .update(supportCases)
    .set({ emailFailedAt: failedAt, updatedAt: failedAt })
    .where(eq(supportCases.id, caseId));
}

/** Stripe's own word for how the network closed it. Never touches `status`. */
export async function recordNetworkOutcome(
  db: AppDatabase,
  stripeDisputeId: string,
  outcome: string,
  now: Date,
): Promise<SupportCaseRow | null> {
  const rows = await db
    .update(supportCases)
    .set({ networkOutcome: outcome, updatedAt: now })
    .where(eq(supportCases.stripeDisputeId, stripeDisputeId))
    .returning();

  return rows[0] ?? null;
}

export interface CaseResolutionState {
  bookingStatus: BookingStatus | null;
  caseStatus: (typeof supportCases.$inferSelect)['status'];
  origin: (typeof supportCases.$inferSelect)['origin'];
  networkOutcome: string | null;
  payoutReleasedAt: Date | null;
  vendorPayoutCents: number | null;
  payoutModel: (typeof bookings.$inferSelect)['payoutModel'] | null;
}

/**
 * What `resolveCase` has to decide on, in **one** query.
 *
 * Two facts: that the case exists, and whether the booking behind it is still
 * holding a payout. The obvious shape was `findSupportCaseById` plus
 * `findCaseBooking` — four joins and twenty-odd columns to read one enum — and
 * then the response was built by reading both of them again. This is the
 * pre-check; `readCase` is the response.
 *
 * **Whether the case is still open is deliberately not decided here.** Reading
 * it and acting on it would be a check-then-act across two statements, so two
 * operators pressing at once would both pass. `markCaseResolved` matches on
 * `status = 'open'` in the `UPDATE` itself and answers `null` to the loser,
 * which is the same question asked where it cannot race. `caseStatus` is read
 * only so the payout guard stands aside for a case someone already closed.
 */
export async function findCaseResolutionState(
  db: AppDatabase,
  caseId: string,
): Promise<CaseResolutionState | null> {
  const rows = await db
    .select({
      bookingStatus: bookings.status,
      caseStatus: supportCases.status,
      origin: supportCases.origin,
      networkOutcome: supportCases.networkOutcome,
      payoutReleasedAt: bookings.payoutReleasedAt,
      vendorPayoutCents: bookings.vendorPayoutCents,
      payoutModel: bookings.payoutModel,
    })
    .from(supportCases)
    .leftJoin(bookings, eq(bookings.id, supportCases.bookingId))
    .where(eq(supportCases.id, caseId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Closes a case, and **only one that is open**.
 *
 * The `status = 'open'` predicate is what makes the write idempotent under two
 * operators pressing at once: the second update matches nothing and answers
 * `null`, so the caller can say "already resolved" rather than overwriting the
 * first operator's name and timestamp with their own.
 */
export async function markCaseResolved(
  /** An executor, so the audit row can commit or roll back with the close. */
  db: AppDatabase,
  caseId: string,
  resolvedBy: string,
  now: Date,
): Promise<SupportCaseRow | null> {
  const rows = await db
    .update(supportCases)
    .set({ status: 'resolved', resolvedBy, resolvedAt: now, updatedAt: now })
    .where(and(eq(supportCases.id, caseId), eq(supportCases.status, 'open')))
    .returning();

  return rows[0] ?? null;
}

/**
 * Closes every open case about one booking, because its dispute was just ruled
 * on.
 *
 * Plural on purpose: a customer can file a report, have it resolved, and file a
 * second one, and a chargeback can arrive on a booking that already carries a
 * report. One ruling settles all of them — the money has moved one way or the
 * other and there is nothing left for a second case to decide.
 */
export async function resolveCasesForBooking(
  db: AppDatabase,
  bookingId: string,
  resolvedBy: string,
  now: Date,
): Promise<SupportCaseRow[]> {
  return db
    .update(supportCases)
    .set({ status: 'resolved', resolvedBy, resolvedAt: now, updatedAt: now })
    .where(and(eq(supportCases.bookingId, bookingId), eq(supportCases.status, 'open')))
    .returning();
}
