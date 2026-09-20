import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { releaseDuePayouts } from '../modules/payments/payouts.service.js';
import { payoutReleasePlugin } from './payout-release.js';

vi.mock('../modules/payments/payouts.service.js', () => ({
  releaseDuePayouts: vi.fn(async () => ({ released: 0, skipped: 0, failed: 0 })),
}));

const INTERVAL_MS = 15 * 60_000;
/** The longest the first sweep may wait: 30 s plus up to 5 s of jitter. */
const LONGEST_BOOT_DELAY_MS = 35_000;

async function bootedApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify();

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
        instance.decorate('operatorAlerts', { dispatch: () => undefined } as never);
        instance.decorate('db', {} as never);
        instance.decorate('stripe', {} as never);
      },
      { name: 'operator-alerts' },
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
});
