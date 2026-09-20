import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The migrations folder beside `src/` and `dist/` alike, so the same relative
 * path serves the tests and the compiled API image.
 */
const JOURNAL_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../drizzle/meta/_journal.json',
);

/**
 * How many migrations this build ships, read from drizzle's own journal.
 *
 * The journal is what the migrator walks, so counting its entries cannot drift
 * from what `pnpm db:migrate` applies the way a hand-kept number would. `/ready`
 * compares it with the rows in `drizzle.__drizzle_migrations`.
 */
export function expectedMigrationCount(journalPath: string = JOURNAL_PATH): number {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] };

  return journal.entries.length;
}
