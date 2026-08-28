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
  userId: string,
  itemId: string,
): Promise<void> {
  const vendor = await requireOwnVendorProfile(db, userId);

  /*
   * The stored object is deliberately left in the bucket. Keys are immutable
   * and unguessable, an orphaned WebP costs a few kilobytes, and a delete that
   * half-succeeds — row gone, object gone, but the row's sibling still pointing
   * at it — is the worse failure. Reaping is a housekeeping job, not a request.
   */
  if (!(await deletePortfolioItemById(db, vendor.id, itemId))) {
    throw notFound('That portfolio photo does not exist');
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
