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
const OBJECT_KEY = /^(\d{4})\/(\d{2})\/(\d{2})\.(dump\.age|manifest\.json)$/;
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

/** `db/<environment>/YYYY/MM/DD.dump.age` and its manifest, by UTC date. */
export function backupKeys(environment: string, at: Date): { dump: string; manifest: string } {
  const [date] = at.toISOString().split('T');
  const stem = `${backupPrefix(environment)}${(date ?? '').replaceAll('-', '/')}`;
  return { dump: `${stem}.dump.age`, manifest: `${stem}.manifest.json` };
}

interface DatedKey {
  key: string;
  date: Date;
}

function datedKeys(keys: readonly string[], environment: string): DatedKey[] {
  const prefix = backupPrefix(environment);
  const dated: DatedKey[] = [];

  for (const key of keys) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const match = OBJECT_KEY.exec(key.slice(prefix.length));
    if (!match) {
      continue;
    }
    const [, year, month, day] = match;
    dated.push({ key, date: new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))) });
  }

  return dated;
}

/**
 * The manifest is uploaded after its dump, so the newest manifest always names
 * a complete backup; a dump whose manifest never arrived is never picked.
 */
export function latestManifestKey(keys: readonly string[], environment: string): string | null {
  const manifests = datedKeys(keys, environment)
    .map(({ key }) => key)
    .filter((key) => key.endsWith('.manifest.json'))
    .sort();
  return manifests.at(-1) ?? null;
}

/**
 * Thirty dailies (today and the 29 days before it) plus the first of each month
 * for the last twelve months. The newest backup is always kept, so a job that
 * stops running for a month cannot prune its way to an empty bucket.
 */
export function keysToPrune(keys: readonly string[], environment: string, now: Date): string[] {
  const dated = datedKeys(keys, environment);
  const newest = Math.max(...dated.map(({ date }) => date.getTime()));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const thisMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();

  return dated
    .filter(({ date }) => {
      const time = date.getTime();
      const daily = (today - time) / DAY_MS < DAILY_RETENTION_DAYS;
      const monthly =
        date.getUTCDate() === 1 &&
        thisMonth - (date.getUTCFullYear() * 12 + date.getUTCMonth()) < MONTHLY_RETENTION_MONTHS;
      return !(daily || monthly || time === newest);
    })
    .map(({ key }) => key);
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
