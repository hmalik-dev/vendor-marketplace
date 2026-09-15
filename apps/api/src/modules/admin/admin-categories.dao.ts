import { asc, eq, sql } from 'drizzle-orm';
import { categories, vendorCategories } from '@vendor-marketplace/db/schema';
import type { AdminCategoryRow } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

const adminCategorySelection = {
  id: categories.id,
  name: categories.name,
  slug: categories.slug,
  description: categories.description,
  icon: categories.icon,
  displayOrder: categories.displayOrder,
  isActive: categories.isActive,
  vendorCount: sql<number>`(
    select count(*)::int from ${vendorCategories}
    where ${vendorCategories.categoryId} = ${categories.id}
  )`,
};

/** Every category, inactive ones included, in the order the public list reads them. */
export async function findAdminCategories(db: AppDatabase): Promise<AdminCategoryRow[]> {
  return db
    .select(adminCategorySelection)
    .from(categories)
    .orderBy(asc(categories.displayOrder), asc(categories.name));
}

export async function findAdminCategoryById(
  db: AppDatabase,
  categoryId: string,
): Promise<AdminCategoryRow | null> {
  const rows = await db
    .select(adminCategorySelection)
    .from(categories)
    .where(eq(categories.id, categoryId));

  return rows[0] ?? null;
}

/**
 * Every category's id and position, row-locked for the rest of the transaction.
 *
 * The lock is what makes a reorder's "does this list still name every
 * category?" check hold until the write lands: two operators reordering at once
 * serialise here instead of each validating against the order the other is
 * about to replace.
 */
export async function lockCategoryPositions(
  tx: AppDatabase,
): Promise<{ id: string; displayOrder: number }[]> {
  return tx
    .select({ id: categories.id, displayOrder: categories.displayOrder })
    .from(categories)
    .for('update');
}

export async function setCategoryActiveRow(
  tx: AppDatabase,
  categoryId: string,
  isActive: boolean,
): Promise<boolean> {
  const updated = await tx
    .update(categories)
    .set({ isActive })
    .where(eq(categories.id, categoryId))
    .returning({ id: categories.id });

  return updated.length > 0;
}

export async function setCategoryDisplayOrder(
  tx: AppDatabase,
  categoryId: string,
  displayOrder: number,
): Promise<void> {
  await tx.update(categories).set({ displayOrder }).where(eq(categories.id, categoryId));
}
