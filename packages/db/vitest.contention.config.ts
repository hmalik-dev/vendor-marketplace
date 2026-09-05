import { defineConfig } from 'vitest/config';

/**
 * The suites that need the real Postgres server `DATABASE_URL` names, rather
 * than the in-process PGlite every other file here boots.
 *
 * Kept out of `pnpm test` on purpose: that task must stay runnable with nothing
 * but Node. `pnpm test:contention` is the one that needs the server, and it
 * fails loudly when it is not there rather than skipping.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.contention.test.ts'],
    // Creating a database and replaying the whole migration set.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
