import { timingSafeEqual } from 'node:crypto';
import type { onRequestAsyncHookHandler } from 'fastify';
import { WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import { notFound, unauthorized } from './errors.js';

function keyMatches(presented: unknown, secret: string): boolean {
  if (typeof presented !== 'string') {
    return false;
  }

  const expected = Buffer.from(secret);
  const given = Buffer.from(presented);

  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * `onRequest` hook gating an internal route to the web tier only, proved with
 * `WEB_TIER_KEY` under a timing-safe comparison (VEN-462, VEN-628): unset
 * (local only) and the route 404s; a caller without the right key gets a 401.
 * Runs before the body is parsed, ahead of any work an anonymous caller could
 * cause.
 */
export function requireWebTierKey(webTierKey: string | undefined): onRequestAsyncHookHandler {
  return async (request) => {
    if (webTierKey === undefined) {
      throw notFound();
    }

    if (!keyMatches(request.headers[WEB_TIER_KEY_HEADER], webTierKey)) {
      throw unauthorized();
    }
  };
}
