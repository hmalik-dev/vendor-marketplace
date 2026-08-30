import fp from 'fastify-plugin';
import { createStripeConnectGateway } from '../lib/stripe.js';
import type { StripeConnectGateway } from '../lib/stripe.js';

declare module 'fastify' {
  interface FastifyInstance {
    stripe: StripeConnectGateway;
  }
}

export interface StripePluginOptions {
  secretKey: string;
  webhookSecret: string;
  /** Overridden by the route suites so they need no Stripe account at all. */
  gateway?: StripeConnectGateway;
}

/**
 * Decorates the instance with the Stripe Connect gateway.
 *
 * A plugin rather than a per-route option because two modules consume it — the
 * vendor's onboarding routes and the webhook — and threading one adapter
 * through two registration sites is how the two quietly end up holding
 * different clients. The real gateway is built here from the secret rather than
 * by the server factory, the way `clerkAuthPlugin` builds its client: only the
 * suites supply their own.
 */
export const stripePlugin = fp<StripePluginOptions>(
  async (app, options) => {
    app.decorate('stripe', options.gateway ?? createStripeConnectGateway(options));
  },
  { name: 'stripe' },
);
