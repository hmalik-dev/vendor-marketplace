import { createTestDatabase } from '@vendor-marketplace/db/testing';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { violatesUniqueConstraint } from './constraint-violation.js';

/*
 * #399, #462, VEN-385. Every case that decides whether the reader recognises a
 * violation takes the error from a real driver rather than a hand-built object,
 * because a hand-built one spells the constraint field however the code under
 * test expects — which is how a guard reading a spelling no driver writes
 * passed every suite. This is the PGlite half, which spells it `constraint`;
 * `constraint-violation.contention.test.ts` is the postgres.js half.
 *
 * The hand-built cases below only ever expect `false`: they pin what the
 * reader refuses, which no spelling mistake can make pass.
 */
describe('violatesUniqueConstraint', () => {
  it('recognises a real unique violation raised through Drizzle on PGlite', async () => {
    const database = await createTestDatabase();

    try {
      await database.db.execute(sql`create table probe (a int constraint probe_a_key unique)`);
      await database.db.execute(sql`insert into probe values (1)`);

      const thrown = await database.db
        .transaction(async (tx) => {
          await tx.execute(sql`insert into probe values (1)`);
        })
        .catch((error: unknown) => error);

      expect((thrown as { cause?: Record<string, unknown> }).cause).toMatchObject({
        code: '23505',
        constraint: 'probe_a_key',
      });
      expect(violatesUniqueConstraint(thrown, 'probe_a_key')).toBe(true);
      expect(violatesUniqueConstraint(thrown, 'some_other_key')).toBe(false);
      // The name is not in the wrapper's message, so nothing here reads it.
      expect((thrown as Error).message).not.toContain('probe_a_key');
    } finally {
      await database.close();
    }
  });

  it('refuses a different SQLSTATE on the same constraint', () => {
    expect(
      violatesUniqueConstraint(
        { code: '40P01', constraint_name: 'users_email_key' },
        'users_email_key',
      ),
    ).toBe(false);
  });

  /**
   * **The discriminating case.** A deadlock on a statement whose bound values
   * happen to contain the index's name is not a collision, and answering that
   * it is means recording a fabricated divergence and telling the webhook
   * sender to stop retrying something that deserved a retry.
   */
  it('is not fooled by the constraint name appearing in a bound value', () => {
    const deadlock = new Error(
      'Failed query: update "users" set "email" = $1\nparams: users_email_key@example.com',
      {
        cause: new Error('duplicate key value violates unique constraint "users_email_key"', {
          cause: { code: '40P01' },
        }),
      },
    );

    expect(violatesUniqueConstraint(deadlock, 'users_email_key')).toBe(false);
  });

  it('says no to anything else, including a cycle', () => {
    const looping: { cause?: unknown } = {};
    looping.cause = looping;

    expect(violatesUniqueConstraint(looping, 'anything')).toBe(false);
    expect(violatesUniqueConstraint(null, 'anything')).toBe(false);
    expect(violatesUniqueConstraint(new Error('unrelated'), 'anything')).toBe(false);
  });
});
