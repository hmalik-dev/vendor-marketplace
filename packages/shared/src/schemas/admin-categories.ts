import { z } from 'zod';
import { categorySchema, uuidSchema } from './index.js';

/*
 * Category management in the console (VEN-401).
 *
 * A file of its own rather than a block in `index.ts`, which every console
 * ticket appends to. Creating and renaming stay out of the contract: the
 * taxonomy's names and slugs are owned by `CATEGORY_SEEDS`, and an admin
 * owns only whether a category is offered and where it sits.
 */

/** A category as the management table shows it — with the count that makes deactivation legible. */
export const adminCategoryRowSchema = categorySchema.extend({ vendorCount: z.int() });
export type AdminCategoryRow = z.infer<typeof adminCategoryRowSchema>;

/** Every category, active or not, in the order the public list follows. */
export const adminCategoryListSchema = z.object({ items: z.array(adminCategoryRowSchema) });
export type AdminCategoryList = z.infer<typeof adminCategoryListSchema>;

export const setCategoryActiveSchema = z.object({ isActive: z.boolean() });
export type SetCategoryActive = z.infer<typeof setCategoryActiveSchema>;

const categoryOrderSchema = z
  .array(uuidSchema)
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'A category is listed twice' });

/**
 * The whole order, not a single move, and the order it was built from.
 *
 * A move sent as "swap with the neighbour" is two writes that a concurrent
 * edit can interleave. `basedOnCategoryIds` is the order the screen showed, so
 * the service can refuse a reorder built on a list another admin has since
 * rearranged instead of silently undoing their move.
 */
export const reorderCategoriesSchema = z.object({
  categoryIds: categoryOrderSchema,
  basedOnCategoryIds: categoryOrderSchema,
});
export type ReorderCategories = z.infer<typeof reorderCategoriesSchema>;
