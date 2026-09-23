import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcilePlatformBalance } from '../modules/payments/platform-balance.service.js';
import { platformBalancePlugin } from './platform-balance.js';

vi.mock('../modules/payments/platform-balance.service.js', () => ({
  reconcilePlatformBalance: vi.fn(async () => ({ balanceCents: 0, requiredCents: 0, alert: null })),
}));

const DAY_MS = 24 * 60 * 60_000;
/** The longest the first run may wait: 60 s plus up to 5 s of jitter. */
const LONGEST_BOOT_DELAY_MS = 65_000;

async function bootedApp(intervalMs: number): Promise<ReturnType<typeof Fastify>> {
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
        instance.decorate('operatorAlerts', { alertNow: async () => 'sent' } as never);
        instance.decorate('db', {} as never);
        instance.decorate('stripe', {} as never);
      },
      { name: 'operator-alerts' },
    ),
  );
  await app.register(platformBalancePlugin, {
    intervalMs,
    reporter: { capture: () => undefined },
  });
  await app.ready();

  return app;
}

describe('the platform balance reconciliation schedule (VEN-644)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(reconcilePlatformBalance).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs once shortly after boot, then daily', async () => {
    const app = await bootedApp(DAY_MS);

    await vi.advanceTimersByTimeAsync(LONGEST_BOOT_DELAY_MS);
    expect(reconcilePlatformBalance).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(DAY_MS);
    expect(reconcilePlatformBalance).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it('never runs when the interval is 0, as in every suite', async () => {
    const app = await bootedApp(0);

    await vi.advanceTimersByTimeAsync(DAY_MS + LONGEST_BOOT_DELAY_MS);
    expect(reconcilePlatformBalance).not.toHaveBeenCalled();

    await app.close();
  });
});
