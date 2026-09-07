import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * `0031` against a database that already holds acceptances — acceptance 3.
 *
 * The other suites migrate to head and then write rows, which proves nothing
 * about the rows that were **already there**: those are the ones a migration
 * can damage, and the two columns `0031` adds are `NOT NULL` on a table that is
 * not empty in any real environment. Reading the DDL cannot answer it either,
 * because the interesting question is what the existing row *says* afterwards.
 *
 * So this runs the migrations in journal order, stops before `0031`, writes a
 * row in the shape `0029` accepted, and only then applies `0031`.
 *
 * **The backfill could not have been an `UPDATE`**, which is the other thing
 * this pins: the immutability trigger `0029` installs refuses every update on
 * this table, so a backfill statement would have failed outright. `ADD COLUMN
 * ... DEFAULT` is DDL and fires no row trigger; the default is then dropped so
 * every future writer must state both values.
 */
const THIS_MIGRATION = '0031_fat_randall';

/**
 * The hash `0031` backfills.
 *
 * Pinned to the **migration**, deliberately, rather than read from
 * `legalDocumentSha256('vendor_agreement')`: what this asserts is what that one
 * DDL statement wrote, and a future version bump moves the manifest without
 * moving a single already-migrated row. Reading the constant here would make
 * the assertion follow the thing it is supposed to be independent of.
 */
const AGREEMENT_SHA = 'f32236c9778dc6a20818fe74fb150ee9e7159b2519253b6686185fd6c60249f2';

const USER = '77777777-7777-4777-8777-777777777777';
const VENDOR = '88888888-8888-4888-8888-888888888888';

let testDb: TestDatabase;

/** Applies one migration file the way the migrator does. */
async function applyMigration(tag: string): Promise<void> {
  const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8');

  for (const statement of body.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) {
      await testDb.db.execute(sql.raw(statement));
    }
  }
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  // Throws if the tag is not in the journal, so a rename cannot make this a no-op.
  await testDb.migrateUpTo(THIS_MIGRATION);
});

afterAll(async () => {
  await testDb.close();
});

describe('0031 against a database that already holds acceptances', () => {
  it('leaves the existing acceptance readable, with the columns it was written with', async () => {
    await testDb.db.execute(
      sql.raw(`INSERT INTO users (id, clerk_user_id, email, role, first_name, last_name)
               VALUES ('${USER}', 'user_legacy', 'legacy@example.com', 'vendor', 'June', 'Harlow')`),
    );
    await testDb.db.execute(
      sql.raw(`INSERT INTO vendor_profiles (id, user_id, business_name, slug)
               VALUES ('${VENDOR}', '${USER}', 'June Harlow Photography', 'june-harlow-legacy')`),
    );
    /*
     * The `0029` shape exactly: no hash, no method, and a `vendor_id` that was
     * `NOT NULL` at the time. Written as raw SQL rather than through the schema
     * because the schema is the *new* shape — inserting through it would be
     * writing a post-migration row and calling it a legacy one.
     */
    await testDb.db.execute(
      sql.raw(`INSERT INTO legal_acceptances
                 (vendor_id, document, version, accepted_by_user_id, accepted_by_name,
                  business_name, ip, user_agent)
               VALUES ('${VENDOR}', 'vendor_agreement', 'v1.0', '${USER}', 'June Harlow',
                       'June Harlow Photography', '203.0.113.7', 'Mozilla/5.0')`),
    );

    await applyMigration(THIS_MIGRATION);

    const result = await testDb.db.execute(
      sql.raw(`SELECT vendor_id, document, version, accepted_by_name, business_name, ip,
                      user_agent, document_sha256, acceptance_method
               FROM legal_acceptances`),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      vendor_id: VENDOR,
      document: 'vendor_agreement',
      version: 'v1.0',
      accepted_by_name: 'June Harlow',
      business_name: 'June Harlow Photography',
      ip: '203.0.113.7',
      user_agent: 'Mozilla/5.0',
      document_sha256: AGREEMENT_SHA,
      acceptance_method: 'clickwrap_checkbox',
    });
  });

  /**
   * The default is dropped, so the migration's convenience does not become a
   * writer's licence: a row inserted afterwards has to state both values or the
   * insert fails.
   */
  it('leaves no default behind for the next writer to lean on', async () => {
    await expect(
      testDb.db.execute(
        sql.raw(`INSERT INTO legal_acceptances
                   (vendor_id, document, version, accepted_by_user_id, accepted_by_name)
                 VALUES ('${VENDOR}', 'vendor_agreement', 'v2.0', '${USER}', 'June Harlow')`),
      ),
    ).rejects.toThrow();
  });

  /** And the migrated row is still protected, by the rule `0031` replaced. */
  it('still refuses to let the migrated row be deleted or edited', async () => {
    await expect(
      testDb.db.execute(sql.raw(`DELETE FROM legal_acceptances WHERE vendor_id = '${VENDOR}'`)),
    ).rejects.toThrow();

    await expect(
      testDb.db.execute(sql.raw(`UPDATE legal_acceptances SET version = 'v9.9'`)),
    ).rejects.toThrow();
  });
});
