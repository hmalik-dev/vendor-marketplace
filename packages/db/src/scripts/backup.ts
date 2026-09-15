import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { loadEnv } from '../load-env.js';
import { resolveMigrationUrl } from '../migration-url.js';
import { encryptBackup, parseRecipients, sha256Hex } from './backup-crypto.js';
import {
  COMPOSE_POSTGRES_CONTAINER,
  countTableRows,
  isOnPath,
  planPgCommand,
  runPg,
} from './backup-database.js';
import {
  assertMinimumSize,
  backupKeys,
  backupPrefix,
  keysToPrune,
  resolveMinimumBytes,
  type BackupManifest,
} from './backup-plan.js';
import { backupStoreFromEnv, type BackupStore } from './backup-store.js';

/** The operator's public key(s). The private half never enters the repository. */
export const RECIPIENTS_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../.github/backup-age-recipients.txt',
);

export interface DatabaseDump {
  dump: Uint8Array;
  rowCounts: Record<string, number>;
  serverVersion: string;
}

export interface BackupDependencies {
  environment: string;
  now: Date;
  recipients: readonly string[];
  minimumBytes: number;
  store: BackupStore;
  takeDump: () => Promise<DatabaseDump>;
  log: (line: string) => void;
}

/**
 * Dump → size floor → encrypt → upload the object, then its manifest → prune.
 *
 * The floor is checked before anything is written, so a failed dump neither
 * lands in the bucket nor ages a good backup out of retention. The manifest goes
 * last because the drill starts from the newest manifest: a run that dies
 * between the two uploads leaves yesterday's backup as the latest complete one.
 */
export async function runBackup(deps: BackupDependencies): Promise<BackupManifest> {
  const { dump, rowCounts, serverVersion } = await deps.takeDump();
  assertMinimumSize(dump.byteLength, deps.minimumBytes);

  const encrypted = await encryptBackup(dump, deps.recipients);
  const keys = backupKeys(deps.environment, deps.now);
  const manifest: BackupManifest = {
    version: 1,
    environment: deps.environment,
    createdAt: deps.now.toISOString(),
    dumpKey: keys.dump,
    dumpBytes: dump.byteLength,
    encryptedBytes: encrypted.byteLength,
    encryptedSha256: sha256Hex(encrypted),
    serverVersion,
    rowCounts,
  };

  await deps.store.put(keys.dump, encrypted, 'application/octet-stream');
  await deps.store.put(
    keys.manifest,
    new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
    'application/json',
  );

  const prefix = backupPrefix(deps.environment);
  const stale = keysToPrune(await deps.store.list(prefix), deps.environment, deps.now);
  if (stale.length > 0) {
    await deps.store.remove(stale);
  }

  deps.log(
    `Stored ${keys.dump} (${encrypted.byteLength} bytes encrypted, ` +
      `${Object.keys(rowCounts).length} tables); pruned ${stale.length} expired objects.`,
  );
  return manifest;
}

/**
 * Counts and dump from **one** snapshot: the counts are read in a repeatable-read
 * transaction that exports its snapshot, and `pg_dump --snapshot` dumps exactly
 * that. Writes landing mid-run change neither, so the manifest describes the dump.
 * Needs a direct connection — a transaction-mode pooler cannot hold the snapshot.
 */
export async function dumpInSnapshot(url: URL): Promise<DatabaseDump> {
  const sql = postgres(url.toString(), { max: 1 });
  const session = await sql.reserve();

  try {
    await session`begin isolation level repeatable read read only`;
    const [exported] = await session<
      { snapshot: string }[]
    >`select pg_export_snapshot() as snapshot`;
    const [version] = await session<{ server_version: string }[]>`show server_version`;
    if (!exported || !version) {
      throw new Error('The database did not export a snapshot to dump from.');
    }
    const rowCounts = await countTableRows(session);

    const invocation = planPgCommand(
      'pg_dump',
      ['--format=custom', '--no-owner', '--no-privileges', `--snapshot=${exported.snapshot}`],
      url,
      { nativeAvailable: isOnPath('pg_dump'), container: COMPOSE_POSTGRES_CONTAINER },
    );
    const result = await runPg(invocation);
    if (result.exitCode !== 0) {
      throw new Error(`pg_dump exited ${result.exitCode}:\n${result.stderrTail}`);
    }

    await session`commit`;
    return { dump: result.stdout, rowCounts, serverVersion: version.server_version };
  } finally {
    session.release();
    await sql.end();
  }
}

async function main(): Promise<void> {
  loadEnv();

  const environment = process.env.BACKUP_ENVIRONMENT?.trim();
  if (!environment) {
    throw new Error('BACKUP_ENVIRONMENT is not set — name the database being backed up.');
  }
  const url = new URL(resolveMigrationUrl());

  await runBackup({
    environment,
    now: new Date(),
    recipients: parseRecipients(
      readFileSync(process.env.BACKUP_AGE_RECIPIENTS_FILE ?? RECIPIENTS_FILE, 'utf8'),
    ),
    minimumBytes: resolveMinimumBytes(process.env.BACKUP_MIN_BYTES),
    store: backupStoreFromEnv(),
    takeDump: () => dumpInSnapshot(url),
    log: (line) => console.log(line),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
