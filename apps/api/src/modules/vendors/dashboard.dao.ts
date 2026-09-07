import { and, asc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import {
  availability,
  bookingRequests,
  bookings,
  users,
  vendorCategories,
} from '@vendor-marketplace/db/schema';
import type { AvailabilityStatus, BookingStatus } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * A booking that was paid for and kept — the shape both dashboard figures
 * count, and the reason they agree with each other.
 *
 * `cancelled` is excluded because a cancellation now actually unwinds: under
 * D31 the refund reverses the vendor's transfer back out of their connected
 * account, so a cancelled booking is money they no longer have. Before #416 no
 * paid booking could reach `cancelled` at all — every refund 400'd at Stripe
 * and the row never moved — so these two queries were right by accident. They
 * are not any more.
 *
 * `admin.dao.ts`'s `PAID_AND_KEPT` says the same thing for the operator's
 * revenue figure, and `findNextPayout` filters `confirmed` for the same reason.
 * The vendor's own two numbers were the pair left unguarded.
 */
const NOT_CANCELLED = sql`${bookings.status} <> 'cancelled'`;

/** Bookings whose event falls inside `[from, to)`, cancellations excluded. */
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
        NOT_CANCELLED,
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
 *
 * Net of cancellations. A booking the customer cancelled had its transfer
 * reversed (D31), so leaving it in would tell the vendor they earned money
 * that has been taken back out of their balance — on the one screen they check
 * to see what they are owed.
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
      and(
        eq(bookings.vendorId, vendorId),
        gte(bookings.paidAt, from),
        lt(bookings.paidAt, to),
        NOT_CANCELLED,
      ),
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
  /**
   * The three columns `payoutStatusOf` decides the payout state from, selected
   * together because that helper takes the booking rather than a status string.
   *
   * `payoutReleasedAt` is always null here — the query filters on it — and is
   * carried anyway rather than passed as a literal `null`: the moment a caller
   * starts supplying a field the row does not really have, the helper is
   * answering a question about something that is not this booking.
   */
  status: BookingStatus;
  payoutReleasedAt: Date | null;
  stripeTransferId: string | null;
}

/**
 * The soonest payout this vendor is still owed — the earliest event whose money
 * has not yet been transferred.
 *
 * **Three things about the predicate changed with #423, and each was a claim
 * that stopped being true when the release moved off the destination charge.**
 *
 * `completed` is included. It used to be excluded because "a `completed`
 * booking has already paid out" — true of a destination charge, where Stripe
 * split the money as the card succeeded. It is now false: the vendor marking a
 * booking complete moves no money, so a completed booking still inside its
 * payout window is precisely a payout that is owed, and omitting it would show
 * a vendor nothing where they are due a transfer.
 *
 * `disputed` is included, and it is the reason this returns a status at all. A
 * held payout is money the vendor is still owed and cannot yet have, and
 * showing them nothing would be the same screen as having nothing owed. The
 * surface says which it is (#423 acceptance 16).
 *
 * The event-date floor is gone. Whether a payout has been sent is
 * `payout_released_at`, not whether the event is in the future — a booking whose
 * event was last week and whose window has not closed is the *most* imminent
 * payout there is, and a date floor hid exactly those.
 *
 * `cancelled` remains excluded: that money is not coming, and naming it would
 * overstate what is owed, which is the one direction a money figure must never
 * err in.
 */
export async function findNextPayout(
  db: AppDatabase,
  vendorId: string,
): Promise<NextPayoutRow | null> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      eventDate: bookings.eventDate,
      customerFirstName: users.firstName,
      vendorPayoutCents: bookings.vendorPayoutCents,
      status: bookings.status,
      payoutReleasedAt: bookings.payoutReleasedAt,
      stripeTransferId: bookings.stripeTransferId,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        inArray(bookings.status, ['confirmed', 'completed', 'disputed']),
        isNull(bookings.payoutReleasedAt),
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
