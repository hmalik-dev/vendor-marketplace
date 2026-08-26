import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
});

const dependencyStateSchema = z.enum(['up', 'down']);

export const readyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  database: dependencyStateSchema,
  storage: dependencyStateSchema,
  timestamp: z.string(),
});

type DependencyState = z.infer<typeof dependencyStateSchema>;

/**
 * Ceiling for a single readiness dependency. It has to sit well below the
 * platform's probe timeout: a stalled dependency that takes longer than the
 * probe turns "withhold traffic" into "probe timed out, restart the container",
 * which is a restart loop rather than a readiness failure.
 */
const DEPENDENCY_TIMEOUT_MS = 2_000;

interface ProbeResult {
  state: DependencyState;
  error?: unknown;
}

/** Runs one dependency check under its own timeout, never throwing. */
async function probe(run: () => Promise<unknown>, timeoutMs: number): Promise<ProbeResult> {
  let timer: NodeJS.Timeout | undefined;
  const pending = Promise.resolve().then(run);
  // The race settles on the timeout while `pending` is still in flight, so a
  // late rejection would otherwise be unhandled and take the process down.
  pending.catch(() => undefined);

  try {
    await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Dependency did not answer within ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
    return { state: 'up' };
  } catch (error) {
    return { state: 'down', error };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The two probes the hosting platform reads, deliberately kept apart.
 *
 * `/health` is liveness: it answers from the event loop alone, because the only
 * remedy for a failed liveness probe is a restart and a restart cannot fix a
 * dependency outage. `/ready` is readiness: it round-trips every dependency and
 * answers 503 when one is down, so the platform stops routing traffic into
 * failures while leaving the process alone.
 *
 * Both are unauthenticated and exempt from rate limiting — a limiter that
 * throttles the probe takes the service down by itself — and neither depends on
 * CORS, since the caller is the platform rather than a browser.
 */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    { config: { rateLimit: false }, schema: { response: { 200: healthResponseSchema } } },
    async () => ({ status: 'ok' as const, timestamp: new Date().toISOString() }),
  );

  app.get(
    '/ready',
    {
      config: { rateLimit: false },
      schema: { response: { 200: readyResponseSchema, 503: readyResponseSchema } },
    },
    async (request, reply) => {
      const [database, storage] = await Promise.all([
        probe(() => app.db.execute(sql`select 1`), DEPENDENCY_TIMEOUT_MS),
        probe(() => app.storage.checkAvailable(), DEPENDENCY_TIMEOUT_MS),
      ]);

      if (database.error) {
        request.log.error({ err: database.error }, 'Readiness probe could not reach the database');
      }
      if (storage.error) {
        request.log.error({ err: storage.error }, 'Readiness probe could not reach object storage');
      }

      const ready = database.state === 'up' && storage.state === 'up';

      return reply.code(ready ? 200 : 503).send({
        status: ready ? ('ready' as const) : ('not_ready' as const),
        database: database.state,
        storage: storage.state,
        timestamp: new Date().toISOString(),
      });
    },
  );
};
