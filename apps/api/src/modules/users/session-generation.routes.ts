import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireWebTierKey } from '../../lib/web-tier-key.js';
import { invalidateSessionsFor } from './users.dao.js';

export interface SessionGenerationRoutesOptions {
  /** `WEB_TIER_KEY`. Unset (local only) and the route does not exist. */
  webTierKey: string | undefined;
}

/**
 * Bounds how long a JWT minted before sign-out stays usable (VEN-628, the
 * should-fix): the web tier calls this once sign-out succeeds at the
 * provider, and the auth hook refuses any token whose `iat` predates the
 * timestamp this writes. Same trust model as `/internal/throttle` — only the
 * web tier may call it, proved with the same shared key, and it is a no-op
 * response either way so a caller that lost the race with the DB never turns
 * a completed sign-out into a visible failure. It also ends the user's open
 * live streams on every instance: they were authorised by those tokens.
 */
export const sessionGenerationRoutes: FastifyPluginAsyncZod<
  SessionGenerationRoutesOptions
> = async (app, options) => {
  app.post(
    '/internal/session-generation',
    {
      config: { rateLimit: false },
      bodyLimit: 1_024,
      onRequest: requireWebTierKey(options.webTierKey),
      schema: {
        body: z.object({ authUserId: z.string().min(1) }),
        response: { 200: z.object({ invalidated: z.literal(true) }) },
      },
    },
    async (request) => {
      const userId = await invalidateSessionsFor(app.db, request.body.authUserId);

      // Every token before now is dead, so every ticket it minted and every stream opened under one is too (VEN-670).
      if (userId !== null) {
        await app.streamTickets.revokeFor(userId);
        app.events.closeFor(userId);
      }

      return { invalidated: true as const };
    },
  );
};
