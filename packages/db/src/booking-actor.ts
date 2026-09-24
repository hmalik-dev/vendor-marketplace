import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema/index.js';

type ActorDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * The transaction-local setting `booking_events`' triggers read the actor from
 * (VEN-647). Unset means the system moved the row: a sweep, a webhook, an
 * admin path that does not carry the admin's id.
 */
export const BOOKING_ACTOR_SETTING = 'app.booking_actor';

/**
 * Names `userId` as the one moving booking rows for the rest of this
 * transaction. `set_config(..., true)`, so it ends at commit or rollback and a
 * pooled connection's next borrower never inherits it — the same reasoning as
 * `withRequestIdentity`.
 */
export async function setBookingActor(tx: ActorDatabase, userId: string): Promise<void> {
  await tx.execute(sql`select set_config(${BOOKING_ACTOR_SETTING}, ${userId}, true)`);
}

/**
 * Runs `fn` in a transaction attributed to `userId`. A DAO that opens its own
 * transaction runs inside this one as a savepoint, so the setting reaches its
 * writes too.
 */
export async function asBookingActor<T>(
  db: ActorDatabase,
  userId: string,
  fn: (tx: ActorDatabase) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setBookingActor(tx, userId);

    return fn(tx);
  });
}
