import { describe, expect, it } from 'vitest';

import { ApiClientError } from './api-client';
import { UPSTREAM_ERROR_SHAPES, isUpstreamErrorShape, userFacingError } from './user-facing-error';

const FALLBACK = 'We could not save that. Try again.';

function apiError(
  statusCode: number,
  code: ConstructorParameters<typeof ApiClientError>[1],
  message: string,
): ApiClientError {
  return new ApiClientError(statusCode, code, message);
}

describe('userFacingError', () => {
  /*
   * The guard #72 asked for. `40-states.md` requires an error to say what
   * happened *in the user's words — not the exception*, and these three are the
   * exception: they are what the API's own error handler emits when it has
   * nothing specific to say, so rendering one tells the user only that a
   * computer is unhappy.
   */
  it.each([
    ['Request validation failed', 400, 'VALIDATION_ERROR' as const],
    ['Internal server error', 500, 'INTERNAL_ERROR' as const],
    ['Invalid input', 400, 'VALIDATION_ERROR' as const],
  ])('replaces the upstream shape %s with the caller copy', (message, status, code) => {
    expect(userFacingError(apiError(status, code, message), FALLBACK)).toBe(FALLBACK);
  });

  it('replaces an upstream shape whatever its casing or padding', () => {
    expect(
      userFacingError(apiError(500, 'INTERNAL_ERROR', '  internal server error  '), FALLBACK),
    ).toBe(FALLBACK);
  });

  it('keeps a message the product wrote for this situation', () => {
    // The exemplary message `40-states.md` names as the intended standard.
    const written = 'The smaller number goes first — swap them and this will save.';

    expect(userFacingError(apiError(400, 'VALIDATION_ERROR', written), FALLBACK)).toBe(written);
  });

  it('never surfaces a 500 message, even a specific-looking one', () => {
    /*
     * A 5xx body is written about the server, not the user, and may carry a
     * stack fragment or a vendor SDK's key-and-mode complaint. There is nothing
     * in that class worth showing, so status decides rather than wording.
     */
    expect(
      userFacingError(
        apiError(500, 'INTERNAL_ERROR', 'connect ECONNREFUSED 10.0.0.4:5432'),
        FALLBACK,
      ),
    ).toBe(FALLBACK);
  });

  it('falls back for an error that is not from the API at all', () => {
    expect(userFacingError(new TypeError('fetch failed'), FALLBACK)).toBe(FALLBACK);
    expect(userFacingError('a thrown string', FALLBACK)).toBe(FALLBACK);
    expect(userFacingError(null, FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for an empty or whitespace-only message', () => {
    expect(userFacingError(apiError(409, 'CONFLICT', '   '), FALLBACK)).toBe(FALLBACK);
  });

  it('returns the fallback verbatim, so callers control the voice', () => {
    const specific = 'That date is no longer free. Pick another and your details are kept.';

    expect(
      userFacingError(apiError(500, 'INTERNAL_ERROR', 'Internal server error'), specific),
    ).toBe(specific);
  });
});

describe('UPSTREAM_ERROR_SHAPES', () => {
  it('covers exactly the generic messages the API emits', () => {
    // Held against `apps/api/src/plugins/error-handler.ts`; adding a generic
    // message there without adding it here is what let these leak in the first place.
    expect([...UPSTREAM_ERROR_SHAPES].sort()).toEqual([
      'internal server error',
      'invalid input',
      'request failed',
      'request validation failed',
      'resource not found',
    ]);
  });
});

describe('isUpstreamErrorShape', () => {
  it('recognises a generic shape whatever its casing or padding', () => {
    expect(isUpstreamErrorShape('Request validation failed')).toBe(true);
    expect(isUpstreamErrorShape('  INTERNAL SERVER ERROR ')).toBe(true);
  });

  it('leaves a message the product wrote alone', () => {
    expect(isUpstreamErrorShape('JPG or PNG, up to 12 MB.')).toBe(false);
  });
});
