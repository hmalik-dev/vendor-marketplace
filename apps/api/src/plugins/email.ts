import fp from 'fastify-plugin';
import { createResendGateway } from '../lib/email.js';
import type { EmailGateway } from '../lib/email.js';

declare module 'fastify' {
  interface FastifyInstance {
    email: EmailGateway;
  }
}

export interface EmailPluginOptions {
  apiKey: string;
  from: string;
  /** Overridden by the route suites so they never reach Resend's network. */
  gateway?: EmailGateway;
}

/**
 * Decorates the instance with the transactional-email gateway.
 *
 * A plugin rather than a per-module option for the same reason as
 * `stripePlugin`: five modules emit notifications, and threading one adapter
 * through five registration sites is how two of them quietly end up holding
 * different clients.
 */
export const emailPlugin = fp<EmailPluginOptions>(
  async (app, options) => {
    app.decorate('email', options.gateway ?? createResendGateway(options));
  },
  { name: 'email' },
);
