import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Migration + seed suites each boot their own in-process Postgres.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
