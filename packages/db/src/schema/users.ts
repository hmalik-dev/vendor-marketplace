import { sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { MAX_CUSTOMER_BIO_LENGTH } from '@vendor-marketplace/shared';
import { budgetTierEnum, userRoleEnum } from './enums.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Clerk identity link — the join key for token verification. */
    clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    /** Stripe Customer used when the user pays for a booking. */
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    /** Short customer intro shown to vendors, e.g. "Planning my wedding!". */
    bio: varchar('bio', { length: MAX_CUSTOMER_BIO_LENGTH }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    /** Self-reported spending band; helps vendors self-select. */
    budgetTier: budgetTierEnum('budget_tier'),
    typicalGuestCountMin: integer('typical_guest_count_min'),
    typicalGuestCountMax: integer('typical_guest_count_max'),
    /** Derived from vendor-to-customer reviews; never written by an endpoint. */
    avgCustomerRating: decimal('avg_customer_rating', { precision: 3, scale: 2 })
      .notNull()
      .default('0'),
    /** Derived from vendor-to-customer reviews; never written by an endpoint. */
    customerReviewCount: integer('customer_review_count').notNull().default(0),
    /** Derived from bookings; never written by an endpoint. */
    totalBookingsCount: integer('total_bookings_count').notNull().default(0),
    /** Derived from bookings; never written by an endpoint. */
    completedBookingsCount: integer('completed_bookings_count').notNull().default(0),
    /** Derived from bookings; never written by an endpoint. */
    cancelledBookingsCount: integer('cancelled_bookings_count').notNull().default(0),
    /** Admin-set; blocks all API access (ticket #15). */
    isBanned: boolean('is_banned').notNull().default(false),
    bannedAt: timestamp('banned_at', { withTimezone: true }),
    /**
     * Set when Clerk reports the identity was deleted. Bookings, reviews, and
     * messages reference this row, so it is retired rather than removed.
     */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_clerk_user_id_key').on(table.clerkUserId),
    uniqueIndex('users_email_key').on(table.email),
    index('users_role_idx').on(table.role),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
