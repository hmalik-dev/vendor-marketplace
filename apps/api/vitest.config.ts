import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Route suites boot an in-process Postgres (PGlite) and run migrations.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    /*
     * Every suite file boots its own PGlite, which is a WASM Postgres holding
     * hundreds of megabytes. Vitest defaults to roughly one worker per core,
     * and `turbo run test` runs the web suite alongside this one, so the
     * default put seven of them plus jsdom on an eight-gigabyte machine at
     * once — enough memory pressure that `createTestHarness` intermittently
     * blew the 60s hook timeout, on a different file each run. Capping the
     * pool trades a little wall-clock for a suite that does not fail on how
     * busy the machine happens to be.
     *
     * Lowered from three to two once `packages/db` grew an eighth suite: the
     * db package now runs its files one at a time, which makes it slower and
     * therefore overlapping with this one for longer, and three workers here
     * started blowing the same hook timeout again.
     */
    maxWorkers: 2,
  },
});
