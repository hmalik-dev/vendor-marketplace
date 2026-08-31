import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import {
  availability,
  bookingRequests,
  bookings,
  users,
  vendorCategories,
} from '@vendor-marketplace/db/schema';
import type { AvailabilityStatus } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/** Bookings whose event falls inside `[from, to)`, by status bucket. */
export async function countBookingsBetween(
  db: AppDatabase,
  vendorId: string,
  from: string,
  to: string,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        gte(bookings.eventDate, from),
        lt(bookings.eventDate, to),
      ),
    );

  return rows?.[0]?.total ?? 0;
}

/**
 * What the vendor actually keeps this month — their payout share, not the
 * gross the customer paid, which includes the platform fee.
 *
 * Counted on `paid_at` rather than the event date: money that has arrived is
 * this month's earnings even when the event is next year.
 */
export async function sumPayoutsBetween(
  db: AppDatabase,
  vendorId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${bookings.vendorPayoutCents}), 0)::int` })
    .from(bookings)
    .where(
      and(eq(bookings.vendorId, vendorId), gte(bookings.paidAt, from), lt(bookings.paidAt, to)),
    );

  return rows?.[0]?.total ?? 0;
}

export interface ResponseCounts {
  /** Requests the vendor was given a chance to answer. */
  offered: number;
  /** Those they actually answered — anything that left `pending` by their hand. */
  answered: number;
}

/**
 * The response rate's two halves.
 *
 * A request the **customer** withdrew is excluded from both: the vendor was
 * never given the chance, and counting it against them would punish them for
 * somebody else's change of mind. An expired one *is* counted as offered and
 * not answered, because that is exactly the failure the rate measures.
 */
export async function countResponses(
  db: AppDatabase,
  vendorId: string,
  since: Date,
): Promise<ResponseCounts> {
  const rows = await db
    .select({ status: bookingRequests.status, total: sql<number>`count(*)::int` })
    .from(bookingRequests)
    .where(and(eq(bookingRequests.vendorId, vendorId), gte(bookingRequests.createdAt, since)))
    .groupBy(bookingRequests.status);

  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.total]));
  const answered = (byStatus.quoted ?? 0) + (byStatus.accepted ?? 0) + (byStatus.declined ?? 0);
  const unanswered = (byStatus.pending ?? 0) + (byStatus.expired ?? 0);

  return { offered: answered + unanswered, answered };
}

export async function countPendingRequests(db: AppDatabase, vendorId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookingRequests)
    .where(and(eq(bookingRequests.vendorId, vendorId), eq(bookingRequests.status, 'pending')));

  return rows?.[0]?.total ?? 0;
}

export interface CalendarDayRow {
  date: string;
  status: AvailabilityStatus;
}

/**
 * The vendor's calendar rows inside `[from, to)`.
 *
 * The calendar is **sparse** — an absent row means available — so this returns
 * only the days somebody has said something about, and the caller fills the
 * gaps. Reading `availability` rather than re-deriving from `bookings` is what
 * keeps the dashboard strip and the availability screen from disagreeing: the
 * booking lifecycle writes `booked` and `pending` here, and the vendor writes
 * `blocked` here.
 */
export async function findCalendarBetween(
  db: AppDatabase,
  vendorId: string,
  from: string,
  to: string,
): Promise<CalendarDayRow[]> {
  return db
    .select({ date: availability.date, status: availability.status })
    .from(availability)
    .where(
      and(
        eq(availability.vendorId, vendorId),
        gte(availability.date, from),
        lt(availability.date, to),
      ),
    );
}

export interface NextPayoutRow {
  bookingId: string;
  eventDate: string;
  customerFirstName: string;
  vendorPayoutCents: number;
}

/**
 * The soonest event on or after `from` that this vendor is owed money for.
 *
 * `confirmed` only. A `completed` booking has already paid out, and a
 * `cancelled` or `disputed` one is money that is not coming — naming any of
 * them as the *next* payout would overstate what is owed, which is the one
 * direction a money figure must never err in.
 */
export async function findNextPayout(
  db: AppDatabase,
  vendorId: string,
  from: string,
): Promise<NextPayoutRow | null> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      eventDate: bookings.eventDate,
      customerFirstName: users.firstName,
      vendorPayoutCents: bookings.vendorPayoutCents,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.status, 'confirmed'),
        gte(bookings.eventDate, from),
      ),
    )
    .orderBy(asc(bookings.eventDate))
    .limit(1);

  return rows[0] ?? null;
}

export async function findCategoryIds(db: AppDatabase, vendorId: string): Promise<string[]> {
  const rows = await db
    .select({ categoryId: vendorCategories.categoryId })
    .from(vendorCategories)
    .where(eq(vendorCategories.vendorId, vendorId));

  return rows.map((row) => row.categoryId);
}
