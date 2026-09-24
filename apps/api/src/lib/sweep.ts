import * as Sentry from '@sentry/node';
import type { FastifyBaseLogger } from 'fastify';
import type { ErrorReporter } from './error-reporting.js';

const MS_PER_MINUTE = 60_000;

/**
 * The longest each scheduled sweep may run before its tick is abandoned. Every
 * value sits under the sweep's own interval, so an abandoned tick is followed by
 * the next one rather than by silence, and each slug doubles as the Sentry Cron
 * Monitor's slug (listed in `docs/pre-launch.md`).
 */
export const SWEEP_MAX_RUNTIME_MS = {
  'payout-release': 10 * MS_PER_MINUTE,
  'expiry-sweep': 4 * MS_PER_MINUTE,
  'email-retry': 4 * MS_PER_MINUTE,
  'auth-reconcile': 60 * MS_PER_MINUTE,
  'platform-balance': 30 * MS_PER_MINUTE,
  'upload-sweep': 30 * MS_PER_MINUTE,
  'admin-digest': 4 * MS_PER_MINUTE,
} as const;

export type SweepSlug = keyof typeof SWEEP_MAX_RUNTIME_MS;

export const SWEEP_SLUGS = Object.keys(SWEEP_MAX_RUNTIME_MS) as SweepSlug[];

export interface RunTickOptions {
  /** The schedule the timer runs on; the monitor alerts when a check-in is missed. */
  intervalMs: number;
  reporter: ErrorReporter;
  log: FastifyBaseLogger;
  /** Overrides `SWEEP_MAX_RUNTIME_MS[slug]`; the suites pass a short one. */
  maxRuntimeMs?: number;
}

/**
 * Keeps hold of the ticks a plugin has started, so `onClose` can wait for them
 * (VEN-688).
 *
 * `BackgroundWork.drain` settles only what was queued when it is called, and a
 * tick that is still running queues its emails afterwards: a deploy during an
 * expiry or payout tick would commit "expired" / "released" and exit before the
 * delivery row exists. Closing awaits the ticks first, then the queue drains.
 */
export interface TickTracker {
  /** Starts `tick` and remembers it until it settles. */
  start(tick: () => Promise<void>): void;
  /** Resolves once every started tick has settled, however it ended. */
  settled(): Promise<void>;
}

export function createTickTracker(): TickTracker {
  const inFlight = new Set<Promise<void>>();

  return {
    start(tick) {
      const running = tick();
      const forget = (): void => {
        inFlight.delete(running);
      };

      inFlight.add(running);
      // A rejection is the tick's own to report; this only stops tracking it.
      running.then(forget, forget);
    },

    async settled() {
      await Promise.allSettled([...inFlight]);
    },
  };
}

export type TickOutcome = 'completed' | 'overrun';

/** What the reporter receives when a tick outlives its deadline. */
export class SweepOverrunError extends Error {
  constructor(
    readonly slug: SweepSlug,
    maxRuntimeMs: number,
  ) {
    super(`The ${slug} sweep did not settle within ${maxRuntimeMs}ms and was abandoned`);
    this.name = 'SweepOverrunError';
  }
}

/** A tick's check-in schedule: whole minutes, with a margin that scales with the interval. */
function monitorConfig(
  intervalMs: number,
  maxRuntimeMs: number,
): Parameters<typeof Sentry.withMonitor>[2] {
  const minutes = Math.max(1, Math.round(intervalMs / MS_PER_MINUTE));

  return {
    schedule: { type: 'interval', value: minutes, unit: 'minute' },
    checkinMargin: Math.max(2, Math.ceil(minutes / 4)),
    maxRuntime: Math.max(1, Math.ceil(maxRuntimeMs / MS_PER_MINUTE)),
  };
}

/**
 * Runs one scheduled tick so that a hang is as visible as a failure.
 *
 * The plugins' `running` guard is released only when a tick settles, so a call
 * that never returns used to disable its job for the life of the process without
 * a word. This races the tick against a deadline: on an overrun it reports to
 * the error tracker, resolves `'overrun'` so the caller's `finally` frees the
 * guard, and leaves the abandoned work to settle on its own (its late rejection
 * is logged, never unhandled). Every sweep is safe to run twice at once — that is
 * what the row locks and idempotency keys are for — so the next tick overlapping
 * a straggler is the intended trade for never being stuck.
 *
 * The tick also checks in to a Sentry Cron Monitor named `slug`, so a job that
 * stops running, or keeps running too long, alerts even though nothing threw.
 * A tick that throws is recorded as a failed check-in and rethrown for the
 * caller to log and report with its own context.
 */
export async function runTick(
  slug: SweepSlug,
  tick: () => Promise<void>,
  options: RunTickOptions,
): Promise<TickOutcome> {
  const maxRuntimeMs = options.maxRuntimeMs ?? SWEEP_MAX_RUNTIME_MS[slug];
  let deadline: NodeJS.Timeout | undefined;
  const work = tick();
  // The race can settle on the deadline while `work` is in flight; a late
  // rejection would otherwise be unhandled and end the process.
  let abandoned = false;
  work.catch((error: unknown) => {
    // Before the deadline the caller sees this failure through the race below.
    if (abandoned) {
      options.log.warn({ err: error, slug }, 'An abandoned sweep tick failed after its deadline');
      options.reporter.capture(error);
    }
  });

  try {
    await Sentry.withMonitor(
      slug,
      () =>
        Promise.race([
          work,
          new Promise<never>((_, reject) => {
            deadline = setTimeout(
              () => reject(new SweepOverrunError(slug, maxRuntimeMs)),
              maxRuntimeMs,
            );
          }),
        ]),
      monitorConfig(options.intervalMs, maxRuntimeMs),
    );
    return 'completed';
  } catch (error) {
    if (error instanceof SweepOverrunError) {
      abandoned = true;
      options.log.error({ slug, maxRuntimeMs }, 'A sweep tick overran and was abandoned');
      options.reporter.capture(error);
      return 'overrun';
    }

    throw error;
  } finally {
    clearTimeout(deadline);
  }
}
