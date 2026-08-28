import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  portfolioItems,
  vendorProfiles,
  type NewPortfolioItemRow,
  type PortfolioItemRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

const byDisplayOrder = [asc(portfolioItems.displayOrder), asc(portfolioItems.createdAt)];

export async function findPortfolioByVendor(
  db: AppDatabase,
  vendorId: string,
): Promise<PortfolioItemRow[]> {
  if (!vendorId) {
    return [];
  }

  return db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.vendorId, vendorId))
    .orderBy(...byDisplayOrder);
}

export async function countPortfolioItems(db: AppDatabase, vendorId: string): Promise<number> {
  if (!vendorId) {
    return 0;
  }

  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(portfolioItems)
    .where(eq(portfolioItems.vendorId, vendorId));

  return rows?.[0]?.total ?? 0;
}

export async function nextDisplayOrder(db: AppDatabase, vendorId: string): Promise<number> {
  const rows = await db
    .select({ highest: sql<number | null>`max(${portfolioItems.displayOrder})` })
    .from(portfolioItems)
    .where(eq(portfolioItems.vendorId, vendorId));

  const highest = rows?.[0]?.highest;
  return highest === null || highest === undefined ? 0 : highest + 1;
}

export async function insertPortfolioItem(
  db: AppDatabase,
  values: NewPortfolioItemRow,
): Promise<PortfolioItemRow> {
  const inserted = await db.insert(portfolioItems).values(values).returning();
  const row = inserted?.[0];

  if (!row) {
    throw new Error('Portfolio item insert returned no row');
  }

  return row;
}

export async function updatePortfolioItemById(
  db: AppDatabase,
  vendorId: string,
  itemId: string,
  patch: Partial<NewPortfolioItemRow>,
): Promise<PortfolioItemRow | null> {
  if (!vendorId || !itemId || Object.keys(patch).length === 0) {
    return null;
  }

  const updated = await db
    .update(portfolioItems)
    .set(patch)
    .where(and(eq(portfolioItems.vendorId, vendorId), eq(portfolioItems.id, itemId)))
    .returning();

  return updated?.[0] ?? null;
}

/** Returns whether a row was actually removed, so the route can 404 instead. */
export async function deletePortfolioItemById(
  db: AppDatabase,
  vendorId: string,
  itemId: string,
): Promise<boolean> {
  if (!vendorId || !itemId) {
    return false;
  }

  /*
   * Deleting the first photo promotes the next one, in the same transaction as
   * the delete. Otherwise a vendor who removes their cover is left with a
   * profile banner pointing at an image that no longer exists in their
   * portfolio — and on a failure, with neither the row nor the cover changed.
   */
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(portfolioItems)
      .where(and(eq(portfolioItems.vendorId, vendorId), eq(portfolioItems.id, itemId)))
      .returning({ id: portfolioItems.id });

    if (deleted.length === 0) {
      return false;
    }

    await syncCoverFromPortfolio(tx, vendorId);

    return true;
  });
}

export async function findOwnedPortfolioIds(
  db: AppDatabase,
  vendorId: string,
  itemIds: readonly string[],
): Promise<string[]> {
  if (!vendorId || itemIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: portfolioItems.id })
    .from(portfolioItems)
    .where(and(eq(portfolioItems.vendorId, vendorId), inArray(portfolioItems.id, [...itemIds])));

  return rows.map((row) => row.id);
}

/**
 * Writes the new order **and the cover it implies**, together.
 *
 * `40-states.md`: "Cover is a designation on an existing tile (drag to first
 * slot), never a second uploader." The cover stays a stored column rather than
 * being derived at read time, because it is read by search cards, the profile
 * banner and share metadata, and making three hot paths join into a list's
 * ordering to find one image is a poor trade. One column, one write.
 *
 * Both writes are in one transaction on purpose: an order that saved while the
 * cover did not would leave the vendor looking at a first tile labelled Cover
 * that is not the image anyone else sees.
 */
export async function applyPortfolioOrder(
  db: AppDatabase,
  vendorId: string,
  itemIds: readonly string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [index, itemId] of itemIds.entries()) {
      await tx
        .update(portfolioItems)
        .set({ displayOrder: index })
        .where(and(eq(portfolioItems.vendorId, vendorId), eq(portfolioItems.id, itemId)));
    }

    await syncCoverFromPortfolio(tx, vendorId);
  });
}

/**
 * Points the vendor's cover at whatever is now first, or clears it when the
 * portfolio is empty.
 *
 * An empty portfolio means **no cover**, which is a valid state: the profile
 * has a placeholder treatment for exactly this, and keeping a stale cover for
 * an image the vendor deleted would be worse than showing it.
 *
 * Takes the transaction rather than the database, so every caller composes it
 * into the write it is already making.
 */
export async function syncCoverFromPortfolio(
  tx: AppDatabase,
  vendorId: string,
): Promise<string | null> {
  const [first] = await tx
    .select({ imageUrl: portfolioItems.imageUrl })
    .from(portfolioItems)
    .where(eq(portfolioItems.vendorId, vendorId))
    .orderBy(asc(portfolioItems.displayOrder), asc(portfolioItems.id))
    .limit(1);

  const cover = first?.imageUrl ?? null;

  await tx
    .update(vendorProfiles)
    .set({ coverImageUrl: cover, updatedAt: sql`now()` })
    .where(eq(vendorProfiles.id, vendorId));

  return cover;
}
