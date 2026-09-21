import { isDeployedRuntime } from '@vendor-marketplace/shared/env';
import fp from 'fastify-plugin';
import { createEmailGateway } from '../lib/email.js';
import type { EmailGateway } from '../lib/email.js';
import { withLaneMailbox } from '../lib/lane-mailbox.js';

/** Where a lane's E2E specs read the last email sent; registered on `local` only. */
export const LANE_MAILBOX_PATH = '/__lane/mailbox/latest';

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
    const gateway = options.gateway ?? createEmailGateway({ ...options, log: app.log });

    // Both signals: an explicit `DEPLOY_ENV=local` on a process the env layer treats as deployed stays closed.
    if (options.deployEnv !== 'local' || isDeployedRuntime()) {
      app.decorate('email', gateway);
      return;
    }

    // A lane has no inbox, so its E2E specs read the step-up code here (VEN-553).
    const lane = withLaneMailbox(gateway);
    app.decorate('email', lane.gateway);
    app.get<{ Querystring: { to?: string } }>(LANE_MAILBOX_PATH, async (request, reply) => {
      const message = lane.mailbox.latest(request.query.to);

      return message
        ? { to: message.to, subject: message.subject, text: message.text }
        : reply.code(404).send({ error: 'No email has been sent' });
    });
  },
  { name: 'email' },
);
