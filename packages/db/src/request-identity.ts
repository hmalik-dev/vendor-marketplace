import { sql } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import { USER_ROLES, type UserRole } from '@vendor-marketplace/shared';
import type * as schema from './schema/index.js';

/** Who a request is, as the database's policies read it (`app_user_id()`, `app_role()`). */
export interface RequestIdentity {
  /** `users.id` of the authenticated caller, set by the API after authentication. */
  userId: string;
  role: UserRole;
  /**
   * Set only by the operator console's own paths. A participant path never sets
   * it, so an admin account using `/messages` is bound to its own threads and
   * the API's ownership check keeps its backstop for every role.
   */
  operator?: boolean;
}

type IdentityDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;
export type IdentityTransaction = PgTransaction<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs `fn` in a transaction whose row-level-security policies see `identity`.
 *
 * The settings are transaction-local (`set_config(..., true)`): Neon's pooled
 * URL is transaction-mode, so a session-level `set` would outlive this request
 * on a connection the next request borrows. They are gone at commit or
 * rollback, so two requests for different users back to back on one connection
 * never see each other's identity.
 *
 * An invalid identity throws before any statement runs, rather than being
 * coerced: a malformed id would otherwise reach `app_user_id()`'s uuid cast
 * inside a policy and fail there, on a query nobody attributes to it.
 */
export async function withRequestIdentity<T>(
  db: IdentityDatabase,
  identity: RequestIdentity,
  fn: (tx: IdentityTransaction) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(identity.userId)) {
    throw new Error('Request identity needs a uuid user id');
  }

  if (!USER_ROLES.includes(identity.role)) {
    throw new Error('Request identity needs a known role');
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.user_id', ${identity.userId}, true), set_config('app.role', ${identity.role}, true), set_config('app.operator', ${identity.operator === true ? 'true' : ''}, true)`,
    );

    const result = await fn(tx);

    /*
     * Handed an open transaction, drizzle opens a savepoint, and Postgres keeps
     * a `set_config(..., true)` made inside one until the outer transaction
     * ends. Blanking on the way out stops a statement appended after this call
     * from inheriting the identity. A throw needs no reset: it rolls back.
     */
    await tx.execute(
      sql`select set_config('app.user_id', '', true), set_config('app.role', '', true), set_config('app.operator', '', true)`,
    );

    return result;
  });
}
