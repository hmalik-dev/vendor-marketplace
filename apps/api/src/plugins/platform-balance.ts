import fp from 'fastify-plugin';
import type { ErrorReporter } from '../lib/error-reporting.js';
import { reconcilePlatformBalance } from '../modules/payments/platform-balance.service.js';

export interface PlatformBalancePluginOptions {
  /**
   * How often to reconcile, in milliseconds. **`0` disables the timer**, which
   * every suite uses for `payoutReleasePlugin`'s reason; they call
   * `reconcilePlatformBalance` directly instead.
   */
  intervalMs: number;
  reporter: ErrorReporter;
}

/** Wait this long after `onReady` before the first run, plus up to the jitter. */
const BOOT_DELAY_MS = 60_000;
const BOOT_JITTER_MS = 5_000;

/**
 * The daily platform balance reconciliation (VEN-644), on the in-process timer
 * `payoutReleasePlugin` argues for. It also runs once shortly after boot, so an
 * API redeployed more often than the interval still checks every day.
 *
 * Read-only against Stripe and the database, so every instance running it is
 * harmless; the alert's per-day subject and dedupe keep the operator to one
 * email a day however many ran.
 */
export const platformBalancePlugin = fp<PlatformBalancePluginOptions>(
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
        await reconcilePlatformBalance(
          { db: app.db, stripe: app.stripe, alerts: app.operatorAlerts, log: app.log },
          app.clock(),
        );
      } catch (error) {
        // Logged and swallowed: the next run repeats the whole read.
        app.log.error({ err: error }, 'Platform balance reconciliation failed');
        options.reporter.capture(error, { payment: true });
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
  { name: 'platform-balance', dependencies: ['clock', 'operator-alerts'] },
);
