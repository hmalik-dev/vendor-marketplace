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

/**
 * The same bounds, for a value a person is **typing** rather than one arriving
 * in a URL. Returns the number, or `null` when it is not a guest count.
 *
 * Deliberately looser than `parseGuestCountParam` in exactly one way: a leading
 * zero is accepted, because `050` is a whole number somebody typed and
 * refusing it under the message "has to be a whole number of people" would
 * contradict itself. `<input type="number">` keeps `050` in the field where it
 * blanks `+120` and `" 120"`, so it is the one non-canonical shape a form
 * actually sees. Everything the prefix parse used to let through — `2.7`,
 * `1e21`, `120abc` — is still refused, which is #412's finding.
 *
 * The URL boundary stays strict: there a non-canonical value is a stale or
 * hand-made link, not a keystroke.
 */
export function guestCountFromInput(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  return parsed > 0 && parsed <= MAX_GUEST_COUNT ? parsed : null;
}
