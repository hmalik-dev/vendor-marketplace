import { retiredCategorySuccessor } from '@vendor-marketplace/shared';

/**
 * The `/search` route boundary.
 *
 * `searchParams` is attacker-controlled — see
 * `.claude/rules/web-route-boundaries.md`. What lives here is only the part
 * `/search` has to answer **before** it renders: a link to a category the
 * taxonomy has retired. Everything the shell itself reads is narrowed in
 * `components/search/search-state.ts`, which owns the filter state.
 *
 * It is a module rather than a helper inside `app/search/page.tsx` because
 * Next.js allows a page file only its own reserved exports, so a named export
 * beside `default` fails the route's generated types.
 */

/**
 * What Next actually hands a page for one key.
 *
 * **`string[]`, not `string`.** A repeated key — `?category=a&category=b` —
 * arrives as an array, and typing it as `string` hides that from TypeScript
 * entirely: a string method called on an array is a `TypeError` during the
 * server render, which is the 500 page. `admin-params.ts` carries the same
 * type and records the two times this has already bitten the repo.
 */
export type RawParam = string | string[] | undefined;
export type SearchParams = Record<string, RawParam>;

/** The first value for a key. A repeated parameter is one intent, not several. */
function first(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Where a link to a category the taxonomy has retired should land, or `null`
 * when there is nothing to move — the category is live, unknown, or absent.
 *
 * An unknown slug is deliberately left alone: search already explains an empty
 * result set and names the filter, and guessing a destination for a slug that
 * was never shipped would send the visitor somewhere they did not ask to go.
 *
 * Every other parameter is carried across verbatim, because the city, date and
 * tags in a shared link are still exactly the question that was asked, and
 * `URLSearchParams` is what encodes them rather than string concatenation.
 */
export function successorSearchPath(params: SearchParams): string | null {
  const successor = retiredCategorySuccessor(first(params.category));

  if (successor === null) {
    return null;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'category' || value === undefined) {
      continue;
    }
    for (const single of Array.isArray(value) ? value : [value]) {
      query.append(key, single);
    }
  }
  query.append('category', successor);

  return `/search?${query.toString()}`;
}
