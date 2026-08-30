import {
  stripeOnboardingLinkSchema,
  vendorPayoutStatusSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole } from '../../lib/guards.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import { readPayoutStatus, startPayoutOnboarding } from './stripe-connect.service.js';

export interface StripeConnectRoutesOptions {
  stripe: StripeConnectGateway;
  /** Origin Stripe returns the vendor to, with no trailing slash. */
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
    { preHandler: vendorOnly, schema: { response: { 200: stripeOnboardingLinkSchema } } },
    async (request) =>
      startPayoutOnboarding(
        { db: app.db, stripe: options.stripe, returnOrigin: options.returnOrigin },
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
