import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorReporter } from './error-reporting.js';
import { runTick, SWEEP_MAX_RUNTIME_MS, SWEEP_SLUGS, SweepOverrunError } from './sweep.js';

const monitor = vi.hoisted(() => ({ withMonitor: vi.fn() }));

vi.mock('@sentry/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node')>()),
  withMonitor: monitor.withMonitor,
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(HERE, '..', 'plugins');
const PRE_LAUNCH_DOC = join(HERE, '..', '..', '..', '..', 'docs', 'pre-launch.md');

const MINUTE = 60_000;

function harness(): {
  reporter: ErrorReporter;
  captured: unknown[];
  log: Parameters<typeof runTick>[2]['log'];
  logged: Record<string, unknown>[];
} {
  const captured: unknown[] = [];
  const logged: Record<string, unknown>[] = [];
  const write = (fields: Record<string, unknown>): void => {
    logged.push(fields);
  };

  return {
    captured,
    logged,
    reporter: { capture: (error) => captured.push(error) },
    log: { warn: write, error: write } as unknown as Parameters<typeof runTick>[2]['log'],
  };
}

describe('runTick (VEN-671)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The real SDK's contract: run the callback, rethrow what it throws.
    monitor.withMonitor.mockImplementation(async (_slug: string, callback: () => unknown) =>
      callback(),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    monitor.withMonitor.mockReset();
  });

  it('abandons a tick that never settles at maxRuntimeMs, reports it, and lets the next tick run', async () => {
    const { reporter, captured, log } = harness();
    const options = { intervalMs: 15 * MINUTE, reporter, log, maxRuntimeMs: 1_000 };
    let running = false;
    let started = 0;

    // The plugins' own guard, in the shape they use it.
    const guardedTick = async (tick: () => Promise<void>): Promise<void> => {
      if (running) {
        return;
      }

      running = true;

      try {
        await runTick('payout-release', tick, options);
      } finally {
        running = false;
      }
    };

    const hung = guardedTick(async () => {
      started += 1;
      await new Promise<never>(() => undefined);
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await hung;

    expect(started).toBe(1);
    expect(captured).toHaveLength(1);
    expect(captured[0]).toBeInstanceOf(SweepOverrunError);
    expect((captured[0] as Error).message).toBe(
      'The payout-release sweep did not settle within 1000ms and was abandoned',
    );
    expect(running).toBe(false);

    let secondRan = false;
    await guardedTick(async () => {
      secondRan = true;
    });

    expect(secondRan).toBe(true);
    expect(captured).toHaveLength(1);
  });

  it('completes a tick that settles in time without reporting anything', async () => {
    const { reporter, captured, log } = harness();

    const outcome = await runTick('email-retry', async () => undefined, {
      intervalMs: 5 * MINUTE,
      reporter,
      log,
    });

    expect(outcome).toBe('completed');
    expect(captured).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rethrows a tick failure for the plugin to report with its own context', async () => {
    const { reporter, captured, log } = harness();
    const failure = new Error('stripe is down');

    await expect(
      runTick(
        'payout-release',
        async () => {
          throw failure;
        },
        { intervalMs: 15 * MINUTE, reporter, log },
      ),
    ).rejects.toBe(failure);
    expect(captured).toEqual([]);
  });

  it('logs, rather than leaves unhandled, a tick that rejects after it was abandoned', async () => {
    const { reporter, log, logged } = harness();
    const outcome = runTick(
      'upload-sweep',
      () =>
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('late')), 2_000);
        }),
      { intervalMs: 60 * MINUTE, reporter, log, maxRuntimeMs: 1_000 },
    );

    await vi.advanceTimersByTimeAsync(1_000);
    expect(await outcome).toBe('overrun');
    await vi.advanceTimersByTimeAsync(1_000);

    expect(logged.some((fields) => fields.slug === 'upload-sweep' && 'err' in fields)).toBe(true);
  });

  it('checks in to a Cron Monitor named for the job, on its own schedule', async () => {
    const { reporter, log } = harness();

    await runTick('expiry-sweep', async () => undefined, {
      intervalMs: 5 * MINUTE,
      reporter,
      log,
    });

    expect(monitor.withMonitor).toHaveBeenCalledWith('expiry-sweep', expect.any(Function), {
      schedule: { type: 'interval', value: 5, unit: 'minute' },
      checkinMargin: 2,
      maxRuntime: 4,
    });
  });

  it('gives every sweep a deadline shorter than its default interval', () => {
    const intervals: Record<string, number> = {
      'payout-release': 15 * MINUTE,
      'expiry-sweep': 5 * MINUTE,
      'email-retry': 5 * MINUTE,
      'admin-digest': 5 * MINUTE,
    };

    for (const [slug, interval] of Object.entries(intervals)) {
      expect(SWEEP_MAX_RUNTIME_MS[slug as keyof typeof SWEEP_MAX_RUNTIME_MS]).toBeLessThan(
        interval,
      );
    }
  });
});

/*
 * A sweep added without a monitor would be the next job that can stop in
 * silence. The plugin sources are read so that a new timer fails here, by name.
 */
describe('every scheduled sweep plugin is monitored (VEN-671)', () => {
  // The realtime bus's spill purge is a retention timer inside the event hub, not a scheduled job.
  const NOT_SWEEPS = new Set(['events.ts']);
  const sources = readdirSync(PLUGINS_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !NOT_SWEEPS.has(name))
    .map((name) => ({ name, source: readFileSync(join(PLUGINS_DIR, name), 'utf8') }))
    .filter(({ source }) => source.includes('setInterval('));

  const slugsIn = (source: string): string[] =>
    [...source.matchAll(/runTick\(\s*'([a-z-]+)'/g)].map((match) => match[1] as string);

  it('finds the seven plugins that own a timer', () => {
    expect(sources.map(({ name }) => name).sort()).toEqual([
      'auth-reconcile.ts',
      'email-retry.ts',
      'expiry-sweep.ts',
      'operator-alerts.ts',
      'payout-release.ts',
      'platform-balance.ts',
      'upload-sweep.ts',
    ]);
  });

  it.each(sources.map(({ name, source }) => [name, source] as const))(
    '%s runs its tick through runTick with exactly one monitor slug',
    (_name, source) => {
      expect(slugsIn(source)).toHaveLength(1);
    },
  );

  it('uses a distinct slug per plugin, and every slug is a registered sweep', () => {
    const used = sources.flatMap(({ source }) => slugsIn(source));

    expect(new Set(used).size).toBe(used.length);
    expect([...used].sort()).toEqual([...SWEEP_SLUGS].sort());
  });

  it('records every monitor slug in docs/pre-launch.md', () => {
    const doc = readFileSync(PRE_LAUNCH_DOC, 'utf8');

    for (const slug of SWEEP_SLUGS) {
      expect(doc, `docs/pre-launch.md does not list the "${slug}" monitor`).toContain(
        `\`${slug}\``,
      );
    }
  });
});
