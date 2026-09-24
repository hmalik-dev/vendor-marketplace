import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { releaseDuePayouts } from '../modules/payments/payouts.service.js';
import { backgroundPlugin } from './background.js';
import { payoutReleasePlugin } from './payout-release.js';

vi.mock('../modules/payments/payouts.service.js', () => ({
  releaseDuePayouts: vi.fn(async () => ({ released: 0, skipped: 0, failed: 0 })),
}));

const INTERVAL_MS = 15 * 60_000;
/** The longest the first sweep may wait: 30 s plus up to 5 s of jitter. */
const LONGEST_BOOT_DELAY_MS = 35_000;

async function bootedApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify();

  // Registered first, as `buildServer` does, so its close hook runs after the sweep's.
  await app.register(backgroundPlugin);
  await app.register(
    fp(
      async (instance) => {
        instance.decorate('clock', () => new Date());
      },
      { name: 'clock' },
    ),
  );
  await app.register(
    fp(
      async (instance) => {
        instance.decorate('adminAlerts', { dispatch: () => undefined } as never);
        instance.decorate('db', {} as never);
        instance.decorate('stripe', {} as never);
      },
      { name: 'admin-alerts' },
    ),
  );
  await app.register(payoutReleasePlugin, {
    intervalMs: INTERVAL_MS,
    reporter: { capture: () => undefined },
  } as never);
  await app.ready();

  return app;
}

describe('the payout sweep schedule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(releaseDuePayouts).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* VEN-473 acceptance 1: a restart more often than the interval still sweeps. */
  it('runs a first sweep within the boot delay, without waiting an interval', async () => {
    const app = await bootedApp();

    expect(releaseDuePayouts).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(LONGEST_BOOT_DELAY_MS);

    expect(releaseDuePayouts).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('does not sweep straight away, so the process is serving first', async () => {
    const app = await bootedApp();

    await vi.advanceTimersByTimeAsync(29_999);

    expect(releaseDuePayouts).not.toHaveBeenCalled();

    await app.close();
  });

  it('sweeps again on the interval', async () => {
    const app = await bootedApp();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(releaseDuePayouts).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it('cancels the boot sweep when the app closes first', async () => {
    const app = await bootedApp();
    await app.close();

    await vi.advanceTimersByTimeAsync(LONGEST_BOOT_DELAY_MS);

    expect(releaseDuePayouts).not.toHaveBeenCalled();
  });

  /*
   * VEN-688: a deploy during a tick committed "released" and exited before the
   * email the tick queues had a delivery row, because `drain` settles only what
   * is queued when it runs.
   */
  it('waits for the running sweep before draining the email queue, so its emails are sent', async () => {
    const sent: string[] = [];
    let finishSweep: () => void = () => undefined;

    vi.mocked(releaseDuePayouts).mockImplementationOnce(async (context) => {
      await new Promise<void>((resolve) => {
        finishSweep = resolve;
      });
      context.notify?.mail.background.run(async () => {
        await Promise.resolve();
        sent.push('payout released');
      });

      return { released: 1, skipped: 0, failed: 0 };
    });
    const app = await bootedApp();
    // The boot sweep: the tick's own deadline is ten minutes, so it is still running.
    await vi.advanceTimersByTimeAsync(LONGEST_BOOT_DELAY_MS);

    let closed = false;
    const closing = app.close().then(() => {
      closed = true;
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(closed).toBe(false);

    finishSweep();
    await closing;

    expect(sent).toEqual(['payout released']);
  });
});
