import { portfolioItems, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { AppDatabase } from '../../lib/database.js';
import { escapeLikePattern } from '../../lib/like-pattern.js';

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

/** Every column that can hold an object key, per `findUnreferencedKeys`. */
const KEY_COLUMNS: readonly AnyPgColumn[] = [
  portfolioItems.imageUrl,
  portfolioItems.thumbnailUrl,
  vendorProfiles.profileImageUrl,
  vendorProfiles.coverImageUrl,
  users.avatarUrl,
];

/**
 * Of `keys`, the ones some row still names — as the bare key **or** as the tail
 * of an absolute URL, which legacy and seeded rows carry.
 *
 * Wider than `findUnreferencedKeys`, which compares exact strings and is right
 * for a delete a caller asked for. A sweep that reaped on exact match would
 * delete the object behind every absolute-URL row. The `LIKE` may over-match
 * and the suffix test below is what decides; an over-match only keeps an object.
 */
export async function findReferencedKeys(
  db: AppDatabase,
  keys: readonly string[],
): Promise<Set<string>> {
  const referenced = new Set<string>();

  if (keys.length === 0) {
    return referenced;
  }

  for (const column of KEY_COLUMNS) {
    const matches: SQL[] = keys.flatMap((key) => [
      eq(column, key),
      sql`${column} like ${`%/${escapeLikePattern(key)}`}`,
    ]);
    const rows = await db
      .select({ value: sql<string | null>`${column}` })
      .from(column.table)
      .where(or(...matches));

    for (const { value } of rows) {
      for (const key of keys) {
        if (value === key || value?.endsWith(`/${key}`)) {
          referenced.add(key);
        }
      }
    }
  }

  return referenced;
}
