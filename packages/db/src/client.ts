import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface CreateDatabaseOptions {
  /** Postgres connection string. Defaults to `process.env.DATABASE_URL`. */
  connectionString?: string;
  /** Connection pool size. Scripts should use 1. */
  max?: number;
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
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env at the repository root, then run `docker compose up -d`.',
    );
  }

  const client = postgres(connectionString, { max: options.max ?? 10 });
  return { db: drizzle(client, { schema }), client };
}
