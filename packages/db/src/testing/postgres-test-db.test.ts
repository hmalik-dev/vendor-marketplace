import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPostgresTestDatabase } from './postgres-test-db.js';

/**
 * The refusals that run before a single connection is opened.
 *
 * They are worth their own file because this factory issues **cluster-level
 * DDL** — `create database` and `drop database` — which no other caller in the
 * package does. What actually bounds it is the name: both statements can only
 * ever refer to the fresh UUID it just minted. These assertions cover the layer
 * above that, so a refactor cannot quietly drop the guard or start connecting
 * before it has run.
 *
 * The create/drop lifecycle itself needs a server and lives in
 * `postgres-test-db.contention.test.ts`.
 */
describe('createPostgresTestDatabase refuses before it connects', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /*
   * Empty rather than deleted: `serverUrl` calls `loadEnv`, and `dotenv` fills
   * a key that is absent from `process.env` but leaves an empty one alone. So
   * deleting it here would read the developer's real `.env` and pass.
   */
  it('refuses when DATABASE_URL is not set', async () => {
    vi.stubEnv('DATABASE_URL', '');

    await expect(createPostgresTestDatabase()).rejects.toThrow(/DATABASE_URL is not set/);
  });

  it('refuses a connection string it cannot parse', async () => {
    vi.stubEnv('DATABASE_URL', 'not a connection string');

    await expect(createPostgresTestDatabase()).rejects.toThrow(/not a parseable connection string/);
  });

  it('refuses to run under NODE_ENV=production', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://someone@db.example.test:5432/anything');
    vi.stubEnv('NODE_ENV', 'production');

    await expect(createPostgresTestDatabase()).rejects.toThrow(/NODE_ENV=production/);
  });
});
