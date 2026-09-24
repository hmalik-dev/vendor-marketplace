import fp from 'fastify-plugin';
import type { ErrorReporter } from '../lib/error-reporting.js';
import { runTick } from '../lib/sweep.js';
import {
  createAdminAlerts,
  type AdminAlertDeps,
  type AdminAlerts,
} from '../modules/admin-alerts/admin-alerts.service.js';
import { adminLocalTime, runAdminDigest } from '../modules/admin-alerts/admin-digest.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    adminAlerts: AdminAlerts;
  }
}

export interface AdminAlertsPluginOptions {
  /** `ADMIN_ALERT_EMAIL`; undefined in development, where alerts are logged. */
  to: string | undefined;
  webOrigin: string;
  /** `ADMIN_TIMEZONE`. */
  timeZone: string;
  /**
   * How often to ask whether the digest is due. **`0` disables the timer**, which
   * every suite uses for `payoutReleasePlugin`'s reason; they call
   * `runAdminDigest` directly instead.
   */
  digestIntervalMs: number;
  /** Where a digest tick that overruns its deadline is reported. */
  reporter: ErrorReporter;
  /** Pause between alert send retries; the suites pass one that resolves at once. */
  wait?: (ms: number) => Promise<void>;
}

/**
 * Decorates the instance with the admin alert sender (VEN-405), and runs the
 * morning digest on the same in-process timer shape as `payoutReleasePlugin` —
 * whose doc comment carries the argument for a timer over a cron service.
 * `runAdminDigest`'s claim is what makes every instance ticking safe.
 */
export const adminAlertsPlugin = fp<AdminAlertsPluginOptions>(
  async (app, options) => {
    // Refuses to boot on a zone `Intl` does not know, rather than failing at 07:00.
    adminLocalTime(app.clock(), options.timeZone);

    const deps: AdminAlertDeps = {
      db: app.db,
      email: app.email,
      log: app.log,
      background: app.background,
      clock: app.clock,
      to: options.to,
      webOrigin: options.webOrigin,
      reporter: options.reporter,
      wait: options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    };

    app.decorate('adminAlerts', createAdminAlerts(deps));

    if (options.digestIntervalMs <= 0) {
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
          'admin-digest',
          async () => {
            await runAdminDigest({ ...deps, timeZone: options.timeZone }, app.clock());
          },
          { intervalMs: options.digestIntervalMs, reporter: options.reporter, log: app.log },
        );
      } catch (error) {
        // Logged and swallowed: the next tick retries an unclaimed day.
        app.log.error({ err: error }, 'Admin digest run failed');
      } finally {
        running = false;
      }
    };

    const timer = setInterval(() => void tick(), options.digestIntervalMs);
    timer.unref();

    app.addHook('onClose', async () => {
      clearInterval(timer);
    });
  },
  {
    name: 'admin-alerts',
    dependencies: ['clock', 'database', 'email', 'background'],
  },
);
