import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/load-env.js';

loadEnv();

// DDL runs over the direct connection: a pooler in transaction mode cannot hold
// the session state drizzle-kit needs. Falls back to the pooled URL for a plain
// Postgres setup, which has only one.
const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Run `pnpm preflight` for the fix.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
