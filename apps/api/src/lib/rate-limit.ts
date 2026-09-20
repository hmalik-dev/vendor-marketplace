/**
 * A per-route rate limit counted against the signed-in account rather than the
 * network address, so one account cannot flood a route and a second account
 * behind the same address is unaffected.
 *
 * Only meaningful behind a guard that has already resolved `request.auth`
 * (an `onRequest` guard runs before the route's own limiter); the address is
 * the fallback for a caller no guard has identified.
 */
export function perAccountRateLimit(max: number, timeWindow: '1 minute' | '1 hour') {
  return {
    max,
    timeWindow,
    keyGenerator: (request: { auth: { id: string } | null; ip: string }) =>
      request.auth?.id ?? request.ip,
  };
}
