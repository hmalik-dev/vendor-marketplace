import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { expectedMigrationCount } from '@vendor-marketplace/db';
import { releaseIdentifier } from '@vendor-marketplace/shared/env';
import type { AppDatabase } from '../../lib/database.js';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
});

const dependencyStateSchema = z.enum(['up', 'down']);

/**
 * `behind` is a database that answers but has fewer migrations applied than
 * this build ships. It is its own state, not `down`, so the operator reads the
 * cause: the fix is running the migration, not restarting anything.
 */
const databaseStateSchema = z.enum(['up', 'down', 'behind']);

export const readyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  database: databaseStateSchema,
  storage: dependencyStateSchema,
  /**
   * The commit this process is running, or `null` off a platform.
   *
   * Readiness alone cannot tell a caller *which* build answered, so a
   * post-deploy check that only asked "are you ready?" would be satisfied by
   * the previous, still-healthy release while the new one was failing to boot.
   * Naming the commit is what makes the check able to wait for the deploy it
   * was triggered for.
   */
  commit: z.string().nullable(),
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

/**
 * Read once at load: the journal cannot change under a running build, and
 * `/ready` is unthrottled, so a per-request synchronous file read would let any
 * caller block the event loop. An unreadable journal fails the boot, not a probe.
 */
const EXPECTED_MIGRATIONS = expectedMigrationCount();

/**
 * The one database read `/ready` makes: how many migrations are applied.
 *
 * It doubles as the round trip, so a database that cannot answer this is `down`
 * exactly as it was under `select 1`. A database no migration has ever run on
 * has no such table and lands there too, with the driver's error in the log.
 */
async function appliedMigrations(db: AppDatabase): Promise<number> {
  const rows = await db
    .select({ applied: sql<number>`count(*)::int` })
    .from(sql`drizzle.__drizzle_migrations`);

  return rows[0]?.applied ?? 0;
}

/**
 * The release this process is: the commit the deploy workflow set as
 * `SENTRY_RELEASE`, or the platform's own commit variable. It is the identifier
 * the error tracker tags events with, so the commit `/ready` names is the commit
 * an error resolves to. There is no equivalent when the API runs from a working
 * copy, and a local `null` is the honest answer rather than a guess read out of
 * the developer's own clone.
 */
export function deployedCommit(source: NodeJS.ProcessEnv = process.env): string | null {
  return releaseIdentifier(source);
}

interface ProbeResult<T = unknown> {
  state: DependencyState;
  value?: T;
  error?: unknown;
}

/** Runs one dependency check under its own timeout, never throwing. */
async function probe<T>(run: () => Promise<T>, timeoutMs: number): Promise<ProbeResult<T>> {
  let timer: NodeJS.Timeout | undefined;
  const pending = Promise.resolve().then(run);
  // The race settles on the timeout while `pending` is still in flight, so a
  // late rejection would otherwise be unhandled and take the process down.
  pending.catch(() => undefined);

  try {
    const value = await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Dependency did not answer within ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
    return { state: 'up', value };
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
        probe(() => appliedMigrations(app.db), DEPENDENCY_TIMEOUT_MS),
        probe(() => app.storage.checkAvailable(), DEPENDENCY_TIMEOUT_MS),
      ]);

      if (database.error) {
        request.log.error({ err: database.error }, 'Readiness probe could not reach the database');
      }
      if (storage.error) {
        request.log.error({ err: storage.error }, 'Readiness probe could not reach object storage');
      }

      // Fewer applied than shipped is behind; more is a rollback and keeps serving.
      const expected = EXPECTED_MIGRATIONS;
      const behind = database.state === 'up' && (database.value ?? 0) < expected;
      if (behind) {
        request.log.error(
          { applied: database.value, expected },
          'Readiness probe found the database behind this build’s migrations',
        );
      }
      const databaseState: z.infer<typeof databaseStateSchema> = behind ? 'behind' : database.state;
      const ready = databaseState === 'up' && storage.state === 'up';

      return reply.code(ready ? 200 : 503).send({
        status: ready ? ('ready' as const) : ('not_ready' as const),
        database: databaseState,
        storage: storage.state,
        commit: deployedCommit(),
        timestamp: new Date().toISOString(),
      });
    },
  );
};
