import { readFileSync } from 'node:fs';
import path from 'node:path';
import { asc, eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tagSuggestions, users } from './schema/index.js';
import { seedBookingActors } from './testing/booking-actors.js';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * The repair half of #399's tag-suggestion index, against the SQL that ships.
 *
 * `tag_suggestions_pending_key` cannot be created over rows that already
 * violate it, so a database carrying duplicates fails the **deploy** rather
 * than the insert — and duplicates are expected, because the dedupe was a read
 * followed by an unguarded insert. Migrations run in order against an empty
 * database, so this one never meets such a row there.
 */
const TAG = '0023_dedupe_pending_tag_suggestions';
const INDEX_TAG = '0024_late_bill_hollister';

const JOURNAL = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');

const ENTRIES: readonly { readonly tag: string }[] = (
  JSON.parse(readFileSync(JOURNAL, 'utf8')) as { entries: { tag: string }[] }
).entries;

function statementsOf(tag: string): readonly string[] {
  return readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

let testDb: TestDatabase;
let vendorId: string;

async function apply(tag: string): Promise<void> {
  for (const statement of statementsOf(tag)) {
    await testDb.db.execute(sql.raw(statement));
  }
}

/**
 * A database at the schema the migration *before* this one left.
 *
 * It has to be built by replaying the journal rather than by `runMigrations`,
 * because `runMigrations` also applies `0024`, and once that index exists the
 * duplicate rows this migration is written to clear can no longer be inserted.
 * The fixture would be impossible to create against the schema that ships,
 * which is exactly the condition the migration exists for.
 */
async function databaseBeforeTheIndex(): Promise<void> {
  testDb = await createTestDatabase();

  for (const entry of ENTRIES) {
    if (entry.tag === TAG) {
      break;
    }

    await apply(entry.tag);
  }

  await seedBookingActors(testDb.db, 'tag-dedupe');

  // `tag_suggestions.vendor_id` references `users`, not `vendor_profiles` —
  // the column names the submitter, and any signed-in vendor may suggest a tag.
  const rows = await testDb.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, 'user_tag-dedupe_vendor'))
    .limit(1);

  vendorId = rows[0]!.id;
}

/** A row as the old read-then-insert path left it: no decision on it at all. */
async function pending(name: string, createdAt: string): Promise<void> {
  await testDb.db.insert(tagSuggestions).values({
    vendorId,
    suggestedName: name,
    category: 'language',
    status: 'pending',
    createdAt: new Date(createdAt),
  });
}

async function names(): Promise<string[]> {
  const rows = await testDb.db
    .select({ name: tagSuggestions.suggestedName })
    .from(tagSuggestions)
    .orderBy(asc(tagSuggestions.createdAt));

  return rows.map((row) => row.name);
}

/*
 * A fresh database per test rather than a shared one: the last case applies the
 * index itself, and a test that leaves an index behind would decide whether the
 * next one can build its fixture.
 */
beforeEach(databaseBeforeTheIndex);

afterEach(async () => {
  await testDb.close();
});

describe('0023_dedupe_pending_tag_suggestions', () => {
  it('runs before the index that needs it', () => {
    const tags = ENTRIES.map((entry) => entry.tag);

    expect(tags).toContain(TAG);
    expect(tags.indexOf(TAG)).toBeLessThan(tags.indexOf(INDEX_TAG));
  });

  it('keeps the oldest pending row for an idea and drops the rest', async () => {
    await pending('Tigrinya', '2026-01-01T09:00:00Z');
    await pending('tigrinya', '2026-01-02T09:00:00Z');
    await pending('TIGRINYA', '2026-01-03T09:00:00Z');

    await apply(TAG);

    // The oldest survives: it is the one the admin queue has been showing.
    expect(await names()).toEqual(['Tigrinya']);
  });

  /*
   * The key is `lower()` and **not** `btrim(lower())`, matching
   * `findPendingSuggestion` exactly rather than being more thorough than it.
   * A stored name is always trimmed and whitespace-collapsed by the writer, so
   * an untrimmed row cannot occur — and if one somehow did, the read would miss
   * it too. Matching the read is the invariant that matters; being stricter
   * than it would delete a row the service still considers distinct.
   */
  it('matches the read exactly, rather than normalising further', async () => {
    await pending('Tigrinya', '2026-01-01T09:00:00Z');
    await pending('  tigrinya  ', '2026-01-02T09:00:00Z');

    await apply(TAG);

    expect(await names()).toEqual(['Tigrinya', '  tigrinya  ']);
  });

  it('leaves distinct ideas alone', async () => {
    await pending('Tigrinya', '2026-01-01T09:00:00Z');
    await pending('Amharic', '2026-01-02T09:00:00Z');

    await apply(TAG);

    expect(await names()).toEqual(['Tigrinya', 'Amharic']);
  });

  /*
   * Settled rows are history and may legitimately repeat — rejecting an idea
   * must not stop anyone raising it again — so the index is partial and this
   * must match it.
   */
  it('does not touch settled duplicates', async () => {
    await pending('Tigrinya', '2026-01-01T09:00:00Z');
    await pending('tigrinya', '2026-01-02T09:00:00Z');
    await testDb.db.update(tagSuggestions).set({ status: 'rejected' });
    await pending('TIGRINYA', '2026-01-03T09:00:00Z');

    await apply(TAG);

    expect(await names()).toHaveLength(3);
  });

  it('leaves the table able to take the index, which is the point', async () => {
    await pending('Tigrinya', '2026-01-01T09:00:00Z');
    await pending('tigrinya', '2026-01-02T09:00:00Z');

    await apply(TAG);

    // Fails outright if any duplicate survived.
    await expect(apply(INDEX_TAG)).resolves.not.toThrow();
  });

  it('is idempotent', async () => {
    await pending('Tigrinya', '2026-01-01T09:00:00Z');
    await pending('tigrinya', '2026-01-02T09:00:00Z');

    await apply(TAG);
    await apply(TAG);

    expect(await names()).toEqual(['Tigrinya']);
  });
});
