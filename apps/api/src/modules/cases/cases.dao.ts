import { and, asc, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
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
  ReportReason,
  ReportSubject,
  SupportCaseOrigin,
  SupportCaseStatus,
  SupportTopic,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

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

function caseFilterCondition(query: Pick<AdminCaseQuery, 'status' | 'booking'>): SQL | undefined {
  return and(
    eq(supportCases.status, query.status),
    query.booking === 'with'
      ? isNotNull(supportCases.bookingId)
      : query.booking === 'without'
        ? isNull(supportCases.bookingId)
        : undefined,
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
      refundAmountCents: bookings.refundAmountCents,
      paidAt: bookings.paidAt,
      payoutReleasedAt: bookings.payoutReleasedAt,
      disputeReason: bookings.disputeReason,
      cancelledBy: bookings.cancelledBy,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
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
   * real `clerk_user_id` and `role` reach the primitive, so nothing downstream
   * is looking at a synthetic account.
   */
  customerId: string;
  customerClerkUserId: string;
  customerRole: (typeof users.$inferSelect)['role'];
  /**
   * What the booking was **before** the hold was attempted.
   *
   * Read here so the chargeback path can say, in the platform's own words, why
   * a hold it could not place was not needed — rather than quoting back copy
   * written for the customer's report form. Free: this row is already read.
   */
  bookingStatus: BookingStatus;
  payoutReleasedAt: Date | null;
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
      customerClerkUserId: users.clerkUserId,
      customerRole: users.role,
      bookingStatus: bookings.status,
      payoutReleasedAt: bookings.payoutReleasedAt,
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
 * no open case naming the thread, no read. It is deliberately not
 * `findSupportCaseById` plus a check — an operator holds a case id and could
 * pass any conversation id beside it, so the grant is looked up *from the
 * conversation* and the case comes back as the answer rather than as an input.
 *
 * `status = 'open'` is load-bearing rather than tidy. A resolved case is a
 * finished job, and leaving its grant standing would turn every report ever
 * filed into a permanent key to that thread — the free browse the ticket exists
 * to refuse, arriving one closed case at a time.
 *
 * Oldest first, so a thread with two reports against it names the case that has
 * been waiting longest, which is the same order the queue itself is worked in.
 */
export async function findOpenCaseForConversation(
  db: AppDatabase,
  conversationId: string,
): Promise<{ id: string; reference: string } | null> {
  const rows = await db
    .select({ id: supportCases.id, reference: supportCases.reference })
    .from(supportCases)
    .where(
      and(
        eq(supportCases.status, 'open'),
        eq(supportCases.subjectType, 'conversation'),
        eq(supportCases.subjectId, conversationId),
      ),
    )
    .orderBy(asc(supportCases.createdAt))
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
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: supportCases.id })
    .from(supportCases)
    .where(
      and(
        eq(supportCases.bookingId, bookingId),
        eq(supportCases.origin, 'chargeback'),
        eq(supportCases.status, 'open'),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Is this chargeback already in the queue?
 *
 * The id alone, because every caller uses this as a boolean — and it is the
 * first thing the webhook asks, ahead of the round trip to Stripe, so it must
 * be as small as the unique index can make it.
 */
export async function findCaseByStripeDisputeId(
  db: AppDatabase,
  stripeDisputeId: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: supportCases.id })
    .from(supportCases)
    .where(eq(supportCases.stripeDisputeId, stripeDisputeId))
    .limit(1);

  return rows[0] ?? null;
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
 * which is the same question asked where it cannot race.
 */
export async function findCaseResolutionState(
  db: AppDatabase,
  caseId: string,
): Promise<{ bookingStatus: BookingStatus | null } | null> {
  const rows = await db
    .select({ bookingStatus: bookings.status })
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
