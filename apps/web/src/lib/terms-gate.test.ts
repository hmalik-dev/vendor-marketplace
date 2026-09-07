import { ERROR_CODES, TERMS_ACCEPTANCE_PATH } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { ApiClientError } from './api-client';
import { isTermsRequired, signedInFailurePath, termsAcceptancePath } from './terms-gate';

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
