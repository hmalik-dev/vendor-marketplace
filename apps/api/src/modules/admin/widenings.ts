import { sql, type SQL } from 'drizzle-orm';
import type { FilterWidening } from '@vendor-marketplace/shared';

/**
 * How many rows dropping exactly one active filter would reveal, for every
 * active filter, in **one** round trip (#454).
 *
 * Drawn by Pattern A of the admin delta: a filtered-empty console list offers
 * one way out per filter and each carries its own number, so an operator picks
 * the widening that pays rather than clearing everything and rebuilding the
 * query. **A route that would reveal zero is never offered**, which is why the
 * count has to exist before the button is drawn — a shape that discovered the
 * number by following the link could not satisfy that at all.
 *
 * ## Why the scan is unfiltered
 *
 * Dropping a filter *widens*, so the rows being counted are by definition
 * outside the current `WHERE`. There is no filtered scan that contains them.
 * What makes this one query rather than N is the aggregate: one
 * `count(*) filter (where <every condition except this one>)` per key, over a
 * single pass.
 *
 * The cost is real and is paid exactly once, on the one screen state that has
 * nothing else to render — a list that came back empty **and** has filters
 * applied. Every other response carries `[]` and runs none of this.
 *
 * ## Why the caller passes a builder rather than conditions
 *
 * `conditionWithout(key)` re-derives the whole predicate with one key removed,
 * using the screen's own existing condition builder. The alternative — handing
 * this a list of per-key `SQL` fragments and `AND`-ing all but one — would be a
 * second implementation of each screen's filter semantics, and the two would
 * drift on the first filter that is not a plain equality. `/admin/vendors`
 * already has three of those: a three-column `ILIKE`, a many-to-many `EXISTS`,
 * and a payout predicate spanning two tables.
 */
export interface WideningScan<K extends string> {
  /** The filter keys currently narrowing the view. Empty means no widenings. */
  active: readonly K[];
  /** The screen's own predicate, rebuilt with `dropped` removed. */
  conditionWithout: (dropped: K) => SQL | undefined;
  /**
   * Runs the aggregate select over this screen's table and joins.
   *
   * The caller owns the `FROM`, because a widening count has to see the same
   * rows the list does — `/admin/vendors` counts `vendor_profiles ⋈ users`, and
   * a helper that guessed the table would count the wrong set.
   */
  scan: (selection: Record<K, SQL<number>>) => Promise<Record<K, number>[]>;
}

/**
 * `count(*)` with no condition, for the key whose removal leaves nothing behind.
 *
 * A screen can be filtered by exactly one thing, and dropping it leaves an
 * unconditional count rather than a `filter (where true)` that Postgres would
 * rather not parse.
 */
function countWhere(condition: SQL | undefined): SQL<number> {
  return condition
    ? sql<number>`count(*) filter (where ${condition})::int`
    : sql<number>`count(*)::int`;
}

/**
 * The widenings for one filtered-empty list.
 *
 * Returns `[]` when nothing is filtered — there is no way out to offer from a
 * list that is empty because the platform has no rows, and the delta is
 * explicit that a true empty carries **no button**: nothing an operator does
 * creates a case or an activity row, so a control there would offer an action
 * that cannot help.
 *
 * Zero-count routes are dropped **here**, on the server, rather than in the
 * component. Both would work; doing it here means the count that decides it and
 * the count that is displayed are the same number, and a surface cannot render
 * a button the API believed would reveal nothing.
 */
export async function countWidenings<K extends string>({
  active,
  conditionWithout,
  scan,
}: WideningScan<K>): Promise<FilterWidening[]> {
  if (active.length === 0) {
    return [];
  }

  const selection = Object.fromEntries(
    active.map((key) => [key, countWhere(conditionWithout(key))]),
  ) as Record<K, SQL<number>>;

  const rows = await scan(selection);
  const counts = rows[0];

  if (!counts) {
    return [];
  }

  return active
    .map((key) => ({ key: key as string, count: Number(counts[key] ?? 0) }))
    .filter((widening) => widening.count > 0);
}
