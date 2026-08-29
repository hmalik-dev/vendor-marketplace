import { type CommandOutcome, runCommand } from '../exec.js';

/**
 * Local development runs on the Docker Postgres, not Neon: `pnpm dev` holds a
 * pool open, so a Neon compute never scales to zero and a few days of local
 * work can exhaust the project's CU allowance — which suspends the compute
 * shared with production. Lanes multiply that by the number of lanes, so a
 * lane takes its own *database* on the one local container instead of its own
 * Neon branch. No network, no quota, and creation is instant.
 */
export const POSTGRES_CONTAINER = 'vendor-marketplace-postgres';
export const POSTGRES_USER = 'vendor_marketplace';

const LANE_DATABASE_PREFIX = 'vendor_marketplace_lane_';

/** Reduces a ticket identifier to a safe, lowercase SQL identifier. */
export function laneDatabaseName(ticket: string): string {
  const slug = ticket
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!slug) {
    throw new Error(`Ticket ${ticket} contains no characters usable in a database identifier.`);
  }

  return `${LANE_DATABASE_PREFIX}${slug}`;
}

/** Swaps only the database name, so host, port, credentials and options survive. */
export function laneDatabaseUrl(baseUrl: string, databaseName: string): string {
  const url = new URL(baseUrl);

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('The base DATABASE_URL is not a postgres URI.');
  }

  url.pathname = `/${databaseName}`;

  return url.toString();
}

export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandOutcome>;

const DOCKER_TIMEOUT_MS = 60_000;

const defaultRunner: CommandRunner = (command, args) =>
  runCommand(command, args, DOCKER_TIMEOUT_MS);

function requireDocker(outcome: CommandOutcome, action: string): void {
  if (outcome.status === 'missing') {
    throw new Error(
      `docker is not installed or not running, so ${action} is impossible. ` +
        'Run `docker compose up -d` and re-run.',
    );
  }
}

export async function createLaneDatabase(
  ticket: string,
  baseUrl: string,
  run: CommandRunner = defaultRunner,
): Promise<string> {
  const name = laneDatabaseName(ticket);

  const outcome = await run('docker', [
    'exec',
    POSTGRES_CONTAINER,
    'createdb',
    '-U',
    POSTGRES_USER,
    name,
  ]);

  requireDocker(outcome, `create the lane database ${name}`);

  // A resumed lane already has its database; that is the desired end state.
  if (outcome.status === 'failed' && !/already exists/i.test(outcome.stderr)) {
    throw new Error(`Could not create the lane database ${name}: ${outcome.stderr}`);
  }

  return laneDatabaseUrl(baseUrl, name);
}

/** Idempotent: a database that is already gone is the desired end state. */
export async function dropLaneDatabase(
  ticket: string,
  run: CommandRunner = defaultRunner,
): Promise<void> {
  const name = laneDatabaseName(ticket);

  const outcome = await run('docker', [
    'exec',
    POSTGRES_CONTAINER,
    'dropdb',
    '-U',
    POSTGRES_USER,
    '--if-exists',
    name,
  ]);

  if (outcome.status === 'ok' || outcome.status === 'missing') {
    return;
  }

  if (/does not exist|no such container/i.test(outcome.stderr)) {
    return;
  }

  throw new Error(`Could not drop the lane database ${name}: ${outcome.stderr}`);
}
