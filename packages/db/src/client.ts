import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface CreateDatabaseOptions {
  /** Postgres connection string. Defaults to `process.env.DATABASE_URL`. */
  connectionString?: string;
  /** Connection pool size. Scripts should use 1. */
  max?: number;
  /** Session settings sent as startup parameters, so every connection — and every reconnect — has them. */
  connection?: Record<string, string>;
}

/**
 * Opens a pooled connection. The caller owns the returned client and must call
 * `client.end()` on shutdown — long-lived servers keep one instance for the
 * process lifetime, short-lived scripts close theirs in a `finally`.
 */
export function createDatabase(options: CreateDatabaseOptions = {}): {
  db: Database;
  client: postgres.Sql;
} {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Run `pnpm preflight` for the fix.');
  }

  const client = postgres(connectionString, {
    max: options.max ?? 10,
    ...(options.connection ? { connection: options.connection } : {}),
  });
  return { db: drizzle(client, { schema }), client };
}
