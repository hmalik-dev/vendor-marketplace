import type {
  AdminCategoryList,
  AdminCategoryRow,
  ReorderCategories,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { conflict, notFound } from '../../lib/errors.js';
import { insertAdminAction } from './admin.dao.js';
import {
  findAdminCategories,
  findAdminCategoryById,
  lockCategoryPositions,
  setCategoryActiveRow,
  setCategoryDisplayOrder,
} from './admin-categories.dao.js';

export async function listAdminCategories(db: AppDatabase): Promise<AdminCategoryList> {
  return { items: await findAdminCategories(db) };
}

/**
 * Offers or withdraws one category.
 *
 * A soft remove, like a tag's: `vendor_categories` rows survive, so a vendor
 * keeps what they chose while the category leaves `/categories`, the search
 * facets and the landing pills. Setting the state a category is already in
 * answers 200 and logs nothing — a row saying "deactivated" about a category
 * that was already inactive would record something that did not happen.
 */
export async function setCategoryActive(
  db: AppDatabase,
  actorId: string,
  categoryId: string,
  isActive: boolean,
): Promise<AdminCategoryRow> {
  const existing = await findAdminCategoryById(db, categoryId);

  if (!existing) {
    throw notFound('No category with that id');
  }

  if (existing.isActive === isActive) {
    return existing;
  }

  await db.transaction(async (tx) => {
    if (!(await setCategoryActiveRow(tx, categoryId, isActive))) {
      throw notFound('No category with that id');
    }

    await insertAdminAction(tx, {
      actorId,
      action: isActive ? 'category_reactivated' : 'category_deactivated',
      subjectType: 'category',
      subjectId: categoryId,
      detail: { isActive, vendorCount: existing.vendorCount },
    });
  });

  return { ...existing, isActive };
}

/**
 * Persists a complete order: position `n` is written as `display_order = n + 1`.
 *
 * The list must name every category exactly once. One that misses a category
 * (or names one that no longer exists) was built from a screen that is out of
 * date, and applying it would silently push the missing category to wherever
 * its stale number happens to sort — so it is refused with a 409 instead.
 *
 * One `category_reordered` row per category whose position actually changed,
 * with where it was and where it went; categories the reorder left in place
 * write nothing.
 */
export async function reorderCategories(
  db: AppDatabase,
  actorId: string,
  input: ReorderCategories,
): Promise<AdminCategoryList> {
  await db.transaction(async (tx) => {
    const current = await lockCategoryPositions(tx);
    const positions = new Map(current.map((row) => [row.id, row.displayOrder]));

    if (
      input.categoryIds.length !== positions.size ||
      input.categoryIds.some((id) => !positions.has(id))
    ) {
      throw conflict('The category list has changed. Reload and try the order again.');
    }

    for (const [index, categoryId] of input.categoryIds.entries()) {
      const displayOrder = index + 1;
      const previousDisplayOrder = positions.get(categoryId);

      if (previousDisplayOrder === displayOrder) {
        continue;
      }

      await setCategoryDisplayOrder(tx, categoryId, displayOrder);
      await insertAdminAction(tx, {
        actorId,
        action: 'category_reordered',
        subjectType: 'category',
        subjectId: categoryId,
        detail: { displayOrder, previousDisplayOrder: previousDisplayOrder ?? null },
      });
    }
  });

  return listAdminCategories(db);
}
