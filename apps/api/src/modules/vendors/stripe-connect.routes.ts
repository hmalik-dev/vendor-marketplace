import { stripeOnboardingLinkSchema, vendorPayoutStatusSchema } from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import { readPayoutStatus, startPayoutOnboarding } from './stripe-connect.service.js';

export interface StripeConnectRoutesOptions {
  /**
   * Origin Stripe returns the vendor to, with no trailing slash. A route option
   * rather than an instance decoration because this module is the only one that
   * needs it — the webhook has nowhere to send anyone.
   */
  returnOrigin: string;
}

export const stripeConnectRoutes: FastifyPluginAsyncZod<StripeConnectRoutesOptions> = async (
  app,
  options,
) => {
  const vendorOnly = requireRole('vendor');

  /**
   * Begin or resume hosted onboarding. A POST rather than a GET because it
   * creates the connected account the first time it is called, and because a
   * link that expires in five minutes must not be something a browser can
   * prefetch or a proxy can cache.
   */
  app.post(
    '/vendor/stripe/connect',
    {
      // Before body parsing, not preHandler: a wrong-role caller can send a
      // body malformed enough to trip Fastify's own JSON parser, and that
      // 400 must not outrun the 403 this route owes them. See
      // `requireRoleBeforeValidation`.
      onRequest: requireRoleBeforeValidation('vendor'),
      schema: { response: { 200: stripeOnboardingLinkSchema } },
    },
    async (request) =>
      startPayoutOnboarding(
        { db: app.db, stripe: app.stripe, returnOrigin: options.returnOrigin },
        assertRole(request.auth, ['vendor']).id,
      ),
  );

  /** Local state only — see `readPayoutStatus` for why this never calls Stripe. */
  app.get(
    '/vendor/stripe/status',
    { preHandler: vendorOnly, schema: { response: { 200: vendorPayoutStatusSchema } } },
    async (request) => readPayoutStatus(app.db, assertRole(request.auth, ['vendor']).id),
  );
};
