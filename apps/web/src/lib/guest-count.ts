import { MAX_GUEST_COUNT } from '@vendor-marketplace/shared';

/**
 * Narrows an untrusted `?guests=` to the digit string the booking form holds,
 * or to empty.
 *
 * `.claude/rules/web-route-boundaries.md`: a URL value is parsed at the
 * boundary and **dropped** rather than rendered when it fails, because a
 * Server Component that formats one unvalidated returns a 500 for a link
 * anyone can paste. The round-trip comparison is what rejects the shapes
 * `Number.parseInt` would otherwise accept by prefix — `120abc`, `" 120"`,
 * `+120`, `0120`, `1e3` — and the bounds match the ones the form itself
 * enforces, so a value that survives here cannot fail validation there.
 */
export function parseGuestCountParam(value: string | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) &&
    String(parsed) === value &&
    parsed > 0 &&
    parsed <= MAX_GUEST_COUNT
    ? String(parsed)
    : '';
}
