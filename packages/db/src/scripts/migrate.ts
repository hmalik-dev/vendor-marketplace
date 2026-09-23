import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from '../client.js';
import { loadEnv } from '../load-env.js';
import { MIGRATION_SESSION_SETTINGS, retryOnLockTimeout } from '../migration-session.js';
import { resolveMigrationUrl } from '../migration-url.js';

const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

/**
 * Applies every pending migration. Drizzle records applied migrations in
 * `drizzle.__drizzle_migrations`, so re-running against an up-to-date database
 * is a no-op rather than an error.
 *
 * The connection carries a lock and a statement timeout, and a run that lost a
 * lock race is tried again a bounded number of times (VEN-650).
 */
async function main(): Promise<void> {
  loadEnv();

  const { db, client } = createDatabase({
    max: 1,
    connectionString: resolveMigrationUrl(),
    connection: MIGRATION_SESSION_SETTINGS,
  });

  try {
    await retryOnLockTimeout(() => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }), {
      onRetry: (attempt, delayMs) =>
        console.warn(`Migration attempt ${attempt} timed out on a lock; retrying in ${delayMs}ms.`),
    });
    console.log('Migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
