import { readFileSync } from 'node:fs';
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

/**
 * Whether the API's database role is one row-level security binds (VEN-671).
 * `bypassed` is a role with `BYPASSRLS` or superuser, `owner` one that owns the
 * `public` tables (an owner is exempt from policies that are not `FORCE`d), and
 * `unknown` a check that could not run. `not_checked` is a local API, where the
 * owner role is the intended connection.
 */
const rowLevelSecuritySchema = z.enum(['enforced', 'bypassed', 'owner', 'unknown', 'not_checked']);

export const readyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  database: databaseStateSchema,
  /** Reported, never gating: only uploads depend on object storage, and a blip must not fail a release. */
  storage: dependencyStateSchema,
  rowLevelSecurity: rowLevelSecuritySchema,
  /** Names what made the API not ready when the cause is the database role; otherwise `null`. */
  reason: z.string().nullable(),
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

const RLS_REASONS = {
  bypassed:
    'The API connects as a role with BYPASSRLS or superuser, so row-level security is not enforced; point DATABASE_URL at app_api (docs/app-api-role.md)',
  owner:
    'The API connects as the owner of the public tables, which row-level security does not bind; point DATABASE_URL at app_api (docs/app-api-role.md)',
  unknown: 'The database role could not be inspected, so row-level security is unproven',
} as const;

/** Reads what the connected role is, straight from the catalog; `pg_roles` and `pg_tables` are readable by every role. */
async function connectedRolePosture(db: AppDatabase): Promise<'enforced' | 'bypassed' | 'owner'> {
  const rows = await db
    .select({
      bypass: sql<boolean>`(r.rolbypassrls or r.rolsuper)`,
      owns: sql<boolean>`exists (
        select 1 from pg_tables t
         where t.schemaname = 'public' and pg_has_role(current_user, t.tableowner, 'USAGE')
      )`,
    })
    .from(sql`pg_roles r`)
    .where(sql`r.rolname = current_user`);
  const role = rows[0];

  if (!role) {
    throw new Error('current_user has no pg_roles row');
  }

  return role.bypass ? 'bypassed' : role.owns ? 'owner' : 'enforced';
}

export interface HealthRoutesOptions {
  /** Staging and production must run under a role row-level security binds; `local` is not checked. */
  deployEnv: string;
}

/**
 * The file the image build writes the commit into (`apps/api/Dockerfile`,
 * `ARG RELEASE_COMMIT`), relative to the working directory the image starts in.
 */
export const RELEASE_COMMIT_FILE = 'RELEASE_COMMIT';

/**
 * The commit baked into this image, or `null` when it carries none (a local
 * run, or an image built before the file existed). A file, not an `ENV`, so a
 * service variable set on the host at runtime cannot rename what the image is.
 */
export function bakedCommit(file: string = RELEASE_COMMIT_FILE): string | null {
  try {
    return readFileSync(file, 'utf8').trim() || null;
  } catch {
    // No file is the local and pre-VEN-634 case; the variables below still answer.
    return null;
  }
}

/** Read once: it cannot change while the process runs, and `/ready` is unthrottled. */
const BAKED_COMMIT = bakedCommit();

/**
 * The release this process is. The commit baked into the image comes first
 * (VEN-634): a variable follows a redeploy of an older image, or a failed `up`,
 * and would then name a commit that is not running. The variables remain the
 * fallback for an image without one: the commit the deploy workflow set as
 * `SENTRY_RELEASE`, or the platform's own commit variable. `SENTRY_RELEASE` is
 * still what the error tracker tags events with. There is no equivalent when the
 * API runs from a working copy, and a local `null` is the honest answer rather
 * than a guess read out of the developer's own clone.
 */
export function deployedCommit(
  source: NodeJS.ProcessEnv = process.env,
  baked: string | null = BAKED_COMMIT,
): string | null {
  return baked ?? releaseIdentifier(source);
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
export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (app, options) => {
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
      const checkRole = options.deployEnv !== 'local';
      const [database, storage, role] = await Promise.all([
        probe(() => appliedMigrations(app.db), DEPENDENCY_TIMEOUT_MS),
        probe(() => app.storage.checkAvailable(), DEPENDENCY_TIMEOUT_MS),
        checkRole ? probe(() => connectedRolePosture(app.db), DEPENDENCY_TIMEOUT_MS) : undefined,
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
          "Readiness probe found the database behind the build's migrations",
        );
      }
      const databaseState: z.infer<typeof databaseStateSchema> = behind ? 'behind' : database.state;
      const rowLevelSecurity: z.infer<typeof rowLevelSecuritySchema> = !role
        ? 'not_checked'
        : (role.value ?? 'unknown');
      // A database that is down or behind is its own answer; the role is named only once it is reachable.
      const roleFault =
        databaseState === 'up' &&
        rowLevelSecurity !== 'enforced' &&
        rowLevelSecurity !== 'not_checked'
          ? rowLevelSecurity
          : null;
      if (roleFault) {
        request.log.error({ err: role?.error, rowLevelSecurity }, RLS_REASONS[roleFault]);
      }
      // Storage is reported above and never gates: only uploads depend on it.
      const ready = databaseState === 'up' && roleFault === null;

      return reply.code(ready ? 200 : 503).send({
        status: ready ? ('ready' as const) : ('not_ready' as const),
        database: databaseState,
        storage: storage.state,
        rowLevelSecurity,
        reason: roleFault ? RLS_REASONS[roleFault] : null,
        commit: deployedCommit(),
        timestamp: new Date().toISOString(),
      });
    },
  );
};
