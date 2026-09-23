import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { REVIEW_RATING_MAX, REVIEW_RATING_MIN } from '@vendor-marketplace/shared';
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
    // `restrict` (VEN-649): a vendor's reviews are their record, not the
    // reviewer's to take with them on a stray hard delete.
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
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
    // The unique index above leads with booking_id; a user delete scans by reviewer alone.
    index('reviews_reviewer_idx').on(table.reviewerId),
    // Public vendor reviews only; vendor_to_customer reviews stay private.
    index('reviews_vendor_public_idx')
      .on(table.vendorId, table.createdAt)
      .where(sql`${table.type} = 'customer_to_vendor'`),
    check(
      'reviews_rating_range',
      sql`${table.rating} >= ${sql.raw(String(REVIEW_RATING_MIN))} AND ${table.rating} <= ${sql.raw(String(REVIEW_RATING_MAX))}`,
    ),
  ],
).enableRLS();

export type ReviewRow = typeof reviews.$inferSelect;
export type NewReviewRow = typeof reviews.$inferInsert;

/**
 * One row per review an admin has deleted, so the deletion is final.
 *
 * "One review per booking, permanently": `reviews_booking_reviewer_key` only
 * holds while the row exists, and a hard delete removes it. This records the
 * (booking, reviewer) pair that has already used its review, holding no content
 * and no rating. The eligibility check reads it alongside `reviews`; nothing
 * else does, so no display or rating query can leak a deleted review.
 *
 * **Legacy:** reviews deleted before this table existed have no tombstone, and
 * none can be backfilled — the audit row names only the review id, and the row
 * it named is gone. Those pairs stay open to one resubmission; the rule is
 * permanent from the first deletion after this migration.
 */
export const reviewTombstones = pgTable(
  'review_tombstones',
  {
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    // `restrict`, as on `reviews.reviewer_id` (VEN-649).
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.bookingId, table.reviewerId] }),
    // The primary key leads with booking_id; a user delete scans by reviewer alone.
    index('review_tombstones_reviewer_idx').on(table.reviewerId),
  ],
).enableRLS();
