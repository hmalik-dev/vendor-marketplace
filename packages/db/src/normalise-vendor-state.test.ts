import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * #332's closing of `state` to the two-letter USPS code, exercised against the
 * SQL that ships.
 *
 * The two halves are separate migrations and the order is the whole point.
 * `0019` casts `vendor_profiles.state` to the new `us_state` type, and that
 * cast fails outright on the row that motivated the ticket — the one holding
 * `Texas` where the rest hold `TX`. `0018` is what repairs them.
 *
 * Run against an empty database, as every migration is in a fresh checkout,
 * neither half meets a single bad row — so the ordering that matters in
 * production is exactly what the ordinary suite cannot observe. The fixture is
 * therefore built at the schema `0017` left, by replaying the journal to it.
 */
const JOURNAL = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');

interface JournalEntry {
  readonly idx: number;
  readonly tag: string;
}

const ENTRIES: readonly JournalEntry[] = (
  JSON.parse(readFileSync(JOURNAL, 'utf8')) as { entries: JournalEntry[] }
).entries;

function statementsOf(tag: string): readonly string[] {
  return readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

const REPAIR = '0018_normalise_vendor_state';
const CAST = '0019_worried_prodigy';

/*
 * Every spelling the column was found holding, plus the ones it could hold.
 * `TX` and `Texas` are the pair that actually split `Austin` in two; the rest
 * are the near misses a repair that only handled the exact observed value
 * would leave behind for the cast to choke on.
 */
const VENDORS: readonly { readonly id: string; readonly slug: string; readonly state: string }[] = [
  { id: 'aaaaaaaa-1111-4111-8111-111111111111', slug: 'already-a-code', state: 'TX' },
  { id: 'aaaaaaaa-2222-4222-8222-222222222222', slug: 'full-name', state: 'Texas' },
  { id: 'aaaaaaaa-3333-4333-8333-333333333333', slug: 'lower-name', state: 'texas' },
  { id: 'aaaaaaaa-4444-4444-8444-444444444444', slug: 'padded-name', state: '  Texas  ' },
  { id: 'aaaaaaaa-5555-4555-8555-555555555555', slug: 'lower-code', state: 'tx' },
  { id: 'aaaaaaaa-6666-4666-8666-666666666666', slug: 'two-word-name', state: 'New York' },
  { id: 'aaaaaaaa-7777-4777-8777-777777777777', slug: 'blank', state: '' },
  { id: 'aaaaaaaa-8888-4888-8888-888888888888', slug: 'other-code', state: 'CA' },
];

let testDb: TestDatabase;

async function apply(tag: string): Promise<void> {
  for (const statement of statementsOf(tag)) {
    await testDb.db.execute(sql.raw(statement));
  }
}

async function replayThrough(tag: string): Promise<void> {
  const stop = ENTRIES.findIndex((entry) => entry.tag === tag);
  expect(stop, `${tag} is missing from the migration journal`).toBeGreaterThanOrEqual(0);

  for (const entry of ENTRIES.slice(0, stop + 1)) {
    await apply(entry.tag);
  }
}

async function stateOf(slug: string): Promise<string | null> {
  const result = await testDb.db.execute(
    sql.raw(`SELECT state FROM vendor_profiles WHERE slug = '${slug}'`),
  );
  return (result.rows[0] as { state: string | null }).state;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await replayThrough('0017_same_khan');

  for (const vendor of VENDORS) {
    await testDb.db.execute(
      sql.raw(
        `INSERT INTO users (id, clerk_user_id, email, role, first_name, last_name)
         VALUES ('${vendor.id}', 'user_${vendor.slug}', '${vendor.slug}@example.com',
                 'vendor', 'Wren', 'Field')`,
      ),
    );
    await testDb.db.execute(
      sql.raw(
        `INSERT INTO vendor_profiles (id, user_id, business_name, slug, city, state)
         VALUES ('${vendor.id}', '${vendor.id}', '${vendor.slug}', '${vendor.slug}',
                 'Austin', '${vendor.state}')`,
      ),
    );
  }
});

afterAll(async () => {
  await testDb.close();
});

describe(`${REPAIR} + ${CAST}`, () => {
  it('starts from a database that really holds the split', async () => {
    // Guards the fixture: if these are already codes the repair proves nothing.
    expect(await stateOf('full-name')).toBe('Texas');
    expect(await stateOf('lower-code')).toBe('tx');
    expect(await stateOf('blank')).toBe('');
  });

  it('normalises every spelling to its code, then casts the column', async () => {
    await apply(REPAIR);
    await apply(CAST);

    expect(await stateOf('already-a-code')).toBe('TX');
    expect(await stateOf('full-name')).toBe('TX');
    expect(await stateOf('lower-name')).toBe('TX');
    expect(await stateOf('padded-name')).toBe('TX');
    expect(await stateOf('lower-code')).toBe('TX');
    expect(await stateOf('two-word-name')).toBe('NY');
    expect(await stateOf('other-code')).toBe('CA');
  });

  /*
   * An empty string is not a state, and it already meant "unset" everywhere
   * that read it. Left alone it would have failed the cast.
   */
  it('turns a blank into NULL rather than guessing at it', async () => {
    expect(await stateOf('blank')).toBeNull();
  });

  it('leaves the column as the us_state enum, so the split cannot reopen', async () => {
    const result = await testDb.db.execute(
      sql.raw(
        `SELECT data_type, udt_name FROM information_schema.columns
          WHERE table_name = 'vendor_profiles' AND column_name = 'state'`,
      ),
    );

    expect(result.rows[0]).toMatchObject({ data_type: 'USER-DEFINED', udt_name: 'us_state' });
  });

  it('refuses a value outside the vocabulary once the type is in place', async () => {
    await expect(
      testDb.db.execute(
        sql.raw(`UPDATE vendor_profiles SET state = 'Texas' WHERE slug = 'full-name'`),
      ),
    ).rejects.toThrow();
  });
});
