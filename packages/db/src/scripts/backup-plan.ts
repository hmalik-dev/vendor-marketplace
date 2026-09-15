/**
 * The pure half of the nightly backup: where objects live, which ones retention
 * keeps, what a manifest must hold, and whether a restore agrees with it. Kept
 * free of I/O so every rule here is a unit test rather than a workflow run.
 */

export const BACKUP_ROOT = 'db';

/**
 * A custom-format dump of this schema with no rows at all is tens of kilobytes,
 * so anything smaller is not a database — an empty file from a dump that
 * failed quietly, or a connection to the wrong, empty branch.
 */
export const DEFAULT_MIN_DUMP_BYTES = 65_536;

const DAILY_RETENTION_DAYS = 30;
const MONTHLY_RETENTION_MONTHS = 12;
const DAY_MS = 86_400_000;

const ENVIRONMENT = /^[a-z0-9][a-z0-9-]{0,31}$/;
const OBJECT_KEY = /^(\d{4})\/(\d{2})\/(\d{2})-\d{6}\.(dump\.age|manifest\.json)$/;
const DUMP_SUFFIX = '.dump.age';
const MANIFEST_SUFFIX = '.manifest.json';
const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface BackupManifest {
  version: 1;
  environment: string;
  createdAt: string;
  dumpKey: string;
  /** The plaintext `pg_dump --format=custom` size. */
  dumpBytes: number;
  encryptedBytes: number;
  /** Of the encrypted object, so a drill can tell a corrupt download from a bad key. */
  encryptedSha256: string;
  serverVersion: string;
  /** `schema.table` → rows, read inside the snapshot the dump was taken from. */
  rowCounts: Record<string, number>;
}

export interface RowCountMismatch {
  table: string;
  expected: number | null;
  actual: number | null;
}

function assertEnvironment(environment: string): void {
  if (!ENVIRONMENT.test(environment)) {
    throw new Error(`"${environment}" is not a valid backup environment name.`);
  }
}

/** `db/<environment>/`, the prefix every object and listing for it shares. */
export function backupPrefix(environment: string): string {
  assertEnvironment(environment);
  return `${BACKUP_ROOT}/${environment}/`;
}

/**
 * `db/<environment>/YYYY/MM/DD-HHMMSS.dump.age` and its manifest, by UTC time.
 *
 * The time is part of the key so a second run on the same day writes new objects
 * instead of overwriting the first run's dump before its own manifest exists —
 * which would leave a manifest describing a dump that is gone.
 */
export function backupKeys(environment: string, at: Date): { dump: string; manifest: string } {
  const [date = '', time = ''] = at.toISOString().split('T');
  const stem = `${backupPrefix(environment)}${date.replaceAll('-', '/')}-${time.slice(0, 8).replaceAll(':', '')}`;
  return { dump: `${stem}${DUMP_SUFFIX}`, manifest: `${stem}${MANIFEST_SUFFIX}` };
}

/** The dump a manifest listed under `manifestKey` must describe. */
export function dumpKeyFor(manifestKey: string): string {
  return `${manifestKey.slice(0, -MANIFEST_SUFFIX.length)}${DUMP_SUFFIX}`;
}

interface Backup {
  /** The key without its suffix; sorts chronologically. */
  stem: string;
  keys: string[];
  date: Date;
}

/**
 * This environment's objects grouped per run. Keys dated after `now` are
 * ignored: no run writes one, so one exists only if someone planted it to sort
 * ahead of every real backup.
 */
function backupsOf(keys: readonly string[], environment: string, now: Date): Backup[] {
  const prefix = backupPrefix(environment);
  const byStem = new Map<string, Backup>();

  for (const key of keys) {
    const match = key.startsWith(prefix) ? OBJECT_KEY.exec(key.slice(prefix.length)) : null;
    if (!match) {
      continue;
    }
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getTime() > now.getTime()) {
      continue;
    }
    const stem = key.slice(
      0,
      key.lastIndexOf(key.endsWith(DUMP_SUFFIX) ? DUMP_SUFFIX : MANIFEST_SUFFIX),
    );
    const backup = byStem.get(stem) ?? { stem, keys: [], date };
    backup.keys.push(key);
    byStem.set(stem, backup);
  }

  return [...byStem.values()].sort((a, b) => a.stem.localeCompare(b.stem));
}

/**
 * The manifest is uploaded after its dump, so the newest manifest always names
 * a complete backup; a dump whose manifest never arrived is never picked.
 */
export function latestManifestKey(
  keys: readonly string[],
  environment: string,
  now: Date,
): string | null {
  const manifests = backupsOf(keys, environment, now)
    .flatMap((backup) => backup.keys)
    .filter((key) => key.endsWith(MANIFEST_SUFFIX));
  return manifests.at(-1) ?? null;
}

/**
 * Thirty days of backups plus the earliest backup of each of the last twelve
 * months — the earliest rather than the 1st, so a failed run on the 1st does not
 * leave a month with no copy. The newest backup is always kept, so a job that
 * stops running for a month cannot prune its way to an empty bucket.
 */
export function keysToPrune(keys: readonly string[], environment: string, now: Date): string[] {
  const backups = backupsOf(keys, environment, now);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const monthIndex = (date: Date): number => date.getUTCFullYear() * 12 + date.getUTCMonth();
  // `backups` is chronological, so the first stem seen per month is its earliest.
  const earliestPerMonth = new Map<number, string>();
  for (const backup of backups) {
    const month = monthIndex(backup.date);
    if (monthIndex(now) - month < MONTHLY_RETENTION_MONTHS && !earliestPerMonth.has(month)) {
      earliestPerMonth.set(month, backup.stem);
    }
  }
  const monthly = new Set(earliestPerMonth.values());

  return backups
    .filter((backup, index) => {
      const daily = (today - backup.date.getTime()) / DAY_MS < DAILY_RETENTION_DAYS;
      return !(daily || monthly.has(backup.stem) || index === backups.length - 1);
    })
    .flatMap((backup) => backup.keys);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function parseManifest(text: string): BackupManifest {
  const invalid = (reason: string): Error =>
    new Error(`The downloaded file is not a valid backup manifest: ${reason}.`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw invalid('it is not JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw invalid('it is not an object');
  }
  const candidate = parsed as Record<string, unknown>;
  const rowCounts = candidate.rowCounts;

  if (candidate.version !== 1) throw invalid('unsupported version');
  for (const field of ['environment', 'createdAt', 'dumpKey', 'serverVersion'] as const) {
    if (typeof candidate[field] !== 'string') throw invalid(`${field} is missing`);
  }
  if (!isCount(candidate.dumpBytes) || !isCount(candidate.encryptedBytes)) {
    throw invalid('a size is missing');
  }
  if (
    typeof candidate.encryptedSha256 !== 'string' ||
    !SHA256_HEX.test(candidate.encryptedSha256)
  ) {
    throw invalid('the digest is malformed');
  }
  if (
    typeof rowCounts !== 'object' ||
    rowCounts === null ||
    !Object.values(rowCounts).every(isCount)
  ) {
    throw invalid('the row counts are malformed');
  }

  return parsed as BackupManifest;
}

export function compareRowCounts(
  expected: Record<string, number>,
  actual: Record<string, number>,
): RowCountMismatch[] {
  const tables = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();

  return tables
    .map((table) => ({ table, expected: expected[table] ?? null, actual: actual[table] ?? null }))
    .filter(({ expected: want, actual: got }) => want !== got);
}

/** `BACKUP_MIN_BYTES`, so a dispatch can prove the floor fails the workflow. */
export function resolveMinimumBytes(override: string | undefined): number {
  const trimmed = override?.trim();
  if (!trimmed) {
    return DEFAULT_MIN_DUMP_BYTES;
  }
  const value = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`BACKUP_MIN_BYTES must be a positive whole number of bytes, got "${trimmed}".`);
  }
  return value;
}

export function assertMinimumSize(bytes: number, minimum: number): void {
  if (bytes < minimum) {
    throw new Error(
      `The dump is ${bytes} bytes, below the ${minimum}-byte minimum. Refusing to store it as a backup.`,
    );
  }
}
