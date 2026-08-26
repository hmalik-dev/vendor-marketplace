import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../schema/index.js';

export const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

export interface TestDatabase {
  db: PgliteDatabase<typeof schema>;
  client: PGlite;
  /** Applies every migration in `drizzle/` against this database. */
  runMigrations: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Boots an in-process Postgres (PGlite) so migration and seed behaviour is
 * exercised against a real engine without requiring Docker on the machine
 * running the suite.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  return {
    db,
    client,
    runMigrations: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => client.close(),
  };
}
