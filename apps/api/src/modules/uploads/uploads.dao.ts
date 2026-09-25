import { ERROR_CODES } from '@vendor-marketplace/shared';
import { sql } from 'drizzle-orm';
import type { AppDatabase } from '../../lib/database.js';
import { AppError } from '../../lib/errors.js';

/**
 * Locked upload writes that may hold a pooled connection at once. The storage
 * calls run inside the transaction, so without this a storage slowdown would
 * let uploads from many accounts take the whole pool and stall every route.
 */
export const MAX_CONCURRENT_UPLOAD_WRITES = 2;

/** Writes that may wait in memory for a slot; past this the upload is refused. */
export const MAX_QUEUED_UPLOAD_WRITES = 8;

let activeWrites = 0;
const waitingWrites: Array<() => void> = [];

/** The same hand-off queue as the image decode slots, sized for the pool. */
async function withWriteSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeWrites >= MAX_CONCURRENT_UPLOAD_WRITES) {
    if (waitingWrites.length >= MAX_QUEUED_UPLOAD_WRITES) {
      throw new AppError(429, ERROR_CODES.RATE_LIMITED, 'Uploads are busy. Try again shortly.');
    }
    // The finishing write hands its slot straight to us, so `activeWrites` stays put.
    await new Promise<void>((resolve) => waitingWrites.push(resolve));
  } else {
    activeWrites += 1;
  }

  try {
    return await task();
  } finally {
    const next = waitingWrites.shift();
    if (next) {
      next();
    } else {
      activeWrites -= 1;
    }
  }
}

/**
 * Runs `work` while holding one account's upload lock, waiting for any other
 * upload by the same account, on any instance, to finish first (VEN-625).
 *
 * The cap is counted from a bucket listing, which no row lock can cover, so
 * the count and the write are serialised by an advisory lock keyed on the
 * owner. It is transaction-scoped: a crashed instance releases it with its
 * connection. Only the count and the write run under it — never the parse or
 * the decode — and a write slot is taken before the connection is.
 */
export async function withOwnerUploadLock<T>(
  db: AppDatabase,
  ownerId: string,
  work: () => Promise<T>,
): Promise<T> {
  return withWriteSlot(() =>
    db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`upload:${ownerId}`}, 0))`,
      );

      return work();
    }),
  );
}
