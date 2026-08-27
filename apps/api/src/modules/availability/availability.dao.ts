import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import {
  availability,
  type AvailabilityRow,
  type NewAvailabilityRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

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
      await tx
        .delete(availability)
        .where(
          and(eq(availability.vendorId, vendorId), inArray(availability.date, [...clearedDates])),
        );
    }

    if (blocked.length > 0) {
      await tx
        .insert(availability)
        .values([...blocked])
        .onConflictDoUpdate({
          target: [availability.vendorId, availability.date],
          set: { status: sql`excluded.status`, note: sql`excluded.note` },
        });
    }
  });
}
