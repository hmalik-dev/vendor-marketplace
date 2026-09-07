import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
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

/**
 * Runs a statement that must be refused, and returns what Postgres actually
 * said — not what Drizzle wrapped it in.
 *
 * The `cause` unwrapping is the point and is version-specific: Drizzle reports
 * a failed statement as its own error with the driver's underneath, so a test
 * asserting on the outer `message` reads a generic wrapper and its `toContain`
 * passes only by accident (#381). Shared because the append-only tables each
 * prove their rule by attempting the write, and a copy of this per suite is a
 * copy that stops unwrapping when Drizzle changes.
 *
 * Throws if the statement **succeeds**, because a refusal test that silently
 * passes on a permitted write is the failure it exists to catch.
 */
export async function refusalOf(db: TestDatabase['db'], statement: string): Promise<string> {
  try {
    await db.execute(sql.raw(statement));
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;

    return cause instanceof Error ? cause.message : String(cause ?? error);
  }

  throw new Error(`Expected this to be refused, but it succeeded:\n${statement}`);
}
