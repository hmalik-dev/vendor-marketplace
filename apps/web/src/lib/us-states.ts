import { US_STATE_CODES, US_STATE_NAMES } from '@vendor-marketplace/shared';

/**
 * The state options the vendor location form offers.
 *
 * **The value is the two-letter USPS code and the label is the name.** The
 * form used to offer full names and store them, while most rows already held
 * codes — so `Austin, TX` and `Austin, Texas` became two places and each
 * hid the other's vendors. The vocabulary now lives once, in
 * `packages/shared/src/constants`, and `us_state` is a Postgres type, so the
 * split cannot reopen from this end.
 *
 * Ordered by name rather than by code, because the list is read alphabetically
 * by the person picking from it: `Alaska` belongs after `Alabama`, not after
 * `Arizona` — which is where sorting on `AK` would put it.
 */
export const US_STATE_OPTIONS: readonly { value: string; label: string }[] = [...US_STATE_CODES]
  .map((code) => ({ value: code, label: US_STATE_NAMES[code] }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** The name to show for a stored code, for surfaces that render one. */
export function usStateName(code: string): string {
  return US_STATE_NAMES[code as keyof typeof US_STATE_NAMES] ?? code;
}
