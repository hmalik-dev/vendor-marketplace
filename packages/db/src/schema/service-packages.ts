import { sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { priceTypeEnum } from './enums.js';
import { vendorProfiles } from './vendor-profiles.js';

/**
 * Named `service_packages` rather than `packages` to avoid confusion with the
 * monorepo's `packages/` directory. Domain language stays "package".
 */
export const servicePackages = pgTable(
  'service_packages',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull(),
    /** Money is always stored as integer cents. */
    priceCents: integer('price_cents').notNull(),
    priceType: priceTypeEnum('price_type').notNull().default('fixed'),
    durationHours: decimal('duration_hours', { precision: 4, scale: 1 }),
    maxGuests: integer('max_guests'),
    /** Free-text bullet list, e.g. ["4 hours coverage", "100 edited photos"]. */
    inclusions: jsonb('inclusions').$type<string[]>().notNull().default([]),
    /** Soft-deactivate; packages are never hard-deleted once quoted against. */
    isActive: boolean('is_active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('service_packages_vendor_active_idx').on(table.vendorId, table.isActive)],
);

export type ServicePackageRow = typeof servicePackages.$inferSelect;
export type NewServicePackageRow = typeof servicePackages.$inferInsert;
