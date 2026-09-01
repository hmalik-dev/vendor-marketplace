import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * #381's constraint, exercised against the SQL that ships.
 *
 * The two halves are separate migrations and the order is the whole point:
 * `0021` adds a CHECK that Postgres validates against every existing row, and
 * it fails outright on the row that motivated the ticket — `stripe_onboarded`
 * true with no `stripe_account_id`. `0020` is what clears them. Run against an
 * empty database, as every migration is in a fresh checkout, neither half meets
 * a single orphan row, so the ordering that matters in production is exactly
 * what the ordinary suite cannot observe.
 *
 * So the fixture is built at the schema `0019` left, by replaying the journal up
 * to it, and the assertions are about what survives: the orphan is stood down
 * to `false` and keeps its null id, the two rows that were already consistent
 * are untouched, and afterwards the pair cannot be split again in either
 * direction.
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

const ORPHAN = '11111111-1111-4111-8111-111111111111';
const CONNECTED = '22222222-2222-4222-8222-222222222222';
const UNSTARTED = '33333333-3333-4333-8333-333333333333';

/*
 * PGlite parses one statement per call, so the fixture is a list rather than a
 * script. Ids are fixed so a failure names the row it is talking about.
 *
 * Three vendors, and only one of them impossible. The other two are what proves
 * the repair is scoped to the contradiction rather than clearing the column.
 */
const FIXTURE: readonly string[] = [
  `INSERT INTO users (id, clerk_user_id, email, role, first_name, last_name) VALUES
     ('${ORPHAN}', 'user_orphan', 'orphan@example.com', 'vendor', 'Wren', 'Field'),
     ('${CONNECTED}', 'user_connected', 'connected@example.com', 'vendor', 'Mara', 'Voss'),
     ('${UNSTARTED}', 'user_unstarted', 'unstarted@example.com', 'vendor', 'Ida', 'Roos')`,
  // The row `be02b46` fixed one instance of: onboarding asserted, nothing to pay into.
  `INSERT INTO vendor_profiles (id, user_id, business_name, slug, stripe_account_id, stripe_onboarded)
   VALUES ('${ORPHAN}', '${ORPHAN}', 'Wren & Field', 'wren-field', NULL, true)`,
  `INSERT INTO vendor_profiles (id, user_id, business_name, slug, stripe_account_id, stripe_onboarded)
   VALUES ('${CONNECTED}', '${CONNECTED}', 'Voss Studio', 'voss-studio', 'acct_1RealLooking', true)`,
  // Mid-onboarding: an account exists, Stripe has not confirmed it. Always legal.
  `INSERT INTO vendor_profiles (id, user_id, business_name, slug, stripe_account_id, stripe_onboarded)
   VALUES ('${UNSTARTED}', '${UNSTARTED}', 'Roos Floral', 'roos-floral', 'acct_2InProgress', false)`,
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

/**
 * Run a statement that must be refused, and return what Postgres actually said.
 *
 * Drizzle wraps a driver error in a `DrizzleQueryError` whose message is only
 * the echoed SQL — asserting on that would pass for *any* failure, including a
 * typo in the fixture. The engine's own message is on `cause`, and it is the
 * only place the constraint name appears.
 */
async function refusalOf(statement: string): Promise<string> {
  try {
    await testDb.db.execute(sql.raw(statement));
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    return cause instanceof Error ? cause.message : String(cause ?? error);
  }

  throw new Error(`Expected the constraint to refuse this, but it succeeded:\n${statement}`);
}

interface PayoutRow {
  readonly id: string;
  readonly stripe_account_id: string | null;
  readonly stripe_onboarded: boolean;
}

async function payoutRows(): Promise<readonly PayoutRow[]> {
  const result = await testDb.db.execute(
    sql.raw(`SELECT id, stripe_account_id, stripe_onboarded
               FROM vendor_profiles ORDER BY slug`),
  );

  return result.rows.map((row) => row as unknown as PayoutRow);
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await replayThrough('0019_worried_prodigy');

  for (const statement of FIXTURE) {
    await testDb.db.execute(sql.raw(statement));
  }
});

afterAll(async () => {
  await testDb.close();
});

describe('0020_clear_orphan_stripe_onboarded + 0021_flawless_sue_storm', () => {
  it('starts from a database that really holds the impossible row', async () => {
    const before = await payoutRows();

    expect(before.find((row) => row.id === ORPHAN)).toEqual({
      id: ORPHAN,
      stripe_account_id: null,
      stripe_onboarded: true,
    });
  });

  it('stands the orphan down before the constraint is validated against it', async () => {
    await apply('0020_clear_orphan_stripe_onboarded');
    // Fails here, not in an assertion, if `0020` missed a row: Postgres
    // validates a new CHECK against the whole table.
    await apply('0021_flawless_sue_storm');

    expect(await payoutRows()).toEqual([
      // Untouched: an account id and confirmed onboarding is the ordinary state.
      { id: UNSTARTED, stripe_account_id: 'acct_2InProgress', stripe_onboarded: false },
      { id: CONNECTED, stripe_account_id: 'acct_1RealLooking', stripe_onboarded: true },
      // Cleared, and the null id kept — there is nothing to invent it from.
      { id: ORPHAN, stripe_account_id: null, stripe_onboarded: false },
    ]);
  });

  it('refuses an insert that claims onboarding without an account', async () => {
    await expect(
      testDb.db.execute(
        sql.raw(`INSERT INTO users (id, clerk_user_id, email, role, first_name, last_name)
                 VALUES ('44444444-4444-4444-8444-444444444444', 'user_new',
                         'new@example.com', 'vendor', 'Nils', 'Aro')`),
      ),
    ).resolves.toBeDefined();

    const refusal = await refusalOf(
      `INSERT INTO vendor_profiles
         (id, user_id, business_name, slug, stripe_account_id, stripe_onboarded)
       VALUES ('44444444-4444-4444-8444-444444444444',
               '44444444-4444-4444-8444-444444444444',
               'Aro Sound', 'aro-sound', NULL, true)`,
    );

    expect(refusal).toContain('vendor_profiles_stripe_onboarded_requires_account');
    expect(refusal).toContain('violates check constraint');
  });

  it('refuses onboarding a row that has no account', async () => {
    const refusal = await refusalOf(
      `UPDATE vendor_profiles SET stripe_onboarded = true WHERE id = '${ORPHAN}'`,
    );

    expect(refusal).toContain('vendor_profiles_stripe_onboarded_requires_account');
  });

  it('refuses clearing the account id out from under an onboarded row', async () => {
    // The other direction, and the one a "disconnect payouts" feature would
    // reach for first. Both columns move together or neither does.
    const refusal = await refusalOf(
      `UPDATE vendor_profiles SET stripe_account_id = NULL WHERE id = '${CONNECTED}'`,
    );

    expect(refusal).toContain('vendor_profiles_stripe_onboarded_requires_account');
  });

  it('still allows an account id without onboarding, which is mid-setup', async () => {
    await expect(
      testDb.db.execute(
        sql.raw(`UPDATE vendor_profiles SET stripe_account_id = 'acct_3Claimed'
                  WHERE id = '${ORPHAN}'`),
      ),
    ).resolves.toBeDefined();

    const row = (await payoutRows()).find((candidate) => candidate.id === ORPHAN);
    expect(row).toEqual({
      id: ORPHAN,
      stripe_account_id: 'acct_3Claimed',
      stripe_onboarded: false,
    });
  });

  it('accepts an id this repository writes on purpose that Stripe never issued', async () => {
    /*
     * `seed-demo` gives its thirteen offline vendors `acct_demo_<key>`, and
     * the API suite writes `acct_test_vendor`. Neither is Stripe-shaped, and
     * neither should be: the point of `acct_demo_` is that it cannot be
     * mistaken for a real account. This asserts the deliberate absence of a
     * format check — #387 asked for one and #381 refused it. The defect was a
     * fixture asserting onboarding it had not done, not a badly shaped id.
     */
    await expect(
      testDb.db.execute(
        sql.raw(`UPDATE vendor_profiles
                    SET stripe_account_id = 'acct_demo_wren_field', stripe_onboarded = true
                  WHERE id = '${ORPHAN}'`),
      ),
    ).resolves.toBeDefined();
  });
});
