import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/load-env.js';
import { resolveMigrationUrl } from './src/migration-url.js';

loadEnv();

const databaseUrl = resolveMigrationUrl();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
