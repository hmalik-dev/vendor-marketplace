import { defineConfig } from 'vitest/config';

/**
 * The contract suites that need a real Neon Auth branch (VEN-649), named by
 * `NEON_AUTH_CONTRACT_DATABASE_URL`.
 *
 * Kept out of `pnpm test` for the reason the contention suites are: that task
 * must stay runnable with nothing but Node. `test:neon` fails loudly when the
 * branch is not named rather than skipping.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.neon.test.ts'],
    // A suspended Neon compute takes seconds to wake.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
