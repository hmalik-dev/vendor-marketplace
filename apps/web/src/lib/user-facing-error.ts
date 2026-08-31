import { ApiClientError } from './api-client';

/**
 * The boundary between an API error and something a person should read.
 *
 * `40-states.md` requires every error to say **what happened in the user's
 * words — not the exception**. The API's error handler emits a small set of
 * generic messages when it has nothing specific to say, and passing one
 * straight into a toast tells the user only that a computer is unhappy:
 * "Request validation failed" under a heading claiming success was #72's first
 * finding.
 *
 * The API *does* write real messages for its own domain failures — "The smaller
 * number goes first — swap them and this will save." — and those are the
 * standard `40-states.md` points at. So this is a filter, not a blanket: a
 * message the product wrote is kept, and the generic shapes are replaced by
 * copy the caller supplies for that specific situation.
 */

/**
 * The generic messages `apps/api/src/plugins/error-handler.ts` produces.
 *
 * Lower-cased for comparison. A new generic message added there and not here
 * leaks to a user, which is exactly how these five got in front of one, so the
 * suite pins this list against that file.
 */
export const UPSTREAM_ERROR_SHAPES: ReadonlySet<string> = new Set([
  'request validation failed',
  'internal server error',
  'invalid input',
  'request failed',
  'resource not found',
]);

/**
 * Resolves what to show a person for a failed request.
 *
 * @param error whatever was thrown — an `ApiClientError`, a network `TypeError`,
 * or something that is not an `Error` at all.
 * @param fallback the caller's own sentence for this situation. It must say what
 * happened and what to do about it; "Something went wrong" is not a fallback.
 */
export function userFacingError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiClientError)) {
    return fallback;
  }

  /*
   * A 5xx body is written about the server, not the user. It can carry a
   * connection string, a stack fragment, or a vendor SDK complaining about an
   * API key and its mode — so status decides here, not wording.
   */
  if (error.statusCode >= 500) {
    return fallback;
  }

  const message = error.message.trim();

  if (message === '' || UPSTREAM_ERROR_SHAPES.has(message.toLowerCase())) {
    return fallback;
  }

  return message;
}

/**
 * Whether a bare message is one of the API's generic shapes.
 *
 * For the two callers that hold a string rather than the error it came from —
 * the upload failure mapper and the profile-save issue collector — where the
 * same leak is possible without an `ApiClientError` in hand.
 */
export function isUpstreamErrorShape(message: string): boolean {
  return UPSTREAM_ERROR_SHAPES.has(message.trim().toLowerCase());
}
