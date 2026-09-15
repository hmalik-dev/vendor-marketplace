import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { loadEnv } from '../load-env.js';
import { decryptBackup, sha256Hex } from './backup-crypto.js';
import {
  COMPOSE_POSTGRES_CONTAINER,
  countTableRows,
  isOnPath,
  planPgCommand,
  runPg,
} from './backup-database.js';
import {
  backupPrefix,
  compareRowCounts,
  dumpKeyFor,
  latestManifestKey,
  parseManifest,
  type BackupManifest,
  type RowCountMismatch,
} from './backup-plan.js';
import { backupStoreFromEnv, type BackupStore } from './backup-store.js';
import { assertSafeTarget, type SafeTargetOptions } from './safe-target.js';

export const RESTORE_TARGET: SafeTargetOptions = {
  action: 'restore',
  connectionVariable: 'RESTORE_DATABASE_URL',
  branchVariable: 'RESTORE_NEON_BRANCH',
};

/** Where restored rows go: always a database this drill has just created. */
export interface RestoreTarget {
  create: (name: string) => Promise<void>;
  /** Resolves with pg_restore's exit code and the tail of its stderr. */
  restore: (name: string, dump: Uint8Array) => Promise<{ exitCode: number; stderrTail: string }>;
  count: (name: string) => Promise<Record<string, number>>;
  drop: (name: string) => Promise<void>;
}

export interface DrillDependencies {
  environment: string;
  identity: string;
  /** Manifests dated after this are ignored — see `latestManifestKey`. */
  now: Date;
  store: BackupStore;
  target: RestoreTarget;
  /** Leave the restored database in place — the runbook's single-table restore needs it. */
  keep: boolean;
  log: (line: string) => void;
  /** Injectable for the suite; see `safe-target.test.ts` for why. */
  repoRoot?: string;
}

export interface DrillReport {
  manifest: BackupManifest;
  database: string;
  restored: Record<string, number>;
  mismatches: RowCountMismatch[];
}

function drillDatabaseName(): string {
  return `restore_drill_${Date.now()}_${randomBytes(3).toString('hex')}`;
}

async function fetchLatest(
  store: BackupStore,
  environment: string,
  now: Date,
): Promise<{ manifest: BackupManifest; ciphertext: Uint8Array }> {
  const key = latestManifestKey(await store.list(backupPrefix(environment)), environment, now);
  if (!key) {
    throw new Error(`The backups bucket holds no ${environment} backup yet.`);
  }

  const manifest = parseManifest(new TextDecoder().decode(await store.get(key)));
  // A manifest may only describe the dump beside it, for the environment asked
  // for — never point the drill at some other object in the bucket.
  if (manifest.dumpKey !== dumpKeyFor(key) || manifest.environment !== environment) {
    throw new Error(
      `${key} names a dump or environment other than its own. Refusing to restore it.`,
    );
  }
  const ciphertext = await store.get(manifest.dumpKey);
  if (sha256Hex(ciphertext) !== manifest.encryptedSha256) {
    throw new Error(`${manifest.dumpKey} does not match its manifest's digest — it is corrupt.`);
  }
  return { manifest, ciphertext };
}

/**
 * Latest backup → verify → decrypt → restore into a **new** database → count.
 *
 * The guard runs before anything is downloaded. It is the seeds' guard pointed at
 * the restore target; the drill additionally never names an existing database,
 * so even a permitted server only ever gains one.
 */
export async function runRestoreDrill(deps: DrillDependencies): Promise<DrillReport> {
  assertSafeTarget('a backup', deps.repoRoot, RESTORE_TARGET);

  const { manifest, ciphertext } = await fetchLatest(deps.store, deps.environment, deps.now);
  const dump = await decryptBackup(ciphertext, deps.identity);
  deps.log(`Restoring ${manifest.dumpKey}, taken ${manifest.createdAt}.`);

  const database = drillDatabaseName();
  await deps.target.create(database);

  try {
    const result = await deps.target.restore(database, dump);
    if (result.exitCode !== 0) {
      // Counts, not the exit code, decide the drill: pg_restore also exits
      // non-zero for objects it could not recreate but the data does not need.
      deps.log(`pg_restore exited ${result.exitCode}:\n${result.stderrTail}`);
    }

    const restored = await deps.target.count(database);
    return {
      manifest,
      database,
      restored,
      mismatches: compareRowCounts(manifest.rowCounts, restored),
    };
  } finally {
    if (deps.keep) {
      deps.log(`Kept the restored database ${database}.`);
    } else {
      await deps.target.drop(database);
    }
  }
}

function databaseUrl(server: URL, name: string): URL {
  const url = new URL(server.toString());
  url.pathname = `/${name}`;
  return url;
}

/** Parsed on first use, so `runRestoreDrill`'s guard reports a bad target first. */
function postgresTarget(connectionString: string): RestoreTarget {
  const server = (): URL => new URL(connectionString);
  const withDatabase = async <T>(
    name: string,
    run: (sql: postgres.Sql) => Promise<T>,
  ): Promise<T> => {
    const sql = postgres(databaseUrl(server(), name).toString(), { max: 1 });
    try {
      return await run(sql);
    } finally {
      await sql.end();
    }
  };
  const maintenance = (): string => decodeURIComponent(server().pathname.slice(1));

  return {
    create: (name) =>
      withDatabase(maintenance(), async (sql) => void (await sql`create database ${sql(name)}`)),
    drop: (name) =>
      withDatabase(
        maintenance(),
        async (sql) => void (await sql`drop database if exists ${sql(name)} with (force)`),
      ),
    restore: (name, dump) => {
      const target = databaseUrl(server(), name);
      const invocation = planPgCommand(
        'pg_restore',
        ['--no-owner', '--no-privileges', `--dbname=${name}`],
        target,
        { nativeAvailable: isOnPath('pg_restore'), container: COMPOSE_POSTGRES_CONTAINER },
      );
      return runPg(invocation, dump);
    },
    count: (name) => withDatabase(name, countTableRows),
  };
}

function printReport(report: DrillReport): void {
  const tables = [
    ...new Set([...Object.keys(report.manifest.rowCounts), ...Object.keys(report.restored)]),
  ].sort();
  const width = Math.max(...tables.map((table) => table.length), 'table'.length);

  console.log(`${'table'.padEnd(width)}  ${'at dump'.padStart(10)}  ${'restored'.padStart(10)}`);
  for (const table of tables) {
    const expected = report.manifest.rowCounts[table];
    const actual = report.restored[table];
    const flag = expected === actual ? '' : '  MISMATCH';
    console.log(
      `${table.padEnd(width)}  ${String(expected ?? '-').padStart(10)}  ${String(actual ?? '-').padStart(10)}${flag}`,
    );
  }
  console.log(
    report.mismatches.length === 0
      ? `Restore drill passed: ${tables.length} tables match the manifest.`
      : `Restore drill FAILED: ${report.mismatches.length} tables differ from the manifest.`,
  );
}

async function main(): Promise<void> {
  loadEnv();
  process.env.RESTORE_DATABASE_URL ||= process.env.DATABASE_URL;

  const environment = process.env.BACKUP_ENVIRONMENT?.trim();
  const identity = process.env.BACKUP_AGE_IDENTITY?.trim();
  if (!environment) {
    throw new Error('BACKUP_ENVIRONMENT is not set — name whose backup to restore.');
  }
  if (!identity) {
    throw new Error('BACKUP_AGE_IDENTITY is not set — the operator holds the private key.');
  }
  const report = await runRestoreDrill({
    environment,
    identity,
    now: new Date(),
    store: backupStoreFromEnv(),
    target: postgresTarget(process.env.RESTORE_DATABASE_URL ?? ''),
    keep: process.argv.includes('--keep'),
    log: (line) => console.log(line),
  });

  printReport(report);
  if (report.mismatches.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
