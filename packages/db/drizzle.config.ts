import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/load-env.js';

loadEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env at the repository root, then run `docker compose up -d`.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
