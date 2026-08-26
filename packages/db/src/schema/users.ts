import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums.js';

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
    /** Admin-set; blocks all API access (ticket #15). */
    isBanned: boolean('is_banned').notNull().default(false),
    bannedAt: timestamp('banned_at', { withTimezone: true }),
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
