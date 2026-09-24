import fp from 'fastify-plugin';
import { runTick } from '../lib/sweep.js';
import type { ErrorReporter } from '../lib/error-reporting.js';
import { retryFailedEmails } from '../modules/notifications/email-retry.service.js';

export interface EmailRetryPluginOptions {
  /** How often to sweep, in milliseconds. **`0` disables the timer**, which every suite uses. */
  intervalMs: number;
  /** `canonicalWebOrigin(env)`, which the re-rendered links are built on. */
  webOrigin: string;
  reporter: ErrorReporter;
}

/**
 * The retry sweep for transactional email (VEN-465), on `payout-release`'s
 * in-process timer for the reason that plugin gives: the job has to be safe to
 * run twice whatever schedules it, and `retryFailedEmails` is — each row is
 * claimed under `FOR UPDATE SKIP LOCKED`, and Resend's idempotency key is the
 * row's own uuid.
 *
 * Guarded against overlapping itself within one process so a slow Resend cannot
 * pile ticks up behind it; `unref`'d and cleared on close.
 */
export const emailRetryPlugin = fp<EmailRetryPluginOptions>(
  async (app, options) => {
    if (options.intervalMs <= 0) {
      return;
    }

    let running = false;

    const tick = async (): Promise<void> => {
      if (running) {
        return;
      }

      running = true;

      try {
        await runTick(
          'email-retry',
          async () => {
            const shared = {
              db: app.db,
              email: app.email,
              log: app.log,
              webOrigin: options.webOrigin,
              background: app.background,
            };

            await retryFailedEmails(
              { notifications: shared, invites: { ...shared, now: app.clock } },
              app.clock,
            );
          },
          { intervalMs: options.intervalMs, reporter: options.reporter, log: app.log },
        );
      } catch (error) {
        // Logged and swallowed: the next tick repairs it, and a rejection here would end the process.
        app.log.error({ err: error }, 'Email retry sweep failed');
        options.reporter.capture(error, {});
      } finally {
        running = false;
      }
    };

    const timer = setInterval(() => void tick(), options.intervalMs);
    timer.unref();

    app.addHook('onClose', async () => {
      clearInterval(timer);
    });
  },
  { name: 'email-retry', dependencies: ['clock', 'database', 'email', 'background'] },
);
