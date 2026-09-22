import { ERROR_CODES, TERMS_ACCEPTANCE_PATH } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { ApiClientError } from './api-client';
import { isTermsRequired, signedInFailurePath, termsAcceptancePath } from './terms-gate';
import { isGateExemptPath, isRefusalExemptPath, terminalRefusal } from './terms-gate-paths';

/**
 * VEN-586: a waitlisted-but-uninvited vendor's session can never clear the
 * Terms gate, so the public browse surfaces (home, search, a storefront) have
 * to stay reachable the same way the vendor-apply/waitlist screens already do
 * — otherwise the gate's own `NotificationBell` funnel bounces it off pages
 * VEN-512 promised would stay viewable.
 */
describe('isGateExemptPath', () => {
  it('exempts the home page and search', () => {
    expect(isGateExemptPath('/')).toBe(true);
    expect(isGateExemptPath('/search')).toBe(true);
  });

  it('exempts a vendor storefront, whatever its slug', () => {
    expect(isGateExemptPath('/vendors/june-harlow')).toBe(true);
    expect(isGateExemptPath('/vendors/a')).toBe(true);
  });

  it('does not exempt a nested storefront route like the booking request flow', () => {
    expect(isGateExemptPath('/vendors/june-harlow/request')).toBe(false);
  });

  it('does not exempt the account-only routes the gate must still bounce', () => {
    expect(isGateExemptPath('/vendor/dashboard')).toBe(false);
    expect(isGateExemptPath('/dashboard')).toBe(false);
    expect(isGateExemptPath('/bookings')).toBe(false);
    expect(isGateExemptPath('/messages')).toBe(false);
  });
});

/**
 * VEN-586: `useRefusalRedirect` reads a separate, narrower list than the Terms
 * funnel above. `/`, `/search` and a storefront carry real authenticated
 * actions (a booking rail, a review form), so a genuine mid-session refusal —
 * a real 401 or an `ACCOUNT_SUSPENDED` 403 — there still has to redirect;
 * only `isGateExemptPath` was meant to widen for VEN-586.
 */
describe('isRefusalExemptPath', () => {
  it('does not exempt the newly public browse surfaces', () => {
    expect(isRefusalExemptPath('/')).toBe(false);
    expect(isRefusalExemptPath('/search')).toBe(false);
    expect(isRefusalExemptPath('/vendors/june-harlow')).toBe(false);
  });

  it('still exempts the Terms/support pages a refusal must not navigate away from', () => {
    expect(isRefusalExemptPath('/terms')).toBe(true);
    expect(isRefusalExemptPath('/support')).toBe(true);
    expect(isRefusalExemptPath('/accept-terms')).toBe(true);
    expect(isRefusalExemptPath('/waitlist')).toBe(true);
  });
});

describe('terminalRefusal', () => {
  it('sends a suspension to /suspended and a dead session to sign-out', () => {
    expect(terminalRefusal(new ApiClientError(403, ERROR_CODES.FORBIDDEN, 'suspended'))).toBe(
      'suspended',
    );
    expect(terminalRefusal(new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'gone'))).toBe(
      'signed-out',
    );
  });

  it('leaves the gate, the vendor gate, a conflict and a failure to their own handling', () => {
    expect(terminalRefusal(new ApiClientError(403, ERROR_CODES.TERMS_REQUIRED, 'gate'))).toBeNull();
    expect(
      terminalRefusal(new ApiClientError(403, ERROR_CODES.VENDOR_NOT_INVITED, 'gate')),
    ).toBeNull();
    expect(terminalRefusal(new ApiClientError(409, ERROR_CODES.CONFLICT, 'stale'))).toBeNull();
    expect(terminalRefusal(new Error('network'))).toBeNull();
  });
});

/**
 * Telling the acceptance gate apart from a suspension.
 *
 * Both are 403 and the frontend owes them opposite screens: a suspension is
 * terminal and goes to `/suspended`, while this is a box the reader ticks once.
 * The status code alone cannot separate them, which is why `TERMS_REQUIRED`
 * exists as its own code and why this is asserted rather than assumed.
 */
describe('isTermsRequired', () => {
  it('recognises the gate', () => {
    expect(
      isTermsRequired(new ApiClientError(403, ERROR_CODES.TERMS_REQUIRED, 'Accept the Terms')),
    ).toBe(true);
  });

  it('does not mistake a suspension for it', () => {
    expect(isTermsRequired(new ApiClientError(403, ERROR_CODES.FORBIDDEN, 'no access'))).toBe(
      false,
    );
  });

  it('does not mistake a signed-out session or a plain error for it', () => {
    expect(isTermsRequired(new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'nope'))).toBe(false);
    expect(isTermsRequired(new Error('network'))).toBe(false);
    expect(isTermsRequired(null)).toBe(false);
  });
});

describe('termsAcceptancePath', () => {
  it('carries a same-origin destination through the gate', () => {
    expect(termsAcceptancePath('/bookings/abc?package=1')).toBe(
      `${TERMS_ACCEPTANCE_PATH}?returnTo=%2Fbookings%2Fabc%3Fpackage%3D1`,
    );
  });

  it('drops a destination that is not one, rather than redirecting to it', () => {
    for (const hostile of ['https://evil.test/steal', '//evil.test', 'javascript:alert(1)', null]) {
      expect(termsAcceptancePath(hostile)).toBe(TERMS_ACCEPTANCE_PATH);
    }
  });
});

/**
 * The ordering is the whole reason this exists as a function rather than as a
 * comment repeated at each site. Both refusals are 403; testing the plain one
 * first would swallow the gate and send every new account to `/suspended`.
 */
describe('signedInFailurePath', () => {
  it('sends the gate to the interstitial, carrying the destination', () => {
    const gate = new ApiClientError(403, ERROR_CODES.TERMS_REQUIRED, 'Accept the Terms');

    expect(signedInFailurePath(gate, '/bookings')).toBe(
      `${TERMS_ACCEPTANCE_PATH}?returnTo=%2Fbookings`,
    );
  });

  it('sends a suspension to the suspended notice', () => {
    const banned = new ApiClientError(403, ERROR_CODES.FORBIDDEN, 'suspended');

    expect(signedInFailurePath(banned, '/bookings')).toBe('/suspended');
  });

  it('claims nothing it cannot answer, so the caller rethrows', () => {
    expect(signedInFailurePath(new ApiClientError(500, ERROR_CODES.INTERNAL_ERROR, 'boom'))).toBe(
      null,
    );
    expect(signedInFailurePath(new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'nope'))).toBe(
      null,
    );
    expect(signedInFailurePath(new Error('network'))).toBe(null);
  });
});
