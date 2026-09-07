import { describe, expect, it, vi } from 'vitest';

/**
 * The reconciliation CLI boots the real server, and must boot it inertly (#433).
 *
 * Retiring a user now refunds their bookings, so this script needs Stripe, the
 * event hub and the mailer — and the honest way to get them is the same
 * `buildServer` the API runs, rather than a hand-assembled context that can
 * drift from it. The cost of that decision is everything else `buildServer`
 * would otherwise start.
 *
 * Two things must therefore be true, and neither is visible by reading the
 * script: it must **not** listen on a port, and it must **not** start the payout
 * sweep. A repair pass that quietly runs a scheduler moves money nobody asked it
 * to move, on a laptop or in CI, and the first anyone would know is a vendor
 * being paid early.
 */
const buildServer = vi.fn();
const close = vi.fn(async () => undefined);
const listen = vi.fn(async () => '');
const end = vi.fn(async () => undefined);

vi.mock('../../server.js', () => ({
  buildServer: (options: unknown) => {
    buildServer(options);

    /*
     * `clock` and `log` because the CLI now reads its context off the instance
     * through `bookingContextFor`, the same builder the routes use, rather than
     * assembling one of its own.
     */
    return Promise.resolve({ close, listen, clock: () => new Date(), log: {} });
  },
}));

vi.mock('@vendor-marketplace/db', () => ({
  createDatabase: () => ({ db: {}, client: { end } }),
  loadEnv: () => undefined,
}));

vi.mock('../../config/env.js', () => ({
  parseEnv: () => ({ CLERK_SECRET_KEY: 'sk_test_reconcile', WEB_URL: 'https://orla.test' }),
  canonicalWebOrigin: () => 'https://orla.test',
}));

vi.mock('../../lib/storage.js', () => ({ createS3Storage: () => ({}) }));

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({ users: { getUserList: async () => ({ data: [] }) } }),
}));

const reconcileClerkUsers = vi.fn(async () => ({
  examined: 0,
  updated: 0,
  deleted: 0,
  unchanged: 0,
  skipped: 0,
}));

vi.mock('./clerk.reconcile.js', () => ({
  reconcileClerkUsers: (...args: unknown[]) => reconcileClerkUsers(...(args as [])),
}));

describe('the Clerk reconciliation CLI', () => {
  it('builds the server with the payout sweep off, and never listens', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    try {
      await import('./clerk.reconcile.cli.js');
    } finally {
      write.mockRestore();
    }

    expect(buildServer).toHaveBeenCalledTimes(1);
    /*
     * `0`, asserted as a value rather than as "falsy". `undefined` would let
     * `buildServer` fall through to its own default, which is deliberately the
     * sweep's real interval — the option's own docstring explains that a
     * default of off is the more dangerous direction for the server and this is
     * the one caller for which the opposite is true.
     */
    expect(buildServer).toHaveBeenCalledWith(expect.objectContaining({ payoutSweepIntervalMs: 0 }));

    expect(listen).not.toHaveBeenCalled();

    // Both handles released, or a `pnpm reconcile:clerk` never returns.
    expect(close).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);

    // It did the work it exists to do, rather than exiting before reaching it.
    expect(reconcileClerkUsers).toHaveBeenCalledTimes(1);
  });
});
