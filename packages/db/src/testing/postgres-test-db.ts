import { randomUUID } from 'node:crypto';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadEnv } from '../load-env.js';
import * as schema from '../schema/index.js';
import { assertSafeTarget } from '../scripts/safe-target.js';
import { MIGRATIONS_FOLDER } from './test-db.js';

/**
 * A throwaway database on a **real** Postgres server, with a pool wide enough
 * for two callers to be in flight at once.
 *
 * PGlite — what every other suite in this repository runs on — is a single
 * connection that runs each `db.transaction` callback to completion before the
 * next one starts. That is enough for SQL and it is not enough for a lock: a
 * test that fires two writes with `Promise.all` against PGlite passes whether
 * or not the lock exists, because the second transaction never overlaps the
 * first. #399 shipped row-level guards that only a second connection can hold
 * to account, so those suites run here instead.
 *
 * Requires Postgres to be reachable, and says so rather than skipping: a
 * contention test that quietly does not run is the same green as no test.
 */
export interface PostgresTestDatabase {
  db: PostgresJsDatabase<typeof schema>;
  /** The throwaway database's name, so a suite can assert it was cleaned up. */
  name: string;
  /** Closes the pool and drops the throwaway database. */
  close: () => Promise<void>;
}

export interface PostgresTestDatabaseOptions {
  /**
   * Connections the pool may open. Two is the floor for a contention test —
   * one per racing caller — and the default leaves room for the reads a suite
   * makes around them.
   */
  poolSize?: number;
}

/** Postgres caps an identifier at 63 bytes; this is 48. */
function throwawayName(): string {
  return `contention_test_${randomUUID().replaceAll('-', '')}`;
}

function serverUrl(): URL {
  /*
   * Vitest is not a package script, so nothing has read the repository's `.env`
   * by the time a suite calls this. Real process variables still win, which is
   * what keeps `pnpm lane:exec` pointing this at the lane's own database and CI
   * at its service container.
   */
  loadEnv();

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set, so the contention suites have no Postgres to run against. ' +
        'Start the local services with `docker compose up -d`.',
    );
  }

  try {
    return new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a parseable connection string.');
  }
}

/**
 * Creates a database of its own, migrates it, and hands back a pooled handle.
 *
 * The database is thrown away rather than shared, so a contention suite can
 * neither read nor damage the rows a developer is working with on the same
 * server — and two lanes running the suite at once do not collide.
 *
 * `assertSafeTarget` is the guard the fabricating seeds use, and it is worth
 * being exact about what it does and does not buy here. It refuses
 * `NODE_ENV=production` and a protected Neon branch, and it passes
 * unconditionally for any non-Neon host — so it is not what makes this safe.
 * What makes it safe is that the only identifier either DDL statement names is
 * the freshly minted UUID above: nothing this function runs can reach a
 * database it did not just create, whatever server it is pointed at. The worst
 * case is an orphan database, which is also what a killed process leaves
 * behind — `contention_test_*` on the local server is always droppable.
 */
export async function createPostgresTestDatabase(
  options: PostgresTestDatabaseOptions = {},
): Promise<PostgresTestDatabase> {
  // `serverUrl` first, because it is what loads `.env` for the guard to read.
  const url = serverUrl();
  assertSafeTarget('a throwaway contention-test database');

  const name = throwawayName();
  const admin = postgres(url.toString(), { max: 1 });

  try {
    await admin.unsafe(`create database "${name}"`);
  } catch (error) {
    await admin.end();
    throw new Error(`Could not create a contention-test database on ${url.hostname}`, {
      cause: error,
    });
  }

  const target = new URL(url.toString());
  target.pathname = `/${name}`;

  const client = postgres(target.toString(), { max: options.poolSize ?? 4 });
  const db = drizzle(client, { schema });

  const drop = async (): Promise<void> => {
    // `with (force)` because a connection the suite failed to close would
    // otherwise leave the database behind on every run.
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.end();
  };

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } catch (error) {
    await client.end();
    await drop();
    throw error;
  }

  /*
   * Idempotent, because a suite that closes a database itself and *also*
   * closes it from an `afterEach` sweep is the shape that keeps one from being
   * stranded. Without this the second call queries an ended pool and throws.
   */
  let closed = false;

  return {
    db,
    name,
    close: async () => {
      if (closed) {
        return;
      }

      closed = true;
      await client.end();
      await drop();
    },
  };
}
