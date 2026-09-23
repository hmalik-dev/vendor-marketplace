import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { throttleChargeSchema } from '@vendor-marketplace/shared';
import { chargeThrottle } from '../../lib/throttle.js';
import { requireWebTierKey } from '../../lib/web-tier-key.js';

export interface ThrottleRoutesOptions {
  /** `WEB_TIER_KEY`. Unset (local only) and the route does not exist. */
  webTierKey: string | undefined;
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
      onRequest: requireWebTierKey(options.webTierKey),
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
