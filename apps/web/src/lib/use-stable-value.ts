'use client';

import { useMemo } from 'react';

/**
 * The same value, with an identity that changes only when its contents do.
 *
 * **Why this exists.** Three controls in this app hold a *draft* of a value
 * their parent owns — the search bar's query segments, the price range panel,
 * the tag multi-select — and each re-seeds that draft from a `value` prop in an
 * effect. Every one of those parents builds the prop fresh on each render:
 * `{ category, city, state, date }`, `{ min, max }`, `chosen.map((t) => t.id)`.
 * Keyed on the object, the effect therefore re-ran on renders the value had
 * nothing to do with — and under an open panel, a search result landing
 * (`setResult`, `setIsLoading`, `setSearching(false)`, three renders) discarded
 * whatever the customer had just typed or ticked, silently. #403.
 *
 * **Why a hook rather than enumerating the fields.** `[open, value.min,
 * value.max]` fixes one call site and goes stale the moment a third bound is
 * added: no lint error, no failing test, just a field the re-seed stops
 * carrying. The serialized key cannot go stale, and it is written once here
 * instead of three times with three comments explaining the same defect.
 *
 * `JSON.stringify` because these values are small, plain and JSON-shaped —
 * a handful of strings, two nullable numbers, a list of ids. It is not a
 * general-purpose deep-equality hook and should not be used as one; a value
 * holding a `Date`, a `Map` or a function needs a different key.
 */
export function useStableValue<T>(value: T): T {
  const key = JSON.stringify(value);

  // `value` is reached through `key`, which changes exactly when its contents
  // do. Depending on `value` itself is the defect this hook exists to remove.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => value, [key]);
}
