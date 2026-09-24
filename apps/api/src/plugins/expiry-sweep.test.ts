import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expireLapsedRequests } from '../modules/booking-requests/booking-requests.service.js';
import { backgroundPlugin } from './background.js';
import { expirySweepPlugin } from './expiry-sweep.js';

vi.mock('../modules/booking-requests/booking-requests.service.js', () => ({
  expireLapsedRequests: vi.fn(async () => 0),
}));

const INTERVAL_MS = 60_000;

/** The plugin name each decorator is registered under, where it differs. */
const PLUGIN_NAMES: Record<string, string> = {
  db: 'database',
  adminAlerts: 'admin-alerts',
};

describe('the expiry sweep (VEN-528)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(expireLapsedRequests).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * The guard is optional on `expireLapsedRequests`, so leaving it out of this
   * call still compiles — and then the sweep expires a request whose payment
   * succeeded but whose webhook never arrived, and the charge is refunded.
   */
  it('hands the sweep the payment guard, so a payment made in time is booked', async () => {
    const app = Fastify();
    const decorations: Record<string, unknown> = {
      clock: () => new Date('2026-06-01T12:00:00Z'),
      db: {},
      email: {},
      background: {},
      stripe: {},
      events: {},
      adminAlerts: { dispatch: () => undefined },
    };

    for (const [name, value] of Object.entries(decorations)) {
      await app.register(
        fp(
          async (instance) => {
            instance.decorate(name, value as never);
          },
          { name: PLUGIN_NAMES[name] ?? name },
        ),
      );
    }
    await app.register(expirySweepPlugin, {
      intervalMs: INTERVAL_MS,
      webOrigin: 'https://web.test',
      platformFeeRate: 0.12,
      reporter: { capture: () => undefined },
    } as never);
    await app.ready();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(expireLapsedRequests).toHaveBeenCalledTimes(1);
    const guard = vi.mocked(expireLapsedRequests).mock.calls[0]?.[3];
    expect(guard).toEqual({ settleBeforeExpiry: expect.any(Function) });

    await app.close();
  });

  /*
   * VEN-688: a deploy during a tick expired the request and exited before the
   * email the tick queued had a delivery row.
   */
  it('waits for the running sweep before draining the email queue, so its emails are sent', async () => {
    const sent: string[] = [];
    let finishSweep: () => void = () => undefined;
    vi.mocked(expireLapsedRequests).mockImplementationOnce(async (_db, _now, mail) => {
      await new Promise<void>((resolve) => {
        finishSweep = resolve;
      });
      mail.background.run(async () => {
        await Promise.resolve();
        sent.push('request expired');
      });

      return 1;
    });

    const app = Fastify();
    // First, as `buildServer` registers it, so its close hook runs after the sweep's.
    await app.register(backgroundPlugin);
    const decorations: Record<string, unknown> = {
      clock: () => new Date('2026-06-01T12:00:00Z'),
      db: {},
      email: {},
      stripe: {},
      events: {},
      adminAlerts: { dispatch: () => undefined },
    };

    for (const [name, value] of Object.entries(decorations)) {
      await app.register(
        fp(
          async (instance) => {
            instance.decorate(name, value as never);
          },
          { name: PLUGIN_NAMES[name] ?? name },
        ),
      );
    }
    await app.register(expirySweepPlugin, {
      intervalMs: INTERVAL_MS,
      webOrigin: 'https://web.test',
      platformFeeRate: 0.12,
      reporter: { capture: () => undefined },
    } as never);
    await app.ready();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    let closed = false;
    const closing = app.close().then(() => {
      closed = true;
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(closed).toBe(false);

    finishSweep();
    await closing;

    expect(sent).toEqual(['request expired']);
  });
});
