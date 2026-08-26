import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { REVIEW_RATING_MAX, REVIEW_RATING_MIN } from '@vendorhub/shared';
import { bookings } from './bookings.js';
import { reviewTypeEnum } from './enums.js';
import { users } from './users.js';
import { vendorProfiles } from './vendor-profiles.js';

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Denormalized from the booking so vendor review queries avoid a join. */
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    type: reviewTypeEnum('type').notNull(),
    rating: integer('rating').notNull(),
    title: varchar('title', { length: 200 }),
    content: text('content').notNull(),
    /** Vendor-to-customer reviews are visible to other vendors when true. */
    isPublic: boolean('is_public').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One review per user per booking — the race guard for concurrent submits.
    uniqueIndex('reviews_booking_reviewer_key').on(table.bookingId, table.reviewerId),
    index('reviews_booking_idx').on(table.bookingId),
    // Public vendor reviews only; vendor_to_customer reviews stay private.
    index('reviews_vendor_public_idx')
      .on(table.vendorId, table.createdAt)
      .where(sql`${table.type} = 'customer_to_vendor'`),
    check(
      'reviews_rating_range',
      sql`${table.rating} >= ${sql.raw(String(REVIEW_RATING_MIN))} AND ${table.rating} <= ${sql.raw(String(REVIEW_RATING_MAX))}`,
    ),
  ],
);

export type ReviewRow = typeof reviews.$inferSelect;
export type NewReviewRow = typeof reviews.$inferInsert;
