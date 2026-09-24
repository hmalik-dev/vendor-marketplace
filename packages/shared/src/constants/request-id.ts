/**
 * The id that joins one failure across the web error page, the API log line and
 * the Sentry event.
 *
 * The web tier mints a UUID per server-side API call and sends it here, proving
 * it is the web tier with `WEB_TIER_KEY_HEADER`; the API answers with the id it
 * actually used, in this same header, on every response.
 */
export const REQUEST_ID_HEADER = 'x-request-id';
