import fp from 'fastify-plugin';
import { runTick } from '../lib/sweep.js';
import type { ErrorReporter } from '../lib/error-reporting.js';
import { purgeThrottleHits } from '../lib/throttle.js';
import { expireLapsedRequests } from '../modules/booking-requests/booking-requests.service.js';
import { bookingContextFor, expiryGuardFor } from '../modules/payments/payments.service.js';

export interface ExpirySweepPluginOptions {
  /** How often to sweep, in milliseconds. **`0` disables the timer**, as every suite passes. */
  intervalMs: number;
  /** The web origin the expiry email's button points at. */
  webOrigin: string;
  /** `STRIPE_PLATFORM_FEE_RATE`: the sweep books a payment it finds before it expires the request. */
  platformFeeRate: number;
  reporter: ErrorReporter;
}

/**
 * Ages lapsed booking requests on a timer, so the customer is told their
 * request expired even if nobody ever opens it again.
 *
 * The same in-process shape as `payoutReleasePlugin`, and safe to run on every
 * instance for the same reason: the status change is a guarded UPDATE, so each
 * request is aged and announced once whoever wins it.
 */
export const expirySweepPlugin = fp<ExpirySweepPluginOptions>(
  async (app, options) => {
    if (options.intervalMs <= 0) {
      return;
    }

    // Stops a slow sweep piling ticks up behind itself within one process.
    let running = false;

    const tick = async (): Promise<void> => {
      if (running) {
        return;
      }

      running = true;

      try {
        await runTick(
          'expiry-sweep',
          async () => {
            try {
              await app.streamTickets.sweep();
              await purgeThrottleHits(app.db, app.clock());
            } catch (error) {
              app.log.error({ err: error }, 'Stream ticket and throttle sweep failed');
              options.reporter.capture(error);
            }

            const context = {
              ...bookingContextFor(app, app.log, options.webOrigin),
              platformFeeRate: options.platformFeeRate,
            };

            await expireLapsedRequests(app.db, app.clock(), context.mail, expiryGuardFor(context));
          },
          { intervalMs: options.intervalMs, reporter: options.reporter, log: app.log },
        );
      } catch (error) {
        // Logged and swallowed: the next tick repairs it, and a rejection here would end the process.
        app.log.error({ err: error }, 'Booking request expiry sweep failed');
        options.reporter.capture(error);
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
  {
    name: 'expiry-sweep',
    dependencies: [
      'clock',
      'database',
      'email',
      'background',
      'stripe',
      'events',
      'operator-alerts',
    ],
  },
);
