import { sql } from 'drizzle-orm';
import { index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { vendorProfiles } from './vendor-profiles.js';

export const portfolioItems = pgTable(
  'portfolio_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    imageUrl: varchar('image_url', { length: 500 }).notNull(),
    thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
    caption: varchar('caption', { length: 500 }),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('portfolio_items_vendor_order_idx').on(table.vendorId, table.displayOrder)],
);

export type PortfolioItemRow = typeof portfolioItems.$inferSelect;
export type NewPortfolioItemRow = typeof portfolioItems.$inferInsert;
