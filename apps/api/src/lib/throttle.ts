import { and, eq, lt, sql } from 'drizzle-orm';
import { throttleHits } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from './database.js';

/** Rows older than this belong to no bucket's window, however long. */
const RETENTION_MS = 86_400_000;

/**
 * Charges one call to a bucket and says whether the bucket is now over `limit`
 * inside `windowMs` (VEN-462). Shared by every instance through the database,
 * so the count survives a cold start and does not depend on which web instance
 * a caller reached. The call is recorded either way.
 */
export async function chargeThrottle(
  db: AppDatabase,
  bucket: string,
  windowMs: number,
  limit: number,
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - windowMs);

  await db
    .delete(throttleHits)
    .where(and(eq(throttleHits.bucket, bucket), lt(throttleHits.hitAt, since)));
  await db.insert(throttleHits).values({ bucket, hitAt: now });

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(throttleHits)
    .where(eq(throttleHits.bucket, bucket));

  return (row?.n ?? 0) > limit;
}

/** Drops buckets nobody has charged for a day, so a one-off caller leaves nothing behind. */
export async function purgeThrottleHits(db: AppDatabase, now: Date = new Date()): Promise<void> {
  await db
    .delete(throttleHits)
    .where(lt(throttleHits.hitAt, new Date(now.getTime() - RETENTION_MS)));
}
