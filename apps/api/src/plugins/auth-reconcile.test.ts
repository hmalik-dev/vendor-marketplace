import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileAuthUsers } from '../modules/auth-sync/auth-sync.reconcile.js';
import { authReconcilePlugin } from './auth-reconcile.js';

vi.mock('../modules/auth-sync/auth-sync.reconcile.js', () => ({
  reconcileAuthUsers: vi.fn(async () => ({})),
}));

const INTERVAL_MS = 24 * 60 * 60_000;
/** The longest the first pass may wait: 60 s plus up to 10 s of jitter. */
const LONGEST_BOOT_DELAY_MS = 70_000;

async function bootedApp(directory: object | null = { lookup: vi.fn() }, intervalMs = INTERVAL_MS) {
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
        instance.decorate('events', {} as never);
        instance.decorate('email', {} as never);
        instance.decorate('background', {} as never);
      },
      { name: 'operator-alerts' },
    ),
  );
  await app.register(
    fp(
      async (instance) => {
        instance.decorate('authDirectory', directory as never);
      },
      { name: 'auth-directory' },
    ),
  );
  await app.register(authReconcilePlugin, {
    intervalMs,
    reporter: { capture: vi.fn() },
    webOrigin: 'http://localhost:3000',
  });
  await app.ready();

  return app;
}

describe('the Neon Auth reconcile schedule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(reconcileAuthUsers).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs once shortly after boot, and then on the daily interval', async () => {
    const app = await bootedApp();

    await vi.advanceTimersByTimeAsync(LONGEST_BOOT_DELAY_MS);
    expect(reconcileAuthUsers).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(reconcileAuthUsers).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it('does not stack a second pass behind a slow one', async () => {
    const shortInterval = 10 * 60_000;
    let finish!: () => void;
    vi.mocked(reconcileAuthUsers).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({} as never);
        }),
    );
    const app = await bootedApp({ lookup: vi.fn() }, shortInterval);

    await vi.advanceTimersByTimeAsync(LONGEST_BOOT_DELAY_MS);
    // The interval fires while the boot pass is still reading Neon Auth, inside its deadline.
    await vi.advanceTimersByTimeAsync(shortInterval);
    expect(reconcileAuthUsers).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(shortInterval);
    expect(reconcileAuthUsers).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it('abandons a pass that never settles, so the next interval still runs (VEN-671)', async () => {
    vi.mocked(reconcileAuthUsers).mockImplementationOnce(() => new Promise(() => undefined));
    const app = await bootedApp();

    await vi.advanceTimersByTimeAsync(LONGEST_BOOT_DELAY_MS);
    expect(reconcileAuthUsers).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(reconcileAuthUsers).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it('survives a failed pass and runs the next one', async () => {
    vi.mocked(reconcileAuthUsers).mockRejectedValueOnce(new Error('neon down'));
    const app = await bootedApp();

    await vi.advanceTimersByTimeAsync(LONGEST_BOOT_DELAY_MS);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(reconcileAuthUsers).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it('never schedules when disabled or when there is no Neon Auth connection', async () => {
    const disabled = await bootedApp({ lookup: vi.fn() }, 0);
    const unconnected = await bootedApp(null);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS + LONGEST_BOOT_DELAY_MS);

    expect(reconcileAuthUsers).not.toHaveBeenCalled();

    await disabled.close();
    await unconnected.close();
  });
});
