import { bookings, vendorProfiles } from '@vendor-marketplace/db/schema';
import { and, asc, eq, gt, gte, isNotNull, lt, sql } from 'drizzle-orm';
import type { AppDatabase } from '../../lib/database.js';

export interface SettledBookingRow {
  vendorId: string;
  stripeAccountId: string;
  totalAmountCents: number;
  paidAt: Date;
}

const yearStart = (year: number): Date => new Date(Date.UTC(year, 0, 1));

/**
 * Bookings whose vendor share was settled in `year` (UTC): paid, and owing the
 * vendor something. `vendor_payout_cents = 0` is a booking refunded in full
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
      vendorId: bookings.vendorId,
      stripeAccountId: vendorProfiles.stripeAccountId,
      totalAmountCents: bookings.totalAmountCents,
      paidAt: bookings.paidAt,
    })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(
      and(
        isNotNull(bookings.paidAt),
        gte(bookings.paidAt, yearStart(year)),
        lt(bookings.paidAt, yearStart(year + 1)),
        gt(bookings.vendorPayoutCents, 0),
        isNotNull(vendorProfiles.stripeAccountId),
        vendorId ? eq(bookings.vendorId, vendorId) : undefined,
      ),
    )
    .orderBy(asc(vendorProfiles.stripeAccountId), asc(bookings.paidAt), asc(bookings.id));

  return rows.map((row) => ({
    ...row,
    stripeAccountId: row.stripeAccountId!,
    paidAt: row.paidAt!,
  }));
}

/** The calendar years (UTC) that have at least one settled booking, newest first. */
export async function taxYearsWithSettledBookings(db: AppDatabase): Promise<number[]> {
  const year = sql<number>`extract(year from ${bookings.paidAt} at time zone 'UTC')::int`;
  const rows = await db
    .selectDistinct({ year })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(
      and(
        isNotNull(bookings.paidAt),
        gt(bookings.vendorPayoutCents, 0),
        isNotNull(vendorProfiles.stripeAccountId),
      ),
    );

  return rows.map((row) => row.year).sort((a, b) => b - a);
}
