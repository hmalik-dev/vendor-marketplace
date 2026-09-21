import fp from 'fastify-plugin';
import type { ErrorReporter } from '../lib/error-reporting.js';
import { reconcileAuthUsers } from '../modules/auth-sync/auth-sync.reconcile.js';
import { bookingContextFor } from '../modules/payments/payments.service.js';

export interface AuthReconcilePluginOptions {
  /** How often to reconcile, in milliseconds. **`0` disables the timer**, as every suite does. */
  intervalMs: number;
  reporter: ErrorReporter;
  /** `canonicalWebOrigin(env)`, for the emails a retirement sends. */
  webOrigin: string;
}

/** Wait this long after `onReady` before the first pass, plus up to the jitter. */
const BOOT_DELAY_MS = 60_000;
const BOOT_JITTER_MS = 10_000;

/**
 * The daily reconcile against Neon Auth (VEN-480), on the in-process timer shape
 * `payoutReleasePlugin` argues for.
 *
 * Neon Auth sends no delete event, so a deleted identity reached the local row
 * only when someone ran `pnpm reconcile:auth`. This is that command on a timer.
 * It is safe on every instance at once: a retirement is a conditional claim,
 * and an operator alert is deduplicated per account. A deployment with no
 * `NEON_AUTH_DATABASE_URL` (a lane on local Docker) has nothing to reconcile
 * against and does not schedule it.
 */
export const authReconcilePlugin = fp<AuthReconcilePluginOptions>(
  async (app, options) => {
    if (options.intervalMs <= 0) {
      return;
    }

    const directory = app.authDirectory;

    if (directory === null) {
      app.log.info('NEON_AUTH_DATABASE_URL is not set; the Neon Auth reconcile is not scheduled');

      return;
    }

    // Within one process a slow pass must not stack another behind it.
    let running = false;

    const tick = async (): Promise<void> => {
      if (running) {
        return;
      }

      running = true;

      try {
        const summary = await reconcileAuthUsers(
          bookingContextFor(app, app.log, options.webOrigin),
          directory,
          {},
          app.clock(),
        );

        app.log.info({ ...summary }, 'Reconciled accounts against Neon Auth');
      } catch (error) {
        // Logged and swallowed: the next tick repairs it, and a rejection would end the process.
        app.log.error({ err: error }, 'Neon Auth reconcile failed');
        options.reporter.capture(error, {});
      } finally {
        running = false;
      }
    };

    const timer = setInterval(() => void tick(), options.intervalMs);
    timer.unref();

    const bootDelayMs = BOOT_DELAY_MS + Math.floor(Math.random() * BOOT_JITTER_MS);
    let bootTimer: NodeJS.Timeout | undefined;

    app.addHook('onReady', async () => {
      bootTimer = setTimeout(() => void tick(), bootDelayMs);
      bootTimer.unref();
    });

    app.addHook('onClose', async () => {
      clearInterval(timer);
      clearTimeout(bootTimer);
    });
  },
  {
    name: 'auth-reconcile',
    dependencies: ['clock', 'operator-alerts', 'auth-directory'],
  },
);
