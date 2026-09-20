import { UPLOAD_ORPHAN_GRACE_MS } from '@vendor-marketplace/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import { STORAGE_PREFIXES, thumbnailKeyFor, type ObjectStorage } from '../../lib/storage.js';
import { loadReferencedKeys, withUploadSweepLock } from './upload-sweep.dao.js';

/** Objects read, checked and deleted per round trip. */
const SWEEP_PAGE_SIZE = 200;

/** A ceiling per run, so a backlog drains over several ticks rather than one long one. */
const SWEEP_MAX_DELETES = 1_000;

export interface UploadSweepDeps {
  db: AppDatabase;
  storage: ObjectStorage;
  log: FastifyBaseLogger;
}

export interface UploadSweepOptions {
  /** Report what would go and delete nothing. */
  dryRun?: boolean;
  graceMs?: number;
}

export interface UploadSweepResult {
  /** `false` when another sweep held the lock and this one did nothing. */
  ran: boolean;
  scanned: number;
  /** Deleted, or under `dryRun` what would have been. */
  orphaned: number;
}

/** `<name>-thumb.webp` → `<name>.webp`; any other key is returned as is. */
function baseKeyFor(key: string): string {
  return key.replace(/-thumb\.webp$/, '.webp');
}

/**
 * Deletes uploaded objects older than the grace period that no row references
 * (VEN-485).
 *
 * An object is kept if its key, its full-size sibling or its thumbnail is
 * referenced: profile and cover images have no thumbnail column, so a thumbnail
 * is live exactly when its base is. A fresh object is kept whatever the rows
 * say, because the upload lands before the save that names it.
 *
 * Two sweeps overlapping — two instances, or a slow tick and the next — are
 * serialised by an advisory lock; the second returns `ran: false` and deletes
 * nothing, so each object is removed once.
 */
export async function sweepOrphanedUploads(
  deps: UploadSweepDeps,
  now: Date,
  options: UploadSweepOptions = {},
): Promise<UploadSweepResult> {
  const cutoff = now.getTime() - (options.graceMs ?? UPLOAD_ORPHAN_GRACE_MS);

  const result = await withUploadSweepLock(deps.db, async (tx) => {
    const totals: UploadSweepResult = { ran: true, scanned: 0, orphaned: 0 };

    for (const prefix of STORAGE_PREFIXES) {
      if (totals.orphaned >= SWEEP_MAX_DELETES) {
        break;
      }

      let token: string | undefined;

      do {
        const page = await deps.storage.list(prefix, {
          limit: SWEEP_PAGE_SIZE,
          ...(token ? { token } : {}),
        });
        token = page.nextToken;
        totals.scanned += page.objects.length;

        const old = page.objects
          .filter((object) => object.lastModified.getTime() < cutoff)
          .map((object) => object.key);
        // Read per page, after the listing, so the window between "no row names
        // it" and the delete is one page wide rather than one sweep.
        const referenced = await loadReferencedKeys(tx);
        const orphans = old.filter(
          (key) =>
            !referenced.has(key) &&
            !referenced.has(baseKeyFor(key)) &&
            !referenced.has(thumbnailKeyFor(baseKeyFor(key))),
        );

        if (orphans.length > 0 && !options.dryRun) {
          await deps.storage.remove(orphans);
        }

        totals.orphaned += orphans.length;
      } while (token && totals.orphaned < SWEEP_MAX_DELETES);
    }

    return totals;
  });

  const outcome = result ?? { ran: false, scanned: 0, orphaned: 0 };

  deps.log.info({ ...outcome, dryRun: options.dryRun === true }, 'Upload sweep finished');

  return outcome;
}
