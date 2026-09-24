import {
  STEP_UP_CHALLENGES_PER_HOUR,
  adminStepUpResultSchema,
  closeOwnAccountReadinessSchema,
  closeOwnAccountResultSchema,
  closeOwnAccountSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { forbidden } from '../../lib/errors.js';
import { authenticated, requireAuthBeforeValidation } from '../../lib/guards.js';
import { perAccountRateLimit } from '../../lib/rate-limit.js';
import { startStepUp } from '../admin/admin-step-up.service.js';
import {
  ADMIN_SELF_CLOSURE_REFUSAL,
  closeOwnAccount,
  readOwnCloseReadiness,
} from '../admin/data-rights.service.js';
import { bookingContextFor } from '../payments/payments.service.js';

export interface OwnClosureRoutesOptions {
  /** `canonicalWebOrigin(env)` — the origin every emailed link is built from. */
  webOrigin: string;
}

/**
 * A signed-in customer or vendor closes their own account (VEN-680).
 *
 * Three routes, none of which names a user id: the caller is the subject, so
 * nobody can close another account through them. All three are refused for an
 * admin with copy that points at the console, whose guards stay as they
 * were. The `preParsing`-stage limiter is the route's own, keyed on the
 * account, and the code's attempt cap is the step-up store's.
 */
export const ownClosureRoutes: FastifyPluginAsyncZod<OwnClosureRoutesOptions> = async (
  app,
  options,
) => {
  app.get(
    '/users/me/close',
    {
      onRequest: requireAuthBeforeValidation,
      schema: { response: { 200: closeOwnAccountReadinessSchema } },
    },
    async (request) => readOwnCloseReadiness(app.db, authenticated(request.auth).id, app.clock()),
  );

  app.post(
    '/users/me/close/challenge',
    {
      preParsing: requireAuthBeforeValidation,
      config: { rateLimit: perAccountRateLimit(STEP_UP_CHALLENGES_PER_HOUR, '1 hour') },
      schema: { response: { 200: adminStepUpResultSchema } },
    },
    async (request) => {
      const user = authenticated(request.auth);

      if (user.role === 'admin') {
        throw forbidden(ADMIN_SELF_CLOSURE_REFUSAL);
      }

      return startStepUp(
        { db: app.db, store: app.stepUp, email: app.email, log: request.log },
        user.id,
        app.clock(),
        false,
      );
    },
  );

  app.post(
    '/users/me/close',
    {
      preParsing: requireAuthBeforeValidation,
      config: { rateLimit: perAccountRateLimit(STEP_UP_CHALLENGES_PER_HOUR * 5, '1 hour') },
      schema: { body: closeOwnAccountSchema, response: { 200: closeOwnAccountResultSchema } },
    },
    async (request) => {
      const user = authenticated(request.auth);
      const closed = await closeOwnAccount(
        bookingContextFor(app, request.log, options.webOrigin),
        user.id,
        request.body,
        app.clock(),
        app.authDirectory?.deleteIdentity ?? null,
        app.storage,
        app.stepUp,
      );

      // Every ticket and live stream the person held was authorised by a session that no longer resolves.
      await app.streamTickets.revokeFor(user.id);
      app.events.closeFor(user.id);

      return closed;
    },
  );
};
