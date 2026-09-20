import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { UPLOAD_ORPHAN_GRACE_MS } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ObjectStorage } from '../../lib/storage.js';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { sweepOrphanedUploads } from './upload-sweep.service.js';

const NOW = new Date('2026-09-20T12:00:00Z');
const OLD = new Date(NOW.getTime() - UPLOAD_ORPHAN_GRACE_MS - 60_000);
const OWNER = 'a0000000-0000-4000-8000-000000000001';
const ORPHANS = Array.from({ length: 5 }, (_, n) => `portfolio/${OWNER}/orphan-${n}.webp`);

/**
 * VEN-485 acceptance 2 — the half PGlite cannot prove. One connection runs the
 * first sweep to completion before the second starts, so the second finds the
 * objects already gone and the test would pass with the advisory lock deleted.
 * Here each sweep holds its own pooled connection and they overlap.
 */
describe('two upload sweeps on two real connections', () => {
  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  it('deletes each unreferenced object once', async () => {
    const removed: string[] = [];

    // A listing that yields to the event loop, so the sweeps really interleave,
    // and a store that records every delete it is asked for.
    const storage: ObjectStorage = {
      ...harness!.app.storage,
      list: async (prefix) => {
        await new Promise((resolve) => setTimeout(resolve, 50));

        return {
          objects: ORPHANS.filter((key) => key.startsWith(`${prefix}/`)).map((key) => ({
            key,
            lastModified: OLD,
          })),
        };
      },
      remove: async (keys) => {
        removed.push(...keys);
      },
    };
    const sweep = (): ReturnType<typeof sweepOrphanedUploads> =>
      sweepOrphanedUploads({ db: harness!.database.db, storage, log: harness!.app.log }, NOW);

    const results = await Promise.all([sweep(), sweep()]);

    expect(results.filter((result) => result.ran)).toHaveLength(1);
    expect([...removed].sort()).toEqual([...ORPHANS].sort());
  });
});
