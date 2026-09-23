import { portfolioItems, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { AppDatabase } from '../../lib/database.js';
import { referencedPathSegments } from '../../lib/storage.js';

/**
 * Held for the length of one sweep. Arbitrary but fixed: every instance must ask
 * for the same number, and no other advisory lock in the API uses it.
 */
const UPLOAD_SWEEP_LOCK_ID = 485_000_001;

/**
 * Runs `work` only if no other sweep, on any instance, holds the lock, and
 * returns `null` without running it otherwise.
 *
 * The lock is transaction-scoped, so a crashed instance releases it with its
 * connection instead of stranding it. Storage has no row to claim, which is why
 * the claim is an advisory lock and not a `SKIP LOCKED`.
 */
export async function withUploadSweepLock<T>(
  db: AppDatabase,
  work: (tx: AppDatabase) => Promise<T>,
): Promise<T | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ locked: sql<boolean>`pg_try_advisory_xact_lock(${UPLOAD_SWEEP_LOCK_ID})` })
      .from(sql`(select 1) as one`);

    if (!row?.locked) {
      return null;
    }

    return work(tx as unknown as AppDatabase);
  });
}

/**
 * Every column that can hold an object key, each read only where the account
 * that owns the row is still open.
 *
 * A closed account keeps its rows for the financial record, image columns
 * included (VEN-614). Counting those as references kept a closed vendor's
 * photos public forever; ignoring them lets the sweep delete what the closure
 * itself failed to, on its next run.
 */
function keyColumnReads(db: AppDatabase): (() => Promise<{ value: string | null }[]>)[] {
  const open = isNull(users.deletedAt);
  const owner = eq(users.id, vendorProfiles.userId);

  return [
    ...[portfolioItems.imageUrl, portfolioItems.thumbnailUrl].map(
      (column) => () =>
        db
          .select({ value: column })
          .from(portfolioItems)
          .innerJoin(vendorProfiles, eq(vendorProfiles.id, portfolioItems.vendorId))
          .innerJoin(users, owner)
          .where(and(open, isNotNull(column))),
    ),
    ...[vendorProfiles.profileImageUrl, vendorProfiles.coverImageUrl].map(
      (column) => () =>
        db
          .select({ value: column })
          .from(vendorProfiles)
          .innerJoin(users, owner)
          .where(and(open, isNotNull(column))),
    ),
    () =>
      db
        .select({ value: users.avatarUrl })
        .from(users)
        .where(and(open, isNotNull(users.avatarUrl))),
  ];
}

/**
 * Every object key some row still names, in the spellings the object resolves
 * from.
 *
 * Each stored value is put through the write guard's own normaliser
 * (`referencedPathSegments`), because a value the schema accepts — an absolute
 * URL, `?v=2`, `%2F`, a backslash, a `.` segment — reaches the same object as
 * the bare key without being equal to it. The raw value and its last two and
 * three segments are all kept: three is a current key, two a legacy one.
 *
 * Read whole rather than queried per key: a query can only find the spellings
 * it thought to ask for, and the sweep's failure is unrecoverable. A spelling
 * that over-matches only keeps an object. The five columns are one row per
 * image, read once per prefix.
 */
export async function loadReferencedKeys(db: AppDatabase): Promise<Set<string>> {
  const referenced = new Set<string>();

  for (const read of keyColumnReads(db)) {
    const rows = await read();

    for (const { value } of rows) {
      if (value === null) {
        continue;
      }

      const segments = referencedPathSegments(value);

      referenced.add(value);
      referenced.add(segments.slice(-2).join('/'));
      referenced.add(segments.slice(-3).join('/'));
    }
  }

  return referenced;
}
