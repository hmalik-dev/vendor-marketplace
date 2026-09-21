import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { throttleChargeSchema, WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import { notFound, unauthorized } from '../../lib/errors.js';
import { chargeThrottle } from '../../lib/throttle.js';

export interface ThrottleRoutesOptions {
  /** `WEB_TIER_KEY`. Unset (local only) and the route does not exist. */
  webTierKey: string | undefined;
}

function keyMatches(presented: unknown, secret: string): boolean {
  if (typeof presented !== 'string') {
    return false;
  }

  const expected = Buffer.from(secret);
  const given = Buffer.from(presented);

  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The web tier's shared throttle counter (VEN-462).
 *
 * The web app has no database of its own, and its sign-in proxy throttle lived
 * in each serverless instance's memory: reset by a cold start and multiplied by
 * the number of warm instances. It charges its buckets here instead. Only the
 * web tier may call it, proved with the same key that vouches for visitor
 * addresses, and it is exempt from the per-address limiter because every call
 * arrives from the web platform's one egress address.
 */
export const throttleRoutes: FastifyPluginAsyncZod<ThrottleRoutesOptions> = async (
  app,
  options,
) => {
  app.post(
    '/internal/throttle',
    {
      config: { rateLimit: false },
      bodyLimit: 1_024,
      /*
       * Before the body is parsed: the route is exempt from the limiter, so the
       * key must be checked ahead of any work an anonymous caller could cause.
       */
      onRequest: async (request) => {
        if (options.webTierKey === undefined) {
          throw notFound();
        }

        if (!keyMatches(request.headers[WEB_TIER_KEY_HEADER], options.webTierKey)) {
          throw unauthorized();
        }
      },
      schema: {
        body: throttleChargeSchema,
        response: { 200: z.object({ throttled: z.boolean() }) },
      },
    },
    async (request) => {
      const { bucket, windowMs, limit, record } = request.body;

      return {
        throttled: await chargeThrottle(app.db, bucket, windowMs, limit, app.clock(), record),
      };
    },
  );
};
