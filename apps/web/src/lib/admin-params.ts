import { MAX_NAME_LENGTH, MAX_PAGE } from '@vendor-marketplace/shared';

/**
 * The `/admin` route boundary.
 *
 * `searchParams` is attacker-controlled, and the console forwards it to an API
 * that validates with Zod — so an out-of-range `page` or an unknown `status`
 * would come back 400 and render the 500 page for a URL anyone can paste. Every
 * value is narrowed here and an unusable one is **dropped**, which renders the
 * screen unfiltered rather than failing it. See
 * `.claude/rules/web-route-boundaries.md`.
 */

/**
 * What Next actually hands a page for one key.
 *
 * **`string[]`, not `string`.** A repeated key — `?q=a&q=b` — arrives as an
 * array, and typing the prop as `string` hides that from TypeScript entirely:
 * `value.trim()` on an array is a `TypeError` during the server render, which
 * is the 500 page. `/bookings` and `/messages` each carry a `first()` helper
 * because this has already happened twice in this repo; every reader below
 * takes this type so it cannot happen a third time here.
 */
export type RawParam = string | string[] | undefined;

/** The first value for a key. A repeated parameter is one intent, not several. */
function first(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A member of a closed vocabulary, or nothing. Never the raw string. */
export function oneOf<T extends string>(value: RawParam, allowed: readonly T[]): T | undefined {
  const raw = first(value);

  return allowed.find((candidate) => candidate === raw);
}

/**
 * A free-text filter, bounded by the same cap the API enforces.
 *
 * Truncated rather than dropped: somebody who pasted 400 characters into the
 * search box meant to search, and the first hundred is a far better answer than
 * silently clearing the field.
 */
export function boundedText(value: RawParam): string | undefined {
  const trimmed = first(value)?.trim();

  return trimmed ? trimmed.slice(0, MAX_NAME_LENGTH) : undefined;
}

/**
 * A page number in `[1, MAX_PAGE]`.
 *
 * Anything else is page 1. `?page=0`, `?page=-3`, `?page=abc` and
 * `?page=2147483648` all reached the DAO before this existed; the last one
 * overflowed `int4` in the offset arithmetic, which is why the API bounds it
 * above as well as below.
 */
export function pageNumber(value: RawParam): number {
  const parsed = Number(first(value));

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE) {
    return 1;
  }

  return parsed;
}

/**
 * The line the screen shows when it ignored something in the URL.
 *
 * `web-route-boundaries.md` asks for the filter to be dropped **and said** —
 * rendering the unfiltered list in silence tells an operator the platform holds
 * data it does not. `/search` says the same thing through
 * `clearedParamsLine`; this is the console's version, worded for an operator
 * rather than a customer.
 */
export function droppedFiltersLine(dropped: readonly string[]): string | null {
  if (dropped.length === 0) {
    return null;
  }

  const named =
    dropped.length === 1 ? dropped[0] : `${dropped.slice(0, -1).join(', ')} and ${dropped.at(-1)}`;

  return `Ignored ${named} in the address — ${dropped.length === 1 ? 'it is not a value' : 'they are not values'} this list can filter by.`;
}

/**
 * Every key whose value was present but unusable.
 *
 * Compares what arrived against what survived narrowing, so a caller states the
 * mapping once rather than tracking drops by hand at each `oneOf`.
 */
export function droppedKeys(
  raw: Record<string, RawParam>,
  parsed: Record<string, string | undefined>,
): string[] {
  return Object.keys(parsed).filter((key) => {
    const supplied = first(raw[key]);

    return supplied !== undefined && supplied !== '' && parsed[key] === undefined;
  });
}

/**
 * A filter set as a query string, with empty values dropped.
 *
 * The one rule for "which values reach the URL", so the filter links, the
 * pager and the CSV export cannot disagree about it — a pager that kept a
 * different set from the tab strip above it would page from "the flagged
 * vendors" to "everything" without saying so.
 *
 * It lives here rather than in `admin-data.ts` because it is pure: that module
 * pulls in `@clerk/nextjs/server`, which a component must not import to build
 * a link.
 */
export function adminQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  const query = search.toString();

  return query ? `?${query}` : '';
}

/**
 * A vendor's rating as the console shows it, or `null` when there is none.
 *
 * A vendor with no reviews has no rating, and `0.0` reads as a bad one. Written
 * once because the table and the CSV export both make this call, and a table
 * that says `—` beside an export that says `0.0` is two answers to one question.
 */
export function displayRating(row: { avgRating: string; reviewCount: number }): string | null {
  return row.reviewCount === 0 ? null : Number(row.avgRating).toFixed(1);
}
