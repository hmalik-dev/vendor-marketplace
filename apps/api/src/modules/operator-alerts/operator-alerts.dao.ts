import {
  bookingRequests,
  bookings,
  emailDeliveries,
  operatorAlerts,
  supportCases,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import type {
  ImmediateOperatorAlertKind,
  OperatorAlertOutcome,
  UserRole,
} from '@vendor-marketplace/shared';
import { and, asc, count, eq, gt, gte, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { AppDatabase } from '../../lib/database.js';

/**
 * Records an immediate alert unless one for the same kind and subject was
 * recorded after `since`, and answers the new row's id — or null for a
 * duplicate.
 *
 * The advisory lock is what makes the check-then-insert safe across instances:
 * two webhooks for one subject arriving on two processes serialise here, and
 * the second sees the first one's committed row.
 */
export async function recordAlertUnlessRecent(
  db: AppDatabase,
  input: {
    kind: ImmediateOperatorAlertKind;
    subjectId: string;
    outcome: OperatorAlertOutcome;
    /** The app clock's now, never the database's: the dedupe window is measured on it. */
    sentAt: Date;
  },
  since: Date,
): Promise<string | null> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`operator_alert:${input.kind}:${input.subjectId}`}, 0))`,
    );

    const recent = await tx
      .select({ id: operatorAlerts.id })
      .from(operatorAlerts)
      .where(
        and(
          eq(operatorAlerts.kind, input.kind),
          eq(operatorAlerts.subjectId, input.subjectId),
          gt(operatorAlerts.sentAt, since),
        ),
      )
      .limit(1);

    if (recent[0]) {
      return null;
    }

    const rows = await tx.insert(operatorAlerts).values(input).returning({ id: operatorAlerts.id });

    return rows[0]?.id ?? null;
  });
}

/** Whether today's digest has already been claimed by any instance. */
export async function isDigestClaimed(db: AppDatabase, localDate: string): Promise<boolean> {
  const rows = await db
    .select({ id: operatorAlerts.id })
    .from(operatorAlerts)
    .where(and(eq(operatorAlerts.kind, 'daily_digest'), eq(operatorAlerts.subjectId, localDate)))
    .limit(1);

  return rows.length > 0;
}

/**
 * Claims the digest for one operator-local date, answering the row id to the
 * one instance whose insert won and null to every other.
 *
 * The partial unique index `operator_alerts_digest_date_key` is the arbiter; an
 * untargeted `do nothing` is enough because it is the only unique constraint an
 * insert with a generated id can collide with.
 */
export async function claimDigest(
  db: AppDatabase,
  localDate: string,
  outcome: OperatorAlertOutcome,
  sentAt: Date,
): Promise<string | null> {
  const rows = await db
    .insert(operatorAlerts)
    .values({ kind: 'daily_digest', subjectId: localDate, outcome, sentAt })
    .onConflictDoNothing()
    .returning({ id: operatorAlerts.id });

  return rows[0]?.id ?? null;
}

/** Gives a claim back after its send failed, so the next tick or event can retry. */
export async function releaseAlert(db: AppDatabase, id: string): Promise<void> {
  await db.delete(operatorAlerts).where(eq(operatorAlerts.id, id));
}

export interface DisputeAlertSubject {
  caseId: string;
  reference: string;
  bookingId: string | null;
  totalAmountCents: number | null;
}

export async function findDisputeAlertSubject(
  db: AppDatabase,
  stripeDisputeId: string,
): Promise<DisputeAlertSubject | null> {
  const rows = await db
    .select({
      caseId: supportCases.id,
      reference: supportCases.reference,
      bookingId: supportCases.bookingId,
      totalAmountCents: bookings.totalAmountCents,
    })
    .from(supportCases)
    .leftJoin(bookings, eq(bookings.id, supportCases.bookingId))
    .where(eq(supportCases.stripeDisputeId, stripeDisputeId))
    .limit(1);

  return rows[0] ?? null;
}

export interface VendorAlertSubject {
  vendorId: string;
  userId: string;
  businessName: string;
  disabledReason: string | null;
}

export async function findVendorAlertSubject(
  db: AppDatabase,
  stripeAccountId: string,
): Promise<VendorAlertSubject | null> {
  const rows = await db
    .select({
      vendorId: vendorProfiles.id,
      userId: vendorProfiles.userId,
      businessName: vendorProfiles.businessName,
      disabledReason: vendorProfiles.stripeDisabledReason,
    })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.stripeAccountId, stripeAccountId))
    .limit(1);

  return rows[0] ?? null;
}

/** A count and a cents total over one set of rows. */
export interface MoneyTally {
  count: number;
  totalCents: number;
}

export interface DigestFigures {
  signups: { role: UserRole; count: number }[];
  requests: number;
  payments: MoneyTally;
  refunds: MoneyTally;
  payouts: MoneyTally;
  /** Open cases by how long they have waited. */
  openCases: { underOneDay: number; oneToThreeDays: number; overThreeDays: number };
  bounces: number;
  /** Accepted requests whose event is inside the window and which nobody has paid. */
  unpaidSoon: { requestId: string; eventDate: string }[];
}

export interface DigestWindow {
  /** The last 24 hours: `[since, until)`. */
  since: Date;
  until: Date;
  /** Event dates `[fromDate, throughDate]`, operator-local. */
  fromDate: string;
  throughDate: string;
}

const MS_PER_DAY = 24 * 60 * 60_000;

function tally(amount: AnyPgColumn) {
  return {
    count: count(),
    totalCents: sql<number>`coalesce(sum(${amount}), 0)`.mapWith(Number),
  };
}

/**
 * Every figure the morning digest reports, read in one pass.
 *
 * Counts and totals only — no names, addresses or message text leave here, so
 * the digest cannot carry customer PII however it is rendered.
 */
export async function readDigestFigures(
  db: AppDatabase,
  window: DigestWindow,
): Promise<DigestFigures> {
  const { since, until } = window;
  // Strings, because a raw `sql` fragment gives the driver no column to type a `Date` by.
  const oneDayAgo = new Date(until.getTime() - MS_PER_DAY).toISOString();
  const threeDaysAgo = new Date(until.getTime() - 3 * MS_PER_DAY).toISOString();

  const [signups, requests, payments, refunds, payouts, openCases, bounces, unpaidSoon] =
    await Promise.all([
      db
        .select({ role: users.role, count: count() })
        .from(users)
        .where(and(gte(users.createdAt, since), lt(users.createdAt, until)))
        .groupBy(users.role)
        .orderBy(asc(users.role)),
      db
        .select({ count: count() })
        .from(bookingRequests)
        .where(and(gte(bookingRequests.createdAt, since), lt(bookingRequests.createdAt, until))),
      db
        .select(tally(bookings.totalAmountCents))
        .from(bookings)
        .where(and(gte(bookings.paidAt, since), lt(bookings.paidAt, until))),
      db
        .select(tally(bookings.refundAmountCents))
        .from(bookings)
        .where(
          and(
            gt(bookings.refundAmountCents, 0),
            gte(bookings.cancelledAt, since),
            lt(bookings.cancelledAt, until),
          ),
        ),
      db
        .select(tally(bookings.vendorPayoutCents))
        .from(bookings)
        .where(and(gte(bookings.payoutReleasedAt, since), lt(bookings.payoutReleasedAt, until))),
      db
        .select({
          underOneDay:
            sql<number>`count(*) filter (where ${supportCases.createdAt} >= ${oneDayAgo})`.mapWith(
              Number,
            ),
          oneToThreeDays:
            sql<number>`count(*) filter (where ${supportCases.createdAt} < ${oneDayAgo} and ${supportCases.createdAt} >= ${threeDaysAgo})`.mapWith(
              Number,
            ),
          overThreeDays:
            sql<number>`count(*) filter (where ${supportCases.createdAt} < ${threeDaysAgo})`.mapWith(
              Number,
            ),
        })
        .from(supportCases)
        .where(eq(supportCases.status, 'open')),
      db
        .select({ count: count() })
        .from(emailDeliveries)
        .where(
          and(
            eq(emailDeliveries.outcome, 'bounced'),
            isNotNull(emailDeliveries.outcomeUpdatedAt),
            gte(emailDeliveries.outcomeUpdatedAt, since),
            lt(emailDeliveries.outcomeUpdatedAt, until),
          ),
        ),
      db
        .select({ requestId: bookingRequests.id, eventDate: bookingRequests.eventDate })
        .from(bookingRequests)
        .leftJoin(bookings, eq(bookings.requestId, bookingRequests.id))
        .where(
          and(
            eq(bookingRequests.status, 'accepted'),
            isNull(bookings.id),
            gte(bookingRequests.eventDate, window.fromDate),
            lte(bookingRequests.eventDate, window.throughDate),
          ),
        )
        .orderBy(asc(bookingRequests.eventDate), asc(bookingRequests.id)),
    ]);

  return {
    signups,
    requests: requests[0]?.count ?? 0,
    payments: payments[0] ?? { count: 0, totalCents: 0 },
    refunds: refunds[0] ?? { count: 0, totalCents: 0 },
    payouts: payouts[0] ?? { count: 0, totalCents: 0 },
    openCases: openCases[0] ?? { underOneDay: 0, oneToThreeDays: 0, overThreeDays: 0 },
    bounces: bounces[0]?.count ?? 0,
    unpaidSoon,
  };
}
