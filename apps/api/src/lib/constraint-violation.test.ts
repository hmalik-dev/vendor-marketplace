import { createTestDatabase } from '@vendor-marketplace/db/testing';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { violatesConstraint, violatesUniqueConstraint } from './constraint-violation.js';

/*
 * #399. `reviews.service.ts` translated a duplicate review into a 409 by
 * testing `error.message` for the constraint name — and Drizzle 0.45 stopped
 * putting it there. The wrapper's message is `Failed query: …`; the name is on
 * `cause`. So the guard silently stopped matching and a concurrent double
 * review answered 500.
 *
 * The first case is the one that matters: it takes the error from the real
 * driver rather than from a hand-built object, because a hand-built one would
 * have kept passing through the whole regression.
 */
describe('violatesConstraint', () => {
  it('recognises a real unique violation raised through Drizzle', async () => {
    const database = await createTestDatabase();

    try {
      await database.db.execute(sql`create table probe (a int constraint probe_a_key unique)`);
      await database.db.execute(sql`insert into probe values (1)`);

      const thrown = await database.db
        .transaction(async (tx) => {
          await tx.execute(sql`insert into probe values (1)`);
        })
        .catch((error: unknown) => error);

      expect(violatesConstraint(thrown, 'probe_a_key')).toBe(true);
      expect(violatesConstraint(thrown, 'some_other_key')).toBe(false);
      // The shape that broke: the constraint name is not in the message.
      expect((thrown as Error).message).not.toContain('probe_a_key');
    } finally {
      await database.close();
    }
  });

  it('still recognises an unwrapped driver error', () => {
    expect(
      violatesConstraint(
        { constraint: 'reviews_booking_reviewer_key' },
        'reviews_booking_reviewer_key',
      ),
    ).toBe(true);
  });

  it('falls back to the message when nothing carries a constraint field', () => {
    expect(
      violatesConstraint(
        new Error('duplicate key value violates unique constraint "tags_slug_key"'),
        'tags_slug_key',
      ),
    ).toBe(true);
  });

  it('says no to anything else, including a cycle', () => {
    const looping: { cause?: unknown } = {};
    looping.cause = looping;

    expect(violatesConstraint(looping, 'anything')).toBe(false);
    expect(violatesConstraint(null, 'anything')).toBe(false);
    expect(violatesConstraint(new Error('unrelated'), 'anything')).toBe(false);
  });
});

/*
 * #462. The strict reader, for the callers that **swallow** the error rather
 * than re-shaping it.
 *
 * The case that motivated it is the last one: Drizzle's wrapper message inlines
 * the bound parameters, so a value carrying the index's own name makes the
 * generous reader above answer `true` for a failure that has nothing to do with
 * that index.
 */
describe('violatesUniqueConstraint', () => {
  it('recognises a real unique violation raised through Drizzle', async () => {
    const database = await createTestDatabase();

    try {
      await database.db.execute(sql`create table probe (a int constraint probe_a_key unique)`);
      await database.db.execute(sql`insert into probe values (1)`);

      const thrown = await database.db
        .transaction(async (tx) => {
          await tx.execute(sql`insert into probe values (1)`);
        })
        .catch((error: unknown) => error);

      expect(violatesUniqueConstraint(thrown, 'probe_a_key')).toBe(true);
      expect(violatesUniqueConstraint(thrown, 'some_other_key')).toBe(false);
    } finally {
      await database.close();
    }
  });

  /**
   * `constraint_name` is postgres.js's spelling and the one production raises;
   * the suites run on PGlite, which says `constraint`. Reading only the second
   * is how a guard passes every test and matches nothing that matters.
   */
  it('reads either spelling of the constraint field', () => {
    expect(
      violatesUniqueConstraint(
        { code: '23505', constraintName: 'users_email_key' },
        'users_email_key',
      ),
    ).toBe(true);
    expect(
      violatesUniqueConstraint({ code: '23505', constraint: 'users_email_key' }, 'users_email_key'),
    ).toBe(true);
  });

  it('refuses a different SQLSTATE on the same constraint', () => {
    expect(
      violatesUniqueConstraint(
        { code: '40P01', constraintName: 'users_email_key' },
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
      { cause: { code: '40P01' } },
    );

    expect(violatesUniqueConstraint(deadlock, 'users_email_key')).toBe(false);
    // The generous reader is exactly the one that cannot tell.
    expect(violatesConstraint(deadlock, 'users_email_key')).toBe(true);
  });

  it('says no to anything else, including a cycle', () => {
    const looping: { cause?: unknown } = {};
    looping.cause = looping;

    expect(violatesUniqueConstraint(looping, 'anything')).toBe(false);
    expect(violatesUniqueConstraint(null, 'anything')).toBe(false);
  });
});
