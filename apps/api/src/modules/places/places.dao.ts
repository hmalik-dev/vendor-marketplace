import { asc, desc, sql } from 'drizzle-orm';
import { usCities } from '@vendor-marketplace/db/schema';
import {
  normaliseForMatch,
  PLACE_SUGGESTION_LIMIT,
  type PlaceSuggestion,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { escapeLikePattern } from '../../lib/like-pattern.js';

/**
 * The places matching what a customer has typed, best first.
 *
 * **Two tiers, and they are the ones the client used to compute.** #375 ranked
 * a preloaded list in the browser with `rankCityMatches`; #384 put the list
 * behind a request, so the ranking had to move with it — otherwise the eight
 * rows that come back are an arbitrary eight and the browser has nothing to
 * re-rank them against.
 *
 * 1. The **city name** starts with what was typed. `aus` means `Austin`, not
 *    every place with `aus` somewhere inside it.
 * 2. `city, st` contains it anywhere. This is what makes `austin, tx` work at
 *    all — the needle spans the label's own separator — and it is the only way
 *    a customer tells two same-named cities apart by typing.
 *
 * Within a tier, **population descending**, then name and state so the order is
 * total and two identical requests cannot answer differently. Population
 * replaces the `vendorCount` tier the user's instruction removed, and it does
 * the same job that tier did: `Portland, OR` leads `Portland, ME` because it is
 * the one more people mean, not because we have more vendors there. It is not
 * selected, so it cannot reach a screen.
 */
export async function findPlaceSuggestions(
  db: AppDatabase,
  query: string,
  limit: number = PLACE_SUGGESTION_LIMIT,
): Promise<PlaceSuggestion[]> {
  /*
   * The shared escape, not a local one. Unescaped, a customer typing a single
   * `%` would match every place in the country — the preloaded list this ticket
   * removed, handed back by the endpoint that replaced it. `like-pattern.ts`
   * exists because that fix was made twice before.
   */
  const needle = escapeLikePattern(normaliseForMatch(query));

  if (needle === '') {
    return [];
  }

  /*
   * `search_name` was normalised by the seed with the same shared function
   * applied to the needle above — that agreement is the whole reason the column
   * is stored. The state is lowercased in SQL because the enum holds it
   * upper-case and a second stored column would be one more thing to keep in
   * step for one comparison.
   *
   * `escape '\\'` is Postgres's own default and so changes nothing — it is
   * written out to match `containsInsensitive` in `like-pattern.ts`, which
   * declares it explicitly. A reader comparing the two should not have to know
   * the default to satisfy themselves that the escaping above is in force.
   */
  const startsWith = sql<boolean>`${usCities.searchName} like ${`${needle}%`} escape '\\'`;
  const contains = sql<boolean>`${usCities.searchName} || ', ' || lower(${usCities.state}::text) like ${`%${needle}%`} escape '\\'`;

  const rank = [desc(usCities.population), asc(usCities.name), asc(usCities.state)] as const;

  /*
   * **Tier 1 on its own first, because it is the only one an index can serve.**
   *
   * `search_name LIKE 'aus%'` is a prefix over a stored column, so
   * `us_cities_search_name_prefix_idx` answers it with an index scan. Tier 2 is
   * a leading wildcard over a *concatenated expression*, which is unindexable
   * by construction and reads all 35,618 rows. Measured on the committed
   * dataset: 13 buffers against 261, and 0.4ms against 45ms.
   *
   * Skipping tier 2 is safe rather than approximate. The combined ordering puts
   * **every** prefix match ahead of **every** substring match, and orders
   * within tier 1 by exactly `rank` — so when tier 1 alone fills the page, its
   * rows *are* the first `limit` rows of the combined query, in the same order.
   * Anything less than a full page and the fall-through below runs the combined
   * query and the two tiers interleave as they always did.
   */
  const prefixMatches = await db
    .select({ city: usCities.name, state: usCities.state })
    .from(usCities)
    .where(startsWith)
    .orderBy(...rank)
    .limit(limit);

  if (prefixMatches.length >= limit) {
    return prefixMatches;
  }

  /*
   * `contains` alone selects both tiers: a prefix of `search_name` is
   * necessarily a substring of `search_name || ', ' || state`, so an `OR` with
   * `startsWith` would add no row — and could not use the index either, since a
   * scan is still needed for the other half. The tier lives in the ordering,
   * which is the only place it changes an answer: Postgres sorts `false` before
   * `true`, so `desc(startsWith)` **is** the two tiers, built from the same
   * boolean rather than from a `CASE` beside it.
   */
  return db
    .select({ city: usCities.name, state: usCities.state })
    .from(usCities)
    .where(contains)
    .orderBy(desc(startsWith), ...rank)
    .limit(limit);
}
