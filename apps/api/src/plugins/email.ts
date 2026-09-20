import fp from 'fastify-plugin';
import { createEmailGateway } from '../lib/email.js';
import type { EmailGateway } from '../lib/email.js';

declare module 'fastify' {
  interface FastifyInstance {
    email: EmailGateway;
  }
}

export interface EmailPluginOptions {
  apiKey: string;
  from: string;
  /** `DEPLOY_ENV`: outside production the gateway delivers to the sink only. */
  deployEnv: string;
  sinkAddress?: string | undefined;
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
    app.decorate('email', options.gateway ?? createEmailGateway({ ...options, log: app.log }));
  },
  { name: 'email' },
);
