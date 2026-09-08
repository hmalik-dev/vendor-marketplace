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

/**
 * The unique index behind `users.email`, named once (#462).
 *
 * `updateUserByClerkId` has to recognise the 23505 this index raises and no
 * other — a collision on `users_clerk_user_id_key` means something quite
 * different and must keep failing loudly. Recognising it means matching the
 * constraint name Postgres reports, so the name is a constant both the schema
 * and that catch read rather than a string spelled out twice.
 */
export const USERS_EMAIL_UNIQUE_INDEX = 'users_email_key';

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
    /**
     * The address Clerk holds that this row could **not** be given, and when
     * the mirror first failed (#462).
     *
     * `users.email` is written from `user.updated`, and `users_email_key` can
     * decline that write because some other row already holds the new address.
     * The webhook has no way to retry its way out of that — the collision is a
     * fact about a different row — so the update is abandoned and `email` stays
     * at the **old** value. Left unrecorded that is silent and permanent, and
     * `notification-email.dao.ts` then keeps mailing counterparty detail to an
     * address the account holder has already given up.
     *
     * So the divergence is stored on the row it is about rather than only
     * logged: `pending_email` is what Clerk says the address is, and
     * `email_sync_failed_at` is when the two stopped agreeing. Both are cleared
     * the moment a later `user.updated` writes the address successfully, so a
     * set `pending_email` always means *currently* diverged rather than *once
     * diverged*.
     *
     * `/admin/customers?flag=email-stale` is the operator's read of them, the
     * same shape `refund-stuck` gives the bookings that need a person.
     *
     * No unique index covers `pending_email`, deliberately: two accounts can be
     * waiting on the same contested address at once, and refusing the second
     * record would hide exactly the case that most needs an operator.
     */
    pendingEmail: varchar('pending_email', { length: 255 }),
    emailSyncFailedAt: timestamp('email_sync_failed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_clerk_user_id_key').on(table.clerkUserId),
    /**
     * One live account per address — and only the live ones (#451).
     *
     * Partial because closing an account gives the address back. Someone who
     * closes their account and later wants to return is the same person with
     * the same email, and a full unique index would hold that address forever
     * under a row they asked us to retire: their sign-up would collide, and
     * they would be locked out of the marketplace by their own decision to
     * leave. Two rows sharing an address across time is the correct record of
     * what happened to that person, not a collision. The retired row itself
     * cannot go — bookings, reviews and messages reference it — so releasing
     * the address is the only way to let them back in.
     *
     * **The predicate narrowed; the name did not** (#462). `pending_email` is
     * written when this index refuses an address, and the catch that writes it
     * matches on the constraint name — so the name is the constant above
     * rather than a literal, and #451's `where` clause is untouched by that.
     */
    uniqueIndex(USERS_EMAIL_UNIQUE_INDEX)
      .on(table.email)
      .where(sql`${table.deletedAt} is null`),
    index('users_role_idx').on(table.role),
    /**
     * The retired accounts, and only those (#433).
     *
     * Every public vendor read now carries `OWNER_NOT_DELETED` — a correlated
     * `NOT EXISTS` over this table — so that a storefront whose owner deleted
     * their identity cannot be seen or booked. Postgres flattens that into an
     * anti-join and, with nothing to index on `deleted_at`, builds its hash
     * side by reading **every** row of `users`: measured here as a `Seq Scan`
     * with `Rows Removed by Filter` equal to the whole table, on the vendor
     * search (which runs it three times, for the page, the count and the facet
     * counts), the profile page, the messaging read, nearby availability and
     * request creation. The single-row slug lookup was the worst shape — a
     * whole-table scan bolted onto a unique-index hit.
     *
     * Partial, so it holds only the deleted accounts and stays near-empty on a
     * healthy marketplace; keyed on `id`, which is what the semi-join probes.
     * With it the same plan reads one page as an index-only scan.
     */
    index('users_deleted_at_idx')
      .on(table.id)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
