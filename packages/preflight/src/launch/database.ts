import postgres from 'postgres';
import { hostOf, NEON_HOST, readMigrationJournal } from '../checks/database.js';
import {
  failed,
  judge,
  passed,
  type LaunchOptions,
  type LaunchResult,
  type Probe,
} from './types.js';

const CONNECT_TIMEOUT_SECONDS = 10;
const PRODUCTION_BRANCH = 'production';

export interface SeedMarkers {
  /** `clerk_user_id` prefix of every marketing-seed user. */
  readonly marketingPrefix: string;
  /** `clerk_user_id` prefix of every demo-seed user. */
  readonly demoPrefix: string;
  /** Slug of the E2E seed's vendor storefront. */
  readonly e2eVendorSlug: string;
}

export interface SeedRowCounts {
  readonly marketing: number;
  readonly demo: number;
  readonly e2e: number;
}

export interface LaunchDatabase {
  seedRowCounts(): Promise<SeedRowCounts>;
  /** Tags of the repository's migrations the database has not applied. */
  pendingMigrations(): Promise<readonly string[]>;
}

export interface PostgresLaunchDatabaseOptions {
  readonly connectionString: string;
  readonly repoRoot: string;
  readonly markers: SeedMarkers;
}

/**
 * The production database, opened read-only: every transaction on the session
 * defaults to `READ ONLY`, so a write would be refused by Postgres itself.
 */
export function postgresLaunchDatabase(
  options: PostgresLaunchDatabaseOptions,
): LaunchDatabase & { close(): Promise<void> } {
  const sql = postgres(options.connectionString, {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    connection: { default_transaction_read_only: true },
    onnotice: () => undefined,
  });
  const { marketingPrefix, demoPrefix, e2eVendorSlug } = options.markers;

  return {
    async seedRowCounts() {
      const [row] = await sql<SeedRowCounts[]>`
        select
          (select count(*)::int from users where starts_with(clerk_user_id, ${marketingPrefix})) as marketing,
          (select count(*)::int from users where starts_with(clerk_user_id, ${demoPrefix})) as demo,
          (select count(*)::int from vendor_profiles where slug = ${e2eVendorSlug}) as e2e
      `;
      if (!row) {
        throw new Error('the seed-row count returned nothing');
      }
      return row;
    },
    async pendingMigrations() {
      const journal = readMigrationJournal(options.repoRoot);
      if (!journal) {
        throw new Error('packages/db/drizzle/meta/_journal.json is missing');
      }

      const rows = await sql<{ created_at: string }[]>`
        select created_at::text as created_at from drizzle.__drizzle_migrations
      `;
      const applied = new Set(rows.map((row) => row.created_at));
      return journal.filter((entry) => !applied.has(String(entry.when))).map((entry) => entry.tag);
    },
    close: () => sql.end(),
  };
}

function branchResult(env: NodeJS.ProcessEnv): LaunchResult {
  const name = 'database branch';
  const host = hostOf(env.DATABASE_URL);

  if (!host || !NEON_HOST.test(host)) {
    return failed('database', name, `DATABASE_URL host ${host ?? 'unset'} is not a Neon endpoint`);
  }

  const branch = env.NEON_BRANCH?.trim();
  return judge(
    'database',
    name,
    branch || 'NEON_BRANCH unset',
    branch === PRODUCTION_BRANCH,
    PRODUCTION_BRANCH,
  );
}

export function databaseProbes({ env, database }: LaunchOptions): Probe[] {
  const branch: Probe = {
    group: 'database',
    name: 'database branch',
    run: async () => [branchResult(env)],
  };

  if (!database) {
    return [
      branch,
      {
        group: 'database',
        name: 'database',
        run: async () => [
          failed(
            'database',
            'database',
            'DATABASE_URL is unset, so seeded rows and migrations cannot be read',
          ),
        ],
      },
    ];
  }

  return [
    branch,
    {
      group: 'database',
      name: 'seeded rows',
      async run() {
        const { marketing, demo, e2e } = await database.seedRowCounts();
        const found = `marketing ${marketing}, demo ${demo}, e2e ${e2e}`;
        return [judge('database', 'seeded rows', found, marketing + demo + e2e === 0, '0')];
      },
    },
    {
      group: 'database',
      name: 'migrations',
      async run() {
        const pending = await database.pendingMigrations();
        return [
          pending.length === 0
            ? passed('database', 'migrations', 'at the repository latest')
            : failed('database', 'migrations', `${pending.length} pending: ${pending.join(', ')}`),
        ];
      },
    },
  ];
}
