import { sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const vendorProfiles = pgTable(
  'vendor_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessName: varchar('business_name', { length: 200 }).notNull(),
    /** URL-safe, auto-generated from the business name, vendor-editable. */
    slug: varchar('slug', { length: 200 }).notNull(),
    bio: text('bio'),
    profileImageUrl: varchar('profile_image_url', { length: 500 }),
    coverImageUrl: varchar('cover_image_url', { length: 500 }),
    address: varchar('address', { length: 500 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    latitude: decimal('latitude', { precision: 10, scale: 8 }),
    longitude: decimal('longitude', { precision: 11, scale: 8 }),
    /**
     * The radius the vendor covers with no travel fee. Beyond it they either
     * decline the booking or quote a fee, which is what
     * `travelsBeyondRadius` records — a customer search for "vendors who cover
     * my area at no extra cost" is exactly this radius.
     */
    serviceRadiusKm: integer('service_radius_km').default(50),
    travelsBeyondRadius: boolean('travels_beyond_radius').notNull().default(false),
    responseTimeHours: integer('response_time_hours'),
    /** Stripe Connect Express account (ticket #9). */
    stripeAccountId: varchar('stripe_account_id', { length: 255 }),
    stripeOnboarded: boolean('stripe_onboarded').notNull().default(false),
    /** Vendor-controlled public visibility. */
    isPublished: boolean('is_published').notNull().default(false),
    /** Soft delete — preserves booking history integrity. */
    isDeleted: boolean('is_deleted').notNull().default(false),
    /** Derived from reviews; never written directly by an endpoint. */
    avgRating: decimal('avg_rating', { precision: 3, scale: 2 }).notNull().default('0'),
    /** Derived from reviews; never written directly by an endpoint. */
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('vendor_profiles_user_id_key').on(table.userId),
    uniqueIndex('vendor_profiles_slug_key').on(table.slug),
    index('vendor_profiles_published_idx').on(table.isPublished, table.isDeleted),
    // Location filtering only ever runs over publicly visible vendors.
    index('vendor_profiles_city_state_idx')
      .on(table.city, table.state)
      .where(sql`${table.isPublished} = true AND ${table.isDeleted} = false`),
  ],
);

export type VendorProfileRow = typeof vendorProfiles.$inferSelect;
export type NewVendorProfileRow = typeof vendorProfiles.$inferInsert;
