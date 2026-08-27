import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  portfolioItems,
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

  const deleted = await db
    .delete(portfolioItems)
    .where(and(eq(portfolioItems.vendorId, vendorId), eq(portfolioItems.id, itemId)))
    .returning({ id: portfolioItems.id });

  return deleted.length > 0;
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
  });
}
