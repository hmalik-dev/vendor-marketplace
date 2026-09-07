import { describe, expect, it } from 'vitest';
import { GENERIC_TRUST_COPY, TRUST_TITLES } from './landing-status';

/*
 * What is left after the status strip was removed on 2026-09-07.
 *
 * This file used to test `landingStatus` and `trustCopyFor` — the per-customer
 * derivation behind the `Next up` strip, and the booking-resolved trust copy.
 * Both are gone: a customer can have several upcoming bookings, so a single
 * "next up" implied a fact the data does not support, and the band is generic
 * in both auth states.
 *
 * The band is still worth pinning, because `page.tsx` keys each signal's glyph
 * on its title. A copy edit that changes a title silently hands the payment
 * guarantee somebody else's icon, and `TrustTitle` being a union is what makes
 * that a `tsc` error rather than a rendering bug — these assertions are the
 * other half of that guard.
 */
describe('GENERIC_TRUST_COPY', () => {
  it('states the three guarantees, in the order the band draws them', () => {
    expect(GENERIC_TRUST_COPY.map((signal) => signal.title)).toEqual([
      'Reviews from real bookings',
      'Payment held until the event',
      'No service fee',
    ]);
  });

  it('uses only declared titles, so every signal can be keyed to a glyph', () => {
    for (const signal of GENERIC_TRUST_COPY) {
      expect(TRUST_TITLES, signal.title).toContain(signal.title);
    }
  });

  it('says something in every body, and never names a vendor or an amount', () => {
    /*
     * The generic band is what a signed-in customer now reads too, so a body
     * carrying a leftover interpolation would render `$NaN` or `undefined` at
     * them rather than falling back. Cheap to assert, and the failure it
     * catches is one nobody would look for.
     */
    for (const signal of GENERIC_TRUST_COPY) {
      expect(signal.body.length, signal.title).toBeGreaterThan(20);
      expect(signal.body, signal.title).not.toMatch(/\$|undefined|NaN|\{|\}/);
    }
  });
});
