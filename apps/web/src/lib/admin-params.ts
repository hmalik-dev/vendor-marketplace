import { MAX_NAME_LENGTH, MAX_PAGE } from '@vendor-marketplace/shared';

/**
 * The `/admin` route boundary.
 *
 * `searchParams` is attacker-controlled string data, and the console forwards it
 * to an API that validates with Zod — so an out-of-range `page` or an unknown
 * `status` would come back 400 and render the 500 page for a URL anyone can
 * paste. Every value is therefore narrowed here and an unusable one is
 * **dropped**, which renders the screen unfiltered rather than failing it. See
 * `.claude/rules/web-route-boundaries.md`.
 */

/** A member of a closed vocabulary, or nothing. Never the raw string. */
export function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

/**
 * A free-text filter, bounded by the same cap the API enforces.
 *
 * Truncated rather than dropped: somebody who pasted 400 characters into the
 * search box meant to search, and the first hundred is a far better answer than
 * silently clearing the field.
 */
export function boundedText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

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
export function pageNumber(value: string | undefined): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE) {
    return 1;
  }

  return parsed;
}
