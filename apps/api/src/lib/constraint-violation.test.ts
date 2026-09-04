import { createTestDatabase } from '@vendor-marketplace/db/testing';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { violatesConstraint } from './constraint-violation.js';

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
