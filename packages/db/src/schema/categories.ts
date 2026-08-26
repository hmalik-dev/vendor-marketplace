import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { vendorProfiles } from './vendor-profiles.js';

export const categories = pgTable(
  'categories',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: text('description'),
    /** Lucide icon name rendered by the frontend. */
    icon: varchar('icon', { length: 50 }),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('categories_name_key').on(table.name),
    uniqueIndex('categories_slug_key').on(table.slug),
  ],
);

export type CategoryRow = typeof categories.$inferSelect;
export type NewCategoryRow = typeof categories.$inferInsert;

export const vendorCategories = pgTable(
  'vendor_categories',
  {
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.vendorId, table.categoryId] }),
    // The composite PK already serves vendor_id lookups; category-first search
    // (browse by category) needs its own index.
    index('vendor_categories_category_id_idx').on(table.categoryId),
  ],
);

export type VendorCategoryRow = typeof vendorCategories.$inferSelect;
export type NewVendorCategoryRow = typeof vendorCategories.$inferInsert;
