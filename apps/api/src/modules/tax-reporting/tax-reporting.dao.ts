import { bookings, vendorProfiles } from '@vendor-marketplace/db/schema';
import { and, asc, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
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
  /** What backup withholding kept from this booking's payout (VEN-723). */
  backupWithheldCents: number;
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

/**
 * `settledAtExpr` is a raw `sql` template, so Drizzle has no column encoder for
 * a value compared against it and the postgres-js driver refuses a bare `Date`
 * parameter. Bind the instant as ISO text and cast it in the statement.
 */
const yearStart = (year: number) =>
  sql`${new Date(Date.UTC(year, 0, 1)).toISOString()}::timestamptz`;

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
      backupWithheldCents: bookings.backupWithheldCents,
      stripeAccountId: vendorProfiles.stripeAccountId,
      totalAmountCents: bookings.totalAmountCents,
      settledAt: sql<Date | string>`${settledAtExpr}`.as('settled_at'),
    })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(
      and(
        sql`${settledAtExpr} >= ${yearStart(year)}`,
        sql`${settledAtExpr} < ${yearStart(year + 1)}`,
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

/**
 * What backup withholding kept in each calendar year (UTC), the figure Form 945
 * is filed from (VEN-723). Dated by the release, the moment the money was
 * withheld, and only years that withheld something appear.
 */
export async function backupWithheldByYear(
  db: AppDatabase,
): Promise<{ year: number; cents: number }[]> {
  const year = sql<number>`extract(year from ${bookings.payoutReleasedAt} at time zone 'UTC')::int`;
  const rows = await db
    .select({ year, cents: sql<number>`sum(${bookings.backupWithheldCents})::int` })
    .from(bookings)
    .where(and(isNotNull(bookings.payoutReleasedAt), gt(bookings.backupWithheldCents, 0)))
    .groupBy(year)
    .orderBy(desc(year));

  return rows;
}

/** Every connected account a vendor has, oldest vendor first, for the capability backfill (VEN-723). */
export async function vendorStripeAccountIds(db: AppDatabase): Promise<string[]> {
  const rows = await db
    .select({ accountId: vendorProfiles.stripeAccountId })
    .from(vendorProfiles)
    .where(isNotNull(vendorProfiles.stripeAccountId))
    .orderBy(asc(vendorProfiles.createdAt), asc(vendorProfiles.id));

  return rows.flatMap((row) => (row.accountId ? [row.accountId] : []));
}
