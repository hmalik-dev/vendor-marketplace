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
     * Lowered to one. Two still blew the hook timeout intermittently once the
     * db package began running its files serially and the web package's own
     * ceiling went up — both of which keep those suites alive longer and so
     * overlapping with this one for longer. Every file here boots a WASM
     * Postgres; one at a time is the only setting that does not depend on how
     * busy the rest of the run happens to be.
     */
    maxWorkers: 1,
  },
});
