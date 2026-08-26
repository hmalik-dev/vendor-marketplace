import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from '../client.js';
import { loadEnv } from '../load-env.js';

const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

/**
 * Applies every pending migration. Drizzle records applied migrations in
 * `drizzle.__drizzle_migrations`, so re-running against an up-to-date database
 * is a no-op rather than an error.
 */
async function main(): Promise<void> {
  loadEnv();

  // Migrations use the direct connection where one is configured — DDL through
  // a transaction-mode pooler is the classic Neon migration failure.
  const { db, client } = createDatabase({
    max: 1,
    ...(process.env.DATABASE_URL_UNPOOLED
      ? { connectionString: process.env.DATABASE_URL_UNPOOLED }
      : {}),
  });

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log('Migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
