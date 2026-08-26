import fp from 'fastify-plugin';
import type { AppDatabase } from '../lib/database.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: AppDatabase;
  }
}

export interface DatabasePluginOptions {
  db: AppDatabase;
}

/**
 * Decorates the instance with an already-open database handle. The connection
 * is owned by the caller (`src/index.ts` in production, the test harness in
 * suites) so the server factory stays free of process-lifetime concerns.
 */
export const databasePlugin = fp<DatabasePluginOptions>(
  async (app, options) => {
    app.decorate('db', options.db);
  },
  { name: 'database' },
);
