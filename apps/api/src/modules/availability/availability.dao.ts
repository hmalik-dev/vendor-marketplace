import { and, asc, eq, gt, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import {
  availability,
  bookingRequests,
  type AvailabilityRow,
  type NewAvailabilityRow,
} from '@vendor-marketplace/db/schema';
import { LIVE_BOOKING_REQUEST_STATUSES } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * The dates in `[from, to]` a vendor has an unsettled request on.
 *
 * Read rather than stored, because a live request is a request and not a
 * commitment: persisting it as an `availability` row would remove the vendor
 * from every date-filtered search for a week over a message they have not
 * answered. Only the vendor's own calendar wants this view, and only while the
 * request is live, so it is derived where it is needed.
 */
export async function findLiveRequestDates(
  db: AppDatabase,
  vendorId: string,
  from: string,
  to: string,
  now: Date,
): Promise<string[]> {
  if (!vendorId) {
    return [];
  }

  const rows = await db
    .selectDistinct({ date: bookingRequests.eventDate })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.vendorId, vendorId),
        gte(bookingRequests.eventDate, from),
        lte(bookingRequests.eventDate, to),
        inArray(bookingRequests.status, [...LIVE_BOOKING_REQUEST_STATUSES]),
        /*
         * Expiry in this product is lazy: a request past its window keeps the
         * status `pending` in the table until something reads *the request* and
         * ages it. This read never does, so it has to apply the same deadline
         * itself — otherwise a request the customer gave up on a week ago holds
         * the cell at `Pending request`, and because `pending` is locked the
         * vendor cannot free or block their own Saturday.
         */
        or(isNull(bookingRequests.expiresAt), gt(bookingRequests.expiresAt, now)),
      ),
    );

  return rows.map((row) => row.date);
}

/**
 * Rows in `[from, to]`. Comparisons stay in SQL against the `DATE` column, so
 * no `YYYY-MM-DD` is ever round-tripped through a local-time `Date`.
 */
export async function findAvailabilityInRange(
  db: AppDatabase,
  vendorId: string,
  from: string,
  to: string,
): Promise<AvailabilityRow[]> {
  if (!vendorId) {
    return [];
  }

  return db
    .select()
    .from(availability)
    .where(
      and(
        eq(availability.vendorId, vendorId),
        gte(availability.date, from),
        lte(availability.date, to),
      ),
    )
    .orderBy(asc(availability.date));
}

export async function findAvailabilityOnDates(
  db: AppDatabase,
  vendorId: string,
  dates: readonly string[],
): Promise<AvailabilityRow[]> {
  if (!vendorId || dates.length === 0) {
    return [];
  }

  return db
    .select()
    .from(availability)
    .where(and(eq(availability.vendorId, vendorId), inArray(availability.date, [...dates])));
}

/**
 * Applies one calendar edit atomically: the dates handed back to "available"
 * lose their row — the calendar is sparse, and absence *is* availability — and
 * the blocked ones are upserted on the `(vendor_id, date)` unique index.
 */
export async function applyAvailability(
  db: AppDatabase,
  vendorId: string,
  clearedDates: readonly string[],
  blocked: readonly NewAvailabilityRow[],
): Promise<void> {
  if (clearedDates.length === 0 && blocked.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    if (clearedDates.length > 0) {
      await tx.delete(availability).where(
        and(
          eq(availability.vendorId, vendorId),
          inArray(availability.date, [...clearedDates]),
          /*
           * Never a `booked` cell. The service reads the dates first and
           * refuses the whole write when one of them is booked, but that
           * read and this delete are two statements: an accept or a payment
           * webhook landing between them would have its date freed by a
           * vendor who was told nothing (#399). The predicate makes the
           * check and the write agree by construction — a date booked in
           * that window is simply not cleared.
           */
          ne(availability.status, 'booked'),
        ),
      );
    }

    if (blocked.length > 0) {
      await tx
        .insert(availability)
        .values([...blocked])
        .onConflictDoUpdate({
          target: [availability.vendorId, availability.date],
          set: { status: sql`excluded.status`, note: sql`excluded.note` },
          // Same reasoning as the delete: an upsert with no predicate would
          // overwrite a `booked` cell written since the service's read.
          where: ne(availability.status, 'booked'),
        });
    }
  });
}
