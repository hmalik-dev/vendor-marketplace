import type {
  CreatePortfolioItemInput,
  PortfolioItem,
  ReorderPortfolioInput,
  UpdatePortfolioItemInput,
} from '@vendor-marketplace/shared';
import type { NewPortfolioItemRow, PortfolioItemRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { notFound } from '../../lib/errors.js';
import { assertCompleteOrder } from '../../lib/ordering.js';
import { ownsObjectKey, type ObjectStorage } from '../../lib/storage.js';
import { requireOwnVendorProfile } from '../vendors/vendors.service.js';
import {
  applyPortfolioOrder,
  deletePortfolioItemById,
  findOwnedPortfolioIds,
  findPortfolioByVendor,
  findUnreferencedKeys,
  insertPortfolioItem,
  nextDisplayOrder,
  syncCoverFromPortfolio,
  updatePortfolioItemById,
} from './portfolio.dao.js';

/** The row shape already matches the contract; this keeps the mapping explicit. */
export function toPortfolioItem(row: PortfolioItemRow): PortfolioItem {
  return row;
}

export async function listOwnPortfolio(db: AppDatabase, userId: string): Promise<PortfolioItem[]> {
  const vendor = await requireOwnVendorProfile(db, userId);
  const rows = await findPortfolioByVendor(db, vendor.id);

  return rows.map(toPortfolioItem);
}

export async function addPortfolioItem(
  db: AppDatabase,
  userId: string,
  input: CreatePortfolioItemInput,
): Promise<PortfolioItem> {
  const vendor = await requireOwnVendorProfile(db, userId);

  const values: NewPortfolioItemRow = {
    vendorId: vendor.id,
    imageUrl: input.imageUrl,
    thumbnailUrl: input.thumbnailUrl ?? null,
    caption: input.caption ?? null,
    displayOrder: input.displayOrder ?? (await nextDisplayOrder(db, vendor.id)),
  };

  const row = await insertPortfolioItem(db, values);

  /*
   * The first photo a vendor uploads becomes their cover, because otherwise
   * they would have a portfolio and no banner until they thought to reorder a
   * list of one.
   */
  await db.transaction(async (tx) => {
    await syncCoverFromPortfolio(tx, vendor.id);
  });

  return toPortfolioItem(row);
}

export async function updatePortfolioItem(
  db: AppDatabase,
  userId: string,
  itemId: string,
  input: UpdatePortfolioItemInput,
): Promise<PortfolioItem> {
  const vendor = await requireOwnVendorProfile(db, userId);

  // An empty caption means "remove it", not "store a blank string".
  const caption = input.caption === null || input.caption === '' ? null : input.caption;
  const row = await updatePortfolioItemById(db, vendor.id, itemId, { caption });

  if (!row) {
    throw notFound('That portfolio photo does not exist');
  }

  return toPortfolioItem(row);
}

export async function removePortfolioItem(
  db: AppDatabase,
  storage: ObjectStorage,
  userId: string,
  itemId: string,
  log?: { warn: (details: unknown, message: string) => void },
): Promise<void> {
  const vendor = await requireOwnVendorProfile(db, userId);
  const deleted = await deletePortfolioItemById(db, vendor.id, itemId);

  if (!deleted) {
    throw notFound('That portfolio photo does not exist');
  }

  /*
   * The objects are reaped **after** the row is gone, and never inside its
   * transaction.
   *
   * This used to leave them in the bucket on purpose, reasoning that keys are
   * unguessable and an orphaned WebP costs a few kilobytes. Two things undid
   * that: the bucket was enumerable (#180), so "unguessable" was worth nothing;
   * and every profile-photo change leaks two objects, for the life of the
   * account, with no reaper anywhere in the product.
   *
   * The original worry — a half-succeeded delete — is answered by the ordering
   * rather than by not deleting. The row is the source of truth, so it commits
   * first; if the reap then fails, the result is one orphaned object, which is
   * exactly the state the old behaviour produced deliberately, every time.
   */
  await reapObjects(db, storage, vendor.userId, [deleted.imageUrl, deleted.thumbnailUrl], log);
}

/**
 * Best-effort object removal. Never throws, and refuses more than it removes.
 *
 * **Two checks, and the diff that added this needed both.**
 *
 * *Ownership.* The key on a row is written by the client — `imageRefSchema`
 * exists to accept a bare object key — and every public vendor page hands out
 * the keys it renders. So a vendor could read a rival's key off
 * `GET /vendors/:slug`, claim it on a row of their own, delete that row, and
 * take the rival's photo with it. Nothing else records who uploaded a key, so
 * the owner segment in the key is the only check available.
 *
 * *Still referenced.* The cover is a **designation on an existing tile**, not
 * a second upload — `syncCoverFromPortfolio` copies a portfolio item's key
 * onto `vendor_profiles`. Two rows, one object, on purpose. Reaping on the
 * strength of one row would destroy an object the other still points at, and
 * the vendor would have done it to themselves with a legal request.
 *
 * A key that fails either check is left in the bucket, which is exactly the
 * state this repository shipped deliberately before. An orphan is recoverable
 * by a sweep; a deleted photo is not.
 */
export async function reapObjects(
  db: AppDatabase,
  storage: ObjectStorage,
  ownerId: string,
  keys: readonly (string | null)[],
  log?: { warn: (details: unknown, message: string) => void },
): Promise<void> {
  const owned = keys.filter(
    (key): key is string => key !== null && key.length > 0 && ownsObjectKey(key, ownerId),
  );

  if (owned.length === 0) {
    return;
  }

  const unreferenced = await findUnreferencedKeys(db, owned);

  if (unreferenced.length === 0) {
    return;
  }

  try {
    await storage.remove(unreferenced);
  } catch (error) {
    /*
     * An orphan is the old behaviour and a sweep can find it. A 500 on a
     * delete the caller already watched succeed is neither recoverable nor
     * explicable — but it is logged, because a token missing `DeleteObject`
     * would otherwise reap nothing, forever, in silence.
     */
    log?.warn({ keys: unreferenced, error }, 'Could not reap storage objects');
  }
}

export async function reorderPortfolio(
  db: AppDatabase,
  userId: string,
  input: ReorderPortfolioInput,
): Promise<PortfolioItem[]> {
  const vendor = await requireOwnVendorProfile(db, userId);

  const [owned, existing] = await Promise.all([
    findOwnedPortfolioIds(db, vendor.id, [...new Set(input.itemIds)]),
    findPortfolioByVendor(db, vendor.id),
  ]);
  const unique = assertCompleteOrder(input.itemIds, owned, existing.length, 'photo');

  await applyPortfolioOrder(db, vendor.id, unique);

  const rows = await findPortfolioByVendor(db, vendor.id);
  return rows.map(toPortfolioItem);
}
