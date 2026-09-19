import { inArray, type SQL, type TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { bookingRequests, conversations } from './schema/index.js';
import type { AnyPgDatabase } from './seed-support.js';

/**
 * Deletes booking requests together with the threads that started from them.
 *
 * `conversations.booking_request_id` is `ON DELETE SET NULL`, and a partial
 * unique index allows one `NULL` thread per customer and vendor. Deleting two
 * of a pair's requests at once therefore sets the second thread's column to
 * `NULL` beside the first's and fails the whole statement with `23505` — in
 * one statement or across two, since the first `NULL` row is still there.
 *
 * Only the seeds delete requests; no route does. A seeded thread has no
 * history worth keeping past the request it was opened for, so the threads go
 * first and nothing is left to collide.
 */
export async function deleteBookingRequests<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>, where: SQL): Promise<void> {
  const doomed = db.select({ id: bookingRequests.id }).from(bookingRequests).where(where);

  await db.delete(conversations).where(inArray(conversations.bookingRequestId, doomed));
  await db.delete(bookingRequests).where(where);
}
