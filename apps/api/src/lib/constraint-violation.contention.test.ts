import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createPostgresTestDatabase } from '@vendor-marketplace/db/testing/postgres';
import { violatesUniqueConstraint } from './constraint-violation.js';

/*
 * The postgres.js half of the two-driver pin; `constraint-violation.test.ts`
 * holds the PGlite half. Here because this is the driver production runs and
 * the only one that spells the field `constraint_name` — a hand-built object
 * would spell it however the code under test expects, which is how a guard
 * reading `constraintName` passed every suite and matched nothing in
 * production.
 */
describe('violatesUniqueConstraint against postgres.js', () => {
  it('recognises a real unique violation from the field the driver writes', async () => {
    const database = await createPostgresTestDatabase({ poolSize: 2 });

    try {
      await database.db.execute(sql`create table probe (a int constraint probe_a_key unique)`);
      await database.db.execute(sql`insert into probe values (1)`);

      const thrown = await database.db
        .transaction(async (tx) => {
          await tx.execute(sql`insert into probe values (1)`);
        })
        .catch((error: unknown) => error);

      // The spelling this test exists for, so a driver upgrade that renames it
      // fails here by name rather than as a mysterious `false` below.
      expect((thrown as { cause?: Record<string, unknown> }).cause).toMatchObject({
        code: '23505',
        constraint_name: 'probe_a_key',
      });
      expect(violatesUniqueConstraint(thrown, 'probe_a_key')).toBe(true);
      expect(violatesUniqueConstraint(thrown, 'some_other_key')).toBe(false);
    } finally {
      await database.close();
    }
  });
});
