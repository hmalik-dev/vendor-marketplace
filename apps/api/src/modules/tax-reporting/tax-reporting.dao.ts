import { bookings, vendorProfiles } from '@vendor-marketplace/db/schema';
import { and, asc, eq, gt, gte, isNotNull, lt, sql } from 'drizzle-orm';
import type { AppDatabase } from '../../lib/database.js';

export interface SettledBookingRow {
  bookingId: string;
  vendorId: string;
  /** The event's calendar date, `YYYY-MM-DD`. */
  eventDate: string;
  /** Refunded to the customer by Orla or in the Stripe Dashboard: the two columns the payout code subtracts. */
  refundedCents: number;
  vendorPayoutCents: number;
  debtNettedCents: number;
  stripeAccountId: string;
  totalAmountCents: number;
  /** When the vendor's share moved: the transfer for `separate`, the charge for `destination`. */
  settledAt: Date;
}

/**
 * D49 ambiguity 3: the year is the year of the transfer. A `separate` booking
 * is transferred by the sweep after the event, so `payout_released_at` dates it
 * and a booking not yet transferred has no settlement date at all. A
 * `destination` booking split at the charge, so `paid_at` is its transfer.
 */
const settledAtExpr = sql<Date | null>`case when ${bookings.payoutModel} = 'separate' then ${bookings.payoutReleasedAt} else ${bookings.paidAt} end`;

const yearStart = (year: number): Date => new Date(Date.UTC(year, 0, 1));

/**
 * Bookings whose vendor share was settled in `year` (UTC), by `settledAtExpr`,
 * and owing the vendor something. `vendor_payout_cents = 0` is a booking refunded in full
 * before release, which never moved money and is no transaction. Both payout
 * models count; the vendor's share is read from the same column the payout
 * sweep releases, and no rate is restated here.
 */
export async function settledBookings(
  db: AppDatabase,
  year: number,
  vendorId?: string,
): Promise<SettledBookingRow[]> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      vendorId: bookings.vendorId,
      eventDate: bookings.eventDate,
      refundedCents: sql<number>`coalesce(${bookings.refundAmountCents}, 0) + ${bookings.externalRefundCents}`,
      vendorPayoutCents: bookings.vendorPayoutCents,
      debtNettedCents: bookings.debtNettedCents,
      stripeAccountId: vendorProfiles.stripeAccountId,
      totalAmountCents: bookings.totalAmountCents,
      settledAt: sql<Date | string>`${settledAtExpr}`.as('settled_at'),
    })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(
      and(
        gte(settledAtExpr, yearStart(year)),
        lt(settledAtExpr, yearStart(year + 1)),
        gt(bookings.vendorPayoutCents, 0),
        isNotNull(vendorProfiles.stripeAccountId),
        vendorId ? eq(bookings.vendorId, vendorId) : undefined,
      ),
    )
    .orderBy(asc(vendorProfiles.stripeAccountId), asc(settledAtExpr), asc(bookings.id));

  return rows.map((row) => ({
    ...row,
    stripeAccountId: row.stripeAccountId!,
    settledAt: new Date(row.settledAt),
  }));
}

/** The calendar years (UTC) that have at least one settled booking, newest first; one vendor's when given. */
export async function taxYearsWithSettledBookings(
  db: AppDatabase,
  vendorId?: string,
): Promise<number[]> {
  const year = sql<number>`extract(year from ${settledAtExpr} at time zone 'UTC')::int`;
  const rows = await db
    .selectDistinct({ year })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(
      and(
        isNotNull(settledAtExpr),
        gt(bookings.vendorPayoutCents, 0),
        isNotNull(vendorProfiles.stripeAccountId),
        vendorId ? eq(bookings.vendorId, vendorId) : undefined,
      ),
    );

  return rows.map((row) => row.year).sort((a, b) => b - a);
}
