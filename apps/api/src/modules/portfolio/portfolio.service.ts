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
import type { ObjectStorage } from '../../lib/storage.js';
import { requireOwnVendorProfile } from '../vendors/vendors.service.js';
import {
  applyPortfolioOrder,
  deletePortfolioItemById,
  findOwnedPortfolioIds,
  findPortfolioByVendor,
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
  await reapObjects(storage, [deleted.imageUrl, deleted.thumbnailUrl]);
}

/**
 * Best-effort object removal. Never throws.
 *
 * A vendor who deleted a photo has had their answer the moment the row is gone;
 * failing that request because the bucket was briefly unreachable would undo
 * nothing and tell them something they cannot act on.
 */
export async function reapObjects(
  storage: ObjectStorage,
  keys: readonly (string | null)[],
): Promise<void> {
  const present = keys.filter((key): key is string => key !== null && key.length > 0);

  if (present.length === 0) {
    return;
  }

  try {
    await storage.remove(present);
  } catch {
    // An orphan is the old behaviour, and it is recoverable by a sweep. A 500
    // on a delete that already succeeded is neither.
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
