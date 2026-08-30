import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The ticket's acceptance asks for the concurrent double-insert case to be
 * asserted, and **this file cannot assert it**, so it says what it does assert
 * instead of pretending.
 *
 * The route suites run on PGlite, which is one in-process connection: two
 * transactions cannot overlap in it, so no test in this package can observe the
 * interleaving that produces the defect. What can be checked is the mechanism
 * that prevents it, read out of the source — the class-level fact, in the terms
 * `.claude/rules/web-design-parity.md` uses for exactly this situation.
 *
 * The runtime behaviour was measured separately, against the real
 * `postgres:18-alpine` this project runs locally, with two connections and the
 * lock held 60ms: the aggregate-inside-`SET` strategy stored the wrong total
 * **5 times out of 5** (2 rows present, `count` stored as 1, average 3.00 where
 * the truth was 4.00), and the lock-then-aggregate strategy stored the right
 * one 5 times out of 5, with no deadlock against the foreign key's own
 * `FOR KEY SHARE`. That measurement is recorded on #12; this guard is what
 * stops the fix being undone silently afterwards.
 */
const DAO = readFileSync(join(import.meta.dirname, 'reviews.dao.ts'), 'utf8');

/** One function body, by name, up to the start of the next declaration. */
function body(name: string): string {
  const start = DAO.indexOf(`async function ${name}(`);
  expect(start, `${name} is missing from reviews.dao.ts`).toBeGreaterThan(-1);

  const next = DAO.indexOf('\nasync function ', start + 1);
  return DAO.slice(start, next === -1 ? DAO.length : next);
}

describe('the rating recompute is serialised, not merely re-derived', () => {
  /*
   * `FOR UPDATE` would conflict with the `FOR KEY SHARE` the review insert has
   * already taken on this same row for its foreign key — in both transactions —
   * so two reviewers would deadlock instead of queueing. `FOR NO KEY UPDATE`
   * conflicts only with itself, which is the pair that must not overlap.
   */
  it('takes FOR NO KEY UPDATE, never the stronger lock that would deadlock', () => {
    const lock = body('lockForRecompute');

    expect(lock).toContain(`.for('no key update')`);
    expect(lock).not.toContain(`.for('update')`);
  });

  /*
   * The whole defect in one line: an aggregate written into the `UPDATE`'s own
   * `SET` clause is evaluated against the snapshot the blocked statement took
   * before the writer ahead of it committed.
   */
  it.each(['recalculateVendorRating', 'recalculateCustomerRating'])(
    '%s locks first and aggregates in a separate statement',
    (name) => {
      const fn = body(name);

      const lockAt = fn.indexOf('lockForRecompute');
      const aggregateAt = fn.indexOf('count(*)::int');
      const updateAt = fn.indexOf('.update(');

      expect(lockAt, 'no row lock before the recompute').toBeGreaterThan(-1);
      expect(aggregateAt, 'no aggregate read').toBeGreaterThan(aggregateAt - 1);
      // Lock, then read the totals, then write them. In that order.
      expect(lockAt).toBeLessThan(aggregateAt);
      expect(aggregateAt).toBeLessThan(updateAt);
    },
  );

  it('never puts an aggregate back inside the UPDATE it writes', () => {
    for (const name of ['recalculateVendorRating', 'recalculateCustomerRating']) {
      const fn = body(name);
      const setClause = fn.slice(fn.indexOf('.set({'), fn.indexOf('.where('));

      expect(setClause, `${name} aggregates inside its SET clause`).not.toMatch(
        /\b(avg|count)\s*\(/,
      );
    }
  });
});
