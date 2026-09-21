import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { RequestIdentity } from '@vendor-marketplace/db';
import type * as schema from '@vendor-marketplace/db/schema';
import type { UserRole } from '@vendor-marketplace/shared';

/**
 * The database surface every DAO takes. Declared structurally rather than as
 * `PostgresJsDatabase` so the route suites can hand the same DAOs an
 * in-process PGlite instance and exercise real SQL without Docker.
 */
export type AppDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * What the database's row-level-security policies should take a caller to be.
 * Built from the authenticated user the guards resolved, never from the request.
 */
export function identityOf(user: { id: string; role: UserRole }): RequestIdentity {
  return { userId: user.id, role: user.role };
}
