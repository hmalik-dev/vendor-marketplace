/**
 * The id that joins one failure across the web error page, the API log line and
 * the Sentry event.
 *
 * The web tier mints a UUID per server-side API call and sends it here, proving
 * it is the web tier with `WEB_TIER_KEY_HEADER`; the API answers with the id it
 * actually used, in this same header, on every response.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A request id is a UUID; anything else in the header is not one this system minted. */
export function isRequestId(value: string): boolean {
  return UUID_SHAPE.test(value);
}
