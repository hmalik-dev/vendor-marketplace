import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * #329's removal of the `style` tag group, exercised against the SQL that ships.
 *
 * The two halves are separate migrations on purpose and the order is the whole
 * point: `0017` recreates `tag_category` without `'style'` and casts both
 * columns to it, which fails outright on a row still holding the value being
 * dropped. `0016` is what clears them. Run against an empty database — as every
 * migration is in a fresh checkout — neither half meets a single style row, so
 * the ordering that matters in production is exactly the thing the ordinary
 * suite cannot observe.
 *
 * So the fixture is built at the schema `0015` left, by replaying the journal up
 * to it, and the assertions are about what survives: the style tag, its
 * `vendor_tags` row and a pending style suggestion all go, and the same vendor's
 * language and cultural tags do not.
 */
const JOURNAL = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');

interface JournalEntry {
  readonly idx: number;
  readonly tag: string;
}

const ENTRIES: readonly JournalEntry[] = (
  JSON.parse(readFileSync(JOURNAL, 'utf8')) as { entries: JournalEntry[] }
).entries;

/** Statements of one migration, split the way drizzle's own runner splits them. */
function statementsOf(tag: string): readonly string[] {
  return readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/*
 * PGlite parses one statement per call, so the fixture is a list rather than a
 * script. Ids are fixed so a failure names the row it is talking about.
 */
const FIXTURE: readonly string[] = [
  `INSERT INTO users (id, clerk_user_id, email, role, first_name, last_name)
   VALUES ('11111111-1111-4111-8111-111111111111', 'user_style_vendor',
           'style-vendor@example.com', 'vendor', 'Wren', 'Field')`,
  `INSERT INTO categories (id, name, slug, display_order)
   VALUES ('22222222-2222-4222-8222-222222222222', 'Photography', 'photography', 1)`,
  `INSERT INTO vendor_profiles (id, user_id, business_name, slug)
   VALUES ('33333333-3333-4333-8333-333333333333',
           '11111111-1111-4111-8111-111111111111', 'Wren & Field', 'wren-field')`,
  `INSERT INTO tags (id, name, slug, category, vendor_category_id, display_order)
   VALUES ('44444444-4444-4444-8444-444444444444', 'Documentary',
           'style-photography-documentary', 'style',
           '22222222-2222-4222-8222-222222222222', 1),
          ('55555555-5555-4555-8555-555555555555', 'Spanish', 'language-spanish',
           'language', NULL, 2),
          ('66666666-6666-4666-8666-666666666666', 'South Asian',
           'cultural-south-asian', 'cultural', NULL, 3)`,
  `INSERT INTO vendor_tags (vendor_id, tag_id) VALUES
     ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'),
     ('33333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555'),
     ('33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666')`,
  `INSERT INTO tag_suggestions (vendor_id, suggested_name, category)
   VALUES ('11111111-1111-4111-8111-111111111111', 'Moody', 'style'),
          ('11111111-1111-4111-8111-111111111111', 'Swahili', 'language')`,
];

let testDb: TestDatabase;

async function apply(tag: string): Promise<void> {
  for (const statement of statementsOf(tag)) {
    await testDb.db.execute(sql.raw(statement));
  }
}

/** Every migration up to and including `tag`, in journal order. */
async function replayThrough(tag: string): Promise<void> {
  const stop = ENTRIES.findIndex((entry) => entry.tag === tag);
  expect(stop, `${tag} is missing from the migration journal`).toBeGreaterThanOrEqual(0);

  for (const entry of ENTRIES.slice(0, stop + 1)) {
    await apply(entry.tag);
  }
}

async function countOf(query: string): Promise<number> {
  const result = await testDb.db.execute(sql.raw(query));
  return Number((result.rows[0] as { count: string | number }).count);
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await replayThrough('0015_simple_johnny_blaze');

  // One vendor, three tags, and only one of them a style. The other two are
  // what proves the delete is scoped through the tag's category rather than
  // emptying the join table.
  for (const statement of FIXTURE) {
    await testDb.db.execute(sql.raw(statement));
  }
});

afterAll(async () => {
  await testDb.close();
});

describe('0016_drop_style_tags + 0017_same_khan', () => {
  it('starts from a database that really holds style rows', async () => {
    expect(await countOf(`SELECT count(*) AS count FROM tags WHERE category = 'style'`)).toBe(1);
    expect(await countOf('SELECT count(*) AS count FROM vendor_tags')).toBe(3);
  });

  it('clears every style row and then drops the enum value', async () => {
    await apply('0016_drop_style_tags');
    await apply('0017_same_khan');

    const labels = await testDb.db.execute(
      sql.raw(`SELECT enumlabel FROM pg_enum
                 JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
                WHERE pg_type.typname = 'tag_category'
                ORDER BY enumsortorder`),
    );

    expect(labels.rows.map((row) => (row as { enumlabel: string }).enumlabel)).toEqual([
      'language',
      'cultural',
      'dietary',
    ]);
    expect(await countOf(`SELECT count(*) AS count FROM tags`)).toBe(2);
    expect(await countOf(`SELECT count(*) AS count FROM tag_suggestions`)).toBe(1);
  });

  it("keeps the vendor's other tags rather than emptying the join table", async () => {
    const rows = await testDb.db.execute(
      sql.raw(`SELECT tags.slug FROM vendor_tags
                 JOIN tags ON tags.id = vendor_tags.tag_id
                ORDER BY tags.slug`),
    );

    expect(rows.rows.map((row) => (row as { slug: string }).slug)).toEqual([
      'cultural-south-asian',
      'language-spanish',
    ]);
  });

  it('drops the scope column and the partial key that existed only for style', async () => {
    expect(
      await countOf(`SELECT count(*) AS count FROM information_schema.columns
                      WHERE table_name = 'tags' AND column_name = 'vendor_category_id'`),
    ).toBe(0);
    expect(
      await countOf(`SELECT count(*) AS count FROM pg_indexes
                      WHERE tablename = 'tags'
                        AND indexname = 'tags_scoped_category_name_key'`),
    ).toBe(0);
  });

  /*
   * The key stops being partial when the scope column goes. Left with its old
   * `WHERE vendor_category_id IS NULL` predicate it would have been dropped
   * along with the column and silently not replaced, so a duplicate name inside
   * a group would insert cleanly.
   */
  it('leaves one unconditional key that rejects a duplicate name in a group', async () => {
    expect(
      await countOf(`SELECT count(*) AS count FROM pg_indexes
                      WHERE tablename = 'tags' AND indexname = 'tags_category_name_key'
                        AND indexdef NOT ILIKE '%WHERE%'`),
    ).toBe(1);

    // drizzle wraps the driver error, so the constraint name is on the cause.
    const rejection = await testDb.db
      .execute(
        sql.raw(`INSERT INTO tags (name, slug, category, display_order)
                 VALUES ('Spanish', 'language-spanish-again', 'language', 9)`),
      )
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect((rejection as { cause?: { constraint?: string } })?.cause?.constraint).toBe(
      'tags_category_name_key',
    );
  });
});
