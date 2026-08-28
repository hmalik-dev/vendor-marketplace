import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Migration + seed suites each boot their own in-process Postgres.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    /*
     * One suite at a time **within this package**.
     *
     * Every file here boots its own in-process Postgres and runs the full
     * migration set in `beforeAll`. Run concurrently, eight of them starve
     * each other and the hook times out — which reads as a broken migration
     * rather than as contention, and passes on the next run, so it teaches
     * people to rerun instead of to look.
     *
     * Turborepo still runs the five packages in parallel, so this costs a few
     * seconds of wall clock and buys a suite that means what it says.
     */
    fileParallelism: false,
  },
});
