import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from '@vendor-marketplace/db/schema';

/**
 * The database surface every DAO takes. Declared structurally rather than as
 * `PostgresJsDatabase` so the route suites can hand the same DAOs an
 * in-process PGlite instance and exercise real SQL without Docker.
 */
export type AppDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;
