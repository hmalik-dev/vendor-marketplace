import { defineConfig } from 'vitest/config';

/**
 * The suites that need two connections to one database.
 *
 * Everything else in this package runs on PGlite, which is a single connection
 * and therefore cannot tell a row lock from its absence: two transactions
 * never overlap there, so a `Promise.all` test passes with the lock deleted
 * (#399). These files run against the real Postgres `DATABASE_URL` points at —
 * the Docker service locally, a service container in CI — each creating and
 * dropping a database of its own.
 *
 * Kept out of `pnpm test` on purpose: that task must stay runnable with nothing
 * but Node. `pnpm test:contention` is the one that needs the server, and it
 * fails loudly when it is not there rather than skipping.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.contention.test.ts'],
    // Migrating a fresh database and then blocking one request on another.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One file at a time: each holds its own pool against a shared server.
    maxWorkers: 1,
  },
});
