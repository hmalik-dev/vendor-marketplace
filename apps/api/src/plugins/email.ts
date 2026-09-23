import { isDeployedRuntime } from '@vendor-marketplace/shared/env';
import fp from 'fastify-plugin';
import { reopenCapClosedDay, sendDay, withDailySendCap } from '../lib/email-send-cap.js';
import { createEmailGateway, dailySendCapFor } from '../lib/email.js';
import type { EmailGateway } from '../lib/email.js';
import type { ErrorReporter } from '../lib/error-reporting.js';
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
  /** `EMAIL_DAILY_SEND_CAP`; unset takes the tier's `DEFAULT_DAILY_SEND_CAP`. */
  dailyCap?: number | undefined;
  /** Pages Sentry the first time a day's sending closes. */
  reporter: ErrorReporter;
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
    const dailyCap = dailySendCapFor(options.deployEnv, options.dailyCap);
    const delivery = createEmailGateway({ ...options, dailyCap, log: app.log });
    // The cap needs the database, which is why it is applied here and not in `createEmailGateway`.
    const gateway =
      options.gateway ??
      (dailyCap === 0
        ? delivery
        : withDailySendCap(delivery, {
            db: app.db,
            cap: dailyCap,
            clock: app.clock,
            reporter: options.reporter,
            log: app.log,
          }));

    /*
     * Raising `EMAIL_DAILY_SEND_CAP` is a redeploy, so this boot is where a day
     * the old cap closed opens again — otherwise the raise would only take
     * effect at midnight UTC. Only the real gateway keeps a budget.
     */
    if (options.gateway === undefined && dailyCap > 0) {
      // A database that is down at boot must not stop the API booting; the day just stays closed.
      await reopenCapClosedDay(app.db, sendDay(app.clock()), dailyCap).catch((error: unknown) => {
        app.log.error({ err: error }, 'Could not reopen a day the previous email cap closed');
      });
    }

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
  { name: 'email', dependencies: ['clock', 'database'] },
);
