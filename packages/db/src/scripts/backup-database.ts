import { spawn, spawnSync } from 'node:child_process';
import type postgres from 'postgres';

export type PgTool = 'pg_dump' | 'pg_restore';

export interface PgInvocation {
  command: string;
  args: string[];
  /** Merged over `process.env`. The only place a credential travels. */
  env: Record<string, string>;
}

export interface PlanPgOptions {
  /** Whether the tool is on `PATH`. */
  nativeAvailable: boolean;
  /** The compose Postgres container to borrow the tool from when it is not. */
  container: string;
}

/** `docker-compose.yml`'s `container_name`. */
export const COMPOSE_POSTGRES_CONTAINER = 'vendor-marketplace-postgres';
/** Inside its own container the server always listens here, whatever the host mapping. */
const CONTAINER_PORT = '5432';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const STDERR_TAIL_LINES = 20;

/**
 * libpq's own variables. A connection string on the command line would sit in
 * the process list and in any log line that echoes the command; these do not.
 */
export function pgEnvironment(url: URL): Record<string, string> {
  const entries: [string, string][] = [
    ['PGHOST', url.hostname],
    ['PGPORT', url.port || '5432'],
    ['PGUSER', decodeURIComponent(url.username)],
    ['PGPASSWORD', decodeURIComponent(url.password)],
    ['PGDATABASE', decodeURIComponent(url.pathname.slice(1))],
  ];
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode) {
    entries.push(['PGSSLMODE', sslmode]);
  }
  return Object.fromEntries(entries);
}

/**
 * Runs the tool from `PATH` — the workflow installs the Postgres 18 client — or,
 * on a laptop without one, from inside the compose container, which ships the
 * matching version. The fallback is for the local server only: a remote target
 * needs the client installed.
 */
export function planPgCommand(
  tool: PgTool,
  args: readonly string[],
  url: URL,
  options: PlanPgOptions,
): PgInvocation {
  const env = pgEnvironment(url);

  if (options.nativeAvailable) {
    return { command: tool, args: [...args], env };
  }

  if (!LOOPBACK.has(url.hostname)) {
    throw new Error(
      `${tool} is not installed, and only a local database can borrow it from the ${options.container} container. ` +
        'Install the Postgres 18 client.',
    );
  }

  const inside = { ...env, PGHOST: 'localhost', PGPORT: CONTAINER_PORT };
  // `-e NAME` with no value copies NAME from the docker CLI's own environment.
  const passThrough = Object.keys(inside).flatMap((name) => ['-e', name]);
  return {
    command: 'docker',
    args: ['exec', '-i', ...passThrough, options.container, tool, ...args],
    env: inside,
  };
}

export function isOnPath(tool: PgTool): boolean {
  return spawnSync(tool, ['--version'], { stdio: 'ignore' }).status === 0;
}

export interface PgResult {
  stdout: Buffer;
  exitCode: number;
  stderrTail: string;
}

/** Runs to completion; the caller decides what a non-zero exit means. */
export function runPg(invocation: PgInvocation, stdin?: Uint8Array): Promise<PgResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      env: { ...process.env, ...invocation.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const stderrTail = Buffer.concat(stderr)
        .toString('utf8')
        .trimEnd()
        .split('\n')
        .slice(-STDERR_TAIL_LINES)
        .join('\n');
      resolve({ stdout: Buffer.concat(stdout), exitCode: code ?? 1, stderrTail });
    });

    child.stdin.end(stdin);
  });
}

/**
 * Exact row counts for every user table, keyed `schema.table`. Run inside the
 * dump's snapshot these are the counts of the dump itself, not of a moment
 * either side of it.
 */
export async function countTableRows(sql: postgres.Sql): Promise<Record<string, number>> {
  const tables = await sql<{ schema: string; name: string }[]>`
    select schemaname as schema, tablename as name
    from pg_catalog.pg_tables
    where schemaname not in ('pg_catalog', 'information_schema')
    order by schemaname, tablename
  `;
  const counts: Record<string, number> = {};

  for (const { schema, name } of tables) {
    const [row] = await sql<{ rows: string }[]>`
      select count(*)::text as rows from ${sql(schema)}.${sql(name)}
    `;
    counts[`${schema}.${name}`] = Number(row?.rows ?? Number.NaN);
  }

  return counts;
}
