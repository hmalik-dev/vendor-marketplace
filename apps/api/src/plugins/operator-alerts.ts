import fp from 'fastify-plugin';
import {
  createOperatorAlerts,
  type OperatorAlertDeps,
  type OperatorAlerts,
} from '../modules/operator-alerts/operator-alerts.service.js';
import {
  operatorLocalTime,
  runOperatorDigest,
} from '../modules/operator-alerts/operator-digest.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    operatorAlerts: OperatorAlerts;
  }
}

export interface OperatorAlertsPluginOptions {
  /** `OPERATOR_ALERT_EMAIL`; undefined in development, where alerts are logged. */
  to: string | undefined;
  webOrigin: string;
  /** `OPERATOR_TIMEZONE`. */
  timeZone: string;
  /**
   * How often to ask whether the digest is due. **`0` disables the timer**, which
   * every suite uses for `payoutReleasePlugin`'s reason; they call
   * `runOperatorDigest` directly instead.
   */
  digestIntervalMs: number;
  /** Pause between alert send retries; the suites pass one that resolves at once. */
  wait?: (ms: number) => Promise<void>;
}

/**
 * Decorates the instance with the operator alert sender (VEN-405), and runs the
 * morning digest on the same in-process timer shape as `payoutReleasePlugin` —
 * whose doc comment carries the argument for a timer over a cron service.
 * `runOperatorDigest`'s claim is what makes every instance ticking safe.
 */
export const operatorAlertsPlugin = fp<OperatorAlertsPluginOptions>(
  async (app, options) => {
    // Refuses to boot on a zone `Intl` does not know, rather than failing at 07:00.
    operatorLocalTime(app.clock(), options.timeZone);

    const deps: OperatorAlertDeps = {
      db: app.db,
      email: app.email,
      log: app.log,
      background: app.background,
      clock: app.clock,
      to: options.to,
      webOrigin: options.webOrigin,
      wait: options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    };

    app.decorate('operatorAlerts', createOperatorAlerts(deps));

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
        await runOperatorDigest({ ...deps, timeZone: options.timeZone }, app.clock());
      } catch (error) {
        // Logged and swallowed: the next tick retries an unclaimed day.
        app.log.error({ err: error }, 'Operator digest run failed');
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
    name: 'operator-alerts',
    dependencies: ['clock', 'database', 'email', 'background'],
  },
);
