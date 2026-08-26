import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { MAX_ADMIN_NOTE_LENGTH } from '@vendor-marketplace/shared';
import { tagCategoryEnum, tagSuggestionStatusEnum } from './enums.js';
import { users } from './users.js';
import { vendorProfiles } from './vendor-profiles.js';

export const tags = pgTable(
  'tags',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Display name, e.g. "South Asian", "Spanish", "Kosher". */
    name: varchar('name', { length: 100 }).notNull(),
    /**
     * Category-prefixed and globally unique. Names only have to be unique
     * within a category — "Korean" and "Japanese" are both a language and a
     * culture — so the prefix keeps the dedup/search key collision-free.
     */
    slug: varchar('slug', { length: 100 }).notNull(),
    category: tagCategoryEnum('category').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tags_slug_key').on(table.slug),
    uniqueIndex('tags_category_name_key').on(table.category, table.name),
    // Drives the grouped tag picker, which only ever lists active tags.
    index('tags_category_display_order_idx')
      .on(table.category, table.displayOrder)
      .where(sql`${table.isActive} = true`),
  ],
);

export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;

export const vendorTags = pgTable(
  'vendor_tags',
  {
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.vendorId, table.tagId] }),
    // The composite PK already serves vendor_id lookups; filtering search by
    // tag needs the reverse direction.
    index('vendor_tags_tag_id_idx').on(table.tagId),
  ],
);

export type VendorTagRow = typeof vendorTags.$inferSelect;
export type NewVendorTagRow = typeof vendorTags.$inferInsert;

export const tagSuggestions = pgTable(
  'tag_suggestions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** The user who submitted the suggestion. */
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    suggestedName: varchar('suggested_name', { length: 100 }).notNull(),
    category: tagCategoryEnum('category').notNull(),
    status: tagSuggestionStatusEnum('status').notNull().default('pending'),
    /** Set when approved and linked to a new or existing tag. */
    resolvedTagId: uuid('resolved_tag_id').references(() => tags.id, { onDelete: 'set null' }),
    /** Reason for rejection or merge note. */
    adminNote: varchar('admin_note', { length: MAX_ADMIN_NOTE_LENGTH }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    // Admin review queue: oldest pending suggestions first (ticket #15).
    index('tag_suggestions_status_created_at_idx').on(table.status, table.createdAt),
    index('tag_suggestions_vendor_id_idx').on(table.vendorId),
  ],
);

export type TagSuggestionRow = typeof tagSuggestions.$inferSelect;
export type NewTagSuggestionRow = typeof tagSuggestions.$inferInsert;
