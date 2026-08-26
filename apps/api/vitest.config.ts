import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Route suites boot an in-process Postgres (PGlite) and run migrations.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
