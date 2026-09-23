import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { vendorProfiles } from './vendor-profiles.js';

/**
 * Every slug a vendor has given up (VEN-648).
 *
 * A storefront URL leaves the app — an Instagram bio, a customer's bookmark, a
 * printed card — so renaming the slug must not break it, and the freed slug
 * must never pass to another business: the old link would then send people to
 * someone else. The storefront answers an alias with a permanent redirect to
 * the vendor's current slug, and slug resolution treats an alias as taken by
 * anyone but its own vendor, who may take it back.
 *
 * Keyed by the vendor rather than by the slug it moved to, so a chain of
 * renames still redirects in one hop to wherever the vendor is now.
 */
export const vendorSlugAliases = pgTable(
  'vendor_slug_aliases',
  {
    slug: varchar('slug', { length: 200 }).primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('vendor_slug_aliases_vendor_id_idx').on(table.vendorId)],
).enableRLS();

export type VendorSlugAliasRow = typeof vendorSlugAliases.$inferSelect;
