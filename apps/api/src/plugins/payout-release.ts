import fp from 'fastify-plugin';
import { releaseDuePayouts } from '../modules/payments/payouts.service.js';

export interface PayoutReleasePluginOptions {
  /**
   * How often to sweep, in milliseconds. **`0` disables the timer entirely**,
   * which is what every suite uses: a sweep firing mid-test would move money
   * against fixtures nobody asked it to touch.
   */
  intervalMs: number;
}

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
 * close so a shutdown mid-sweep drains rather than being interrupted by the
 * next tick.
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
        await releaseDuePayouts({ db: app.db, stripe: app.stripe, log: app.log }, app.clock());
      } catch (error) {
        // Logged and swallowed: an unhandled rejection here would take the
        // process down over a job whose next run repairs it.
        app.log.error({ err: error }, 'Payout sweep failed');
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
  { name: 'payout-release', dependencies: ['clock'] },
);
