import fp from 'fastify-plugin';
import { createTickTracker, runTick } from '../lib/sweep.js';
import type { ErrorReporter } from '../lib/error-reporting.js';
import { releaseDuePayouts } from '../modules/payments/payouts.service.js';

export interface PayoutReleasePluginOptions {
  /**
   * How often to sweep, in milliseconds. **`0` disables the timer entirely**,
   * which is what every suite uses: a sweep firing mid-test would move money
   * against fixtures nobody asked it to touch.
   */
  intervalMs: number;
  /**
   * Where a failed sweep is reported. A sweep has no request to fail and no
   * screen to show it, so without this a Stripe outage that stops every payout
   * is a log line nobody reads.
   */
  reporter: ErrorReporter;
  /** `canonicalWebOrigin(env)`, for the link in the payout email. */
  webOrigin: string;
}

/** Wait this long after `onReady` before the first sweep, plus up to the jitter. */
const BOOT_DELAY_MS = 30_000;
const BOOT_JITTER_MS = 5_000;

/**
 * The payout sweep's schedule — the only scheduler in this repository, and the
 * mechanism #423 had to choose because there was nothing to reuse.
 *
 * **Why an in-process timer rather than a Railway cron service.** The
 * alternatives were a second Railway service running the same image on a cron
 * expression, or this. The cron service is the more conventional answer and it
 * was rejected on two counts: it doubles the deploy surface for a job whose
 * whole body is one function already in this process, and — the deciding one —
 * it would not actually simplify the correctness problem. A cron service can
 * overlap itself on a slow run, can be triggered twice by a retry, and runs
 * alongside any manual invocation, so the job has to be safe to run twice
 * *whatever* schedules it. Once it is safe to run twice, N instances running it
 * every quarter of an hour is not a harder problem than one instance running it
 * on a cron — it is the same problem, already solved, with one fewer service to
 * deploy and one fewer thing that can be silently not running.
 *
 * `releaseDuePayouts` carries that safety: `FOR UPDATE SKIP LOCKED` on the
 * claim, the predicate re-read inside the lock, and a Stripe idempotency key
 * keyed on the booking. Its own doc comment has the detail.
 *
 * The timer is `unref`'d so it never holds the process open, and cleared on
 * close so a shutdown mid-sweep is not interrupted by the next tick, and closing
 * waits for the tick that is running before the email queue drains.
 */
export const payoutReleasePlugin = fp<PayoutReleasePluginOptions>(
  async (app, options) => {
    if (options.intervalMs <= 0) {
      return;
    }

    /*
     * Guarded against overlapping itself *within one process* as well. The row
     * locks make an overlap correct rather than catastrophic, but a sweep
     * slower than the interval would otherwise pile ticks up behind it and turn
     * a Stripe outage into an unbounded queue of retries.
     */
    let running = false;

    const tick = async (): Promise<void> => {
      if (running) {
        return;
      }

      running = true;

      try {
        await runTick(
          'payout-release',
          async () => {
            await releaseDuePayouts(
              {
                db: app.db,
                stripe: app.stripe,
                log: app.log,
                alerts: app.adminAlerts,
                notify: {
                  hub: app.events,
                  mail: {
                    db: app.db,
                    email: app.email,
                    log: app.log,
                    webOrigin: options.webOrigin,
                    background: app.background,
                  },
                },
              },
              app.clock(),
            );
          },
          { intervalMs: options.intervalMs, reporter: options.reporter, log: app.log },
        );
      } catch (error) {
        // Logged and swallowed: an unhandled rejection here would take the
        // process down over a job whose next run repairs it.
        app.log.error({ err: error }, 'Payout sweep failed');
        options.reporter.capture(error, { payment: true });
      } finally {
        running = false;
      }
    };

    const ticks = createTickTracker();
    const timer = setInterval(() => ticks.start(tick), options.intervalMs);
    timer.unref();

    /*
     * One sweep shortly after boot (VEN-473), so an API restarted more often
     * than the interval still sweeps. Delayed so the process is serving first,
     * and jittered so a fleet booting together does not sweep in step; the
     * `running` guard and the row locks make a second sweep harmless.
     */
    const bootDelayMs = BOOT_DELAY_MS + Math.floor(Math.random() * BOOT_JITTER_MS);
    let bootTimer: NodeJS.Timeout | undefined;

    app.addHook('onReady', async () => {
      bootTimer = setTimeout(() => ticks.start(tick), bootDelayMs);
      bootTimer.unref();
    });

    app.addHook('onClose', async () => {
      clearInterval(timer);
      clearTimeout(bootTimer);
      // Before `background` drains: a tick queues the vendor's payout email (VEN-688).
      await ticks.settled();
    });
  },
  { name: 'payout-release', dependencies: ['clock', 'admin-alerts'] },
);
