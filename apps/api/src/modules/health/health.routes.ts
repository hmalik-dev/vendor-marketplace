import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  timestamp: z.string(),
  database: z.enum(['up', 'down']),
});

/**
 * Liveness plus a database round-trip, which is what the platform health probe
 * actually needs to know. A failed probe still answers 200 with
 * `status: "degraded"` so the response body — not a transport error — carries
 * the diagnosis.
 */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/health', { schema: { response: { 200: healthResponseSchema } } }, async (request) => {
    let database: 'up' | 'down' = 'up';

    try {
      await app.db.execute(sql`select 1`);
    } catch (error) {
      database = 'down';
      request.log.error({ err: error }, 'Health check could not reach the database');
    }

    return {
      status: database === 'up' ? ('ok' as const) : ('degraded' as const),
      timestamp: new Date().toISOString(),
      database,
    };
  });
};
