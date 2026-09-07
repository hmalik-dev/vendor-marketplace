import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sql } from 'drizzle-orm';
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
  /**
   * Applies the migrations **before** `tag`, in journal order, and stops.
   *
   * For the tests whose subject is a migration itself: the interesting question
   * is what an existing row says afterwards, and reaching that state means
   * being able to write the row while the schema is still the old one.
   * `runMigrations` goes to head and cannot express it.
   */
  migrateUpTo: (tag: string) => Promise<void>;
  close: () => Promise<void>;
}

/** One migration file, applied the way the migrator applies it. */
async function applyMigration(db: PgliteDatabase<typeof schema>, tag: string): Promise<void> {
  const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8');

  for (const statement of body.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) {
      await db.execute(sql.raw(statement));
    }
  }
}

/** The migration tags in the order the migrator applies them. */
export function migrationTags(): string[] {
  const journal = JSON.parse(
    readFileSync(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: { tag: string }[] };

  return journal.entries.map((entry) => entry.tag);
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
    migrateUpTo: async (tag) => {
      const tags = migrationTags();
      const at = tags.indexOf(tag);

      if (at < 1) {
        // A rename would otherwise silently turn the caller into a no-op.
        throw new Error(`migrateUpTo: ${tag} is not in the migration journal`);
      }

      for (const earlier of tags.slice(0, at)) {
        await applyMigration(db, earlier);
      }
    },
    close: () => client.close(),
  };
}
