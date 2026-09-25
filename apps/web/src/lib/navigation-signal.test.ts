import { ERROR_CODES } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { ApiClientError, ApiTimeoutError } from './api-client';
import { isNavigationSignal } from './navigation-signal';

const REQUEST_ID = '5f0c2a52-7d7e-4a52-9f3e-2f6c1f7a9b10';

function withDigest(digest: string): Error & { digest: string } {
  return Object.assign(new Error('signal'), { digest });
}

describe('isNavigationSignal', () => {
  it.each([
    'NEXT_REDIRECT;replace;/suspended;307;',
    'NEXT_HTTP_ERROR_FALLBACK;404',
    'NEXT_NOT_FOUND',
    'DYNAMIC_SERVER_USAGE',
    'BAILOUT_TO_CLIENT_SIDE_RENDERING',
  ])("lets Next's %s through", (digest) => {
    expect(isNavigationSignal(withDigest(digest))).toBe(true);
  });

  it('does not read an API failure carrying a request id as a navigation signal (VEN-690)', () => {
    const failed = new ApiClientError(
      500,
      ERROR_CODES.INTERNAL_ERROR,
      'boom',
      undefined,
      REQUEST_ID,
    );
    const unauthorized = new ApiClientError(
      401,
      ERROR_CODES.UNAUTHORIZED,
      'no',
      undefined,
      REQUEST_ID,
    );

    expect(failed.digest).toBe(REQUEST_ID);
    expect(isNavigationSignal(failed)).toBe(false);
    expect(isNavigationSignal(unauthorized)).toBe(false);
    expect(isNavigationSignal(new ApiTimeoutError('/x', 8000, REQUEST_ID))).toBe(false);
  });

  it('is false for a plain error, a string and null', () => {
    expect(isNavigationSignal(new Error('x'))).toBe(false);
    expect(isNavigationSignal('NEXT_REDIRECT')).toBe(false);
    expect(isNavigationSignal(null)).toBe(false);
  });
});
