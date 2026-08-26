/**
 * Picks the connection string DDL runs over.
 *
 * Neon's pooled endpoint is PgBouncer in transaction mode: it does not pin a
 * session, so the advisory lock Drizzle's migrator takes and the DDL it issues
 * are not guaranteed to see the same backend. That fails non-deterministically
 * under concurrency while succeeding often enough to look correct, which is why
 * migrations and drizzle-kit prefer the direct endpoint whenever one is
 * configured. A plain Postgres setup has only `DATABASE_URL`, so falling back
 * to it keeps offline work running.
 */
export function resolveMigrationUrl(source: NodeJS.ProcessEnv = process.env): string {
  const direct = source.DATABASE_URL_UNPOOLED?.trim();
  if (direct) {
    return direct;
  }

  const pooled = source.DATABASE_URL?.trim();
  if (pooled) {
    return pooled;
  }

  throw new Error(
    'Neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set, so there is no database to migrate. ' +
      'Run `pnpm preflight` for the fix.',
  );
}
