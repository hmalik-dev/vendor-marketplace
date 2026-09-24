import { randomUUID, timingSafeEqual } from 'node:crypto';
import { REQUEST_ID_HEADER, WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The id a request is logged, reported and answered under.
 *
 * The inbound `x-request-id` is honoured only from the web tier — the caller
 * that holds `WEB_TIER_KEY` — and only when it is a UUID, so a stranger cannot
 * choose the value that lands in a log line or a Sentry tag, or forge a match
 * with another request. Everyone else gets a fresh UUID. Fastify's default is a
 * per-process counter that restarts on every deploy and repeats across replicas.
 */
export function requestIdFor(
  headers: Record<string, string | string[] | undefined>,
  webTierKey: string | undefined,
): string {
  const inbound = headers[REQUEST_ID_HEADER];
  const presented = headers[WEB_TIER_KEY_HEADER];
  if (
    webTierKey !== undefined &&
    typeof inbound === 'string' &&
    UUID_SHAPE.test(inbound) &&
    typeof presented === 'string'
  ) {
    const expected = Buffer.from(webTierKey);
    const actual = Buffer.from(presented);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
      return inbound.toLowerCase();
    }
  }
  return randomUUID();
}
