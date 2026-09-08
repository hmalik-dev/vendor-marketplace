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
    /**
     * An operator switched this package off and only an operator may switch it
     * back on (#457) — `vendor_profiles.moderation_hold`'s twin, for the same
     * reason and with the same rule.
     *
     * Set and cleared by `PUT /admin/packages/:packageId/active` alone. There is
     * no delete for a package, so the held **row** cannot be dropped and
     * recreated — but the offering can: `POST /vendor/packages` writes a fresh
     * row with no hold, so a vendor may re-list the same content and the
     * operator deactivates that one too. That is the reach of a per-package
     * lever, and the answer to a vendor who keeps doing it is the storefront
     * hold above, not a rule here.
     */
    moderationHold: boolean('moderation_hold').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('service_packages_vendor_active_idx').on(table.vendorId, table.isActive)],
);

export type ServicePackageRow = typeof servicePackages.$inferSelect;
export type NewServicePackageRow = typeof servicePackages.$inferInsert;
