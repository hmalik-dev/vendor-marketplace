import { clientAddress } from './client-address.js';
/**
 * A per-route rate limit counted against the signed-in account rather than the
 * network address, so one account cannot flood a route and a second account
 * behind the same address is unaffected.
 *
 * `request.auth` is resolved by the auth plugin's global `onRequest` hook,
 * ahead of the route's own limiter; the address is the fallback for a caller
 * it has not identified. A route guard must sit in `preParsing`, after this
 * limiter: an `onRequest` guard would refuse a signed-out caller uncounted.
 */
export function perAccountRateLimit(max: number, timeWindow: '1 minute' | '1 hour') {
  return {
    max,
    timeWindow,
    keyGenerator: (request: {
      auth: { id: string } | null;
      ip: string;
      headers: Record<string, string | string[] | undefined>;
    }) => request.auth?.id ?? clientAddress(request),
  };
}
