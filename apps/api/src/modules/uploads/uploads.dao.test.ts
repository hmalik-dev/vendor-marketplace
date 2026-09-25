import { describe, expect, it } from 'vitest';
import type { AppDatabase } from '../../lib/database.js';
import {
  MAX_CONCURRENT_UPLOAD_WRITES,
  MAX_QUEUED_UPLOAD_WRITES,
  withOwnerUploadLock,
} from './uploads.dao.js';

/**
 * The owner lock holds a pooled connection for the length of the storage
 * writes, so a storage slowdown must never let uploads take the whole pool.
 */
describe('withOwnerUploadLock', () => {
  /*
   * A pool, reduced to what the slot guards: each open transaction is one
   * checked-out connection. PGlite is a single connection, so it would
   * serialise the transactions itself and hide the slot's absence.
   */
  let transactions = 0;
  const db = {
    transaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => {
      transactions += 1;
      try {
        return await work({ execute: async () => undefined });
      } finally {
        transactions -= 1;
      }
    },
  } as unknown as AppDatabase;

  it('holds at most two connections across owners and queues the rest in memory', async () => {
    let peak = 0;
    const releases: (() => void)[] = [];
    const owners = Array.from({ length: 6 }, (_, n) => `owner-${n}`);

    const settled = Promise.all(
      owners.map((owner) =>
        withOwnerUploadLock(db, owner, async () => {
          peak = Math.max(peak, transactions);
          await new Promise<void>((resolve) => releases.push(resolve));
          return owner;
        }),
      ),
    );

    await expect.poll(() => releases.length).toBe(MAX_CONCURRENT_UPLOAD_WRITES);

    // Release each writer as it arrives: every queued one must still run.
    for (const _ of owners) {
      await expect.poll(() => releases.length).toBeGreaterThan(0);
      releases.shift()!();
    }

    expect(await settled).toEqual(owners);
    expect(peak).toBe(MAX_CONCURRENT_UPLOAD_WRITES);
  });

  it('refuses with a 429 once the queue is full, without running the work', async () => {
    const releases: (() => void)[] = [];
    let ran = 0;
    const capacity = MAX_CONCURRENT_UPLOAD_WRITES + MAX_QUEUED_UPLOAD_WRITES;

    const write = (owner: string): Promise<void> =>
      withOwnerUploadLock(db, owner, async () => {
        ran += 1;
        await new Promise<void>((resolve) => releases.push(resolve));
      });

    const admitted = Array.from({ length: capacity }, (_, n) => write(`queued-${n}`));
    await expect.poll(() => releases.length).toBe(MAX_CONCURRENT_UPLOAD_WRITES);

    await expect(write('one-too-many')).rejects.toMatchObject({
      statusCode: 429,
      message: 'Uploads are busy. Try again shortly.',
    });

    for (let n = 0; n < capacity; n += 1) {
      await expect.poll(() => releases.length).toBeGreaterThan(0);
      releases.shift()!();
    }
    await Promise.all(admitted);
    expect(ran).toBe(capacity);
  });
});
