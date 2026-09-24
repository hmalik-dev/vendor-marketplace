import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/*
 * State every API instance has to agree on (VEN-650).
 *
 * Each of these used to be a process `Map`, which pinned the API to one
 * replica: a rolling deploy runs two containers whatever the replica setting,
 * and during that overlap a counter, a grant or a live event held by one was
 * invisible to the other.
 */

/**
 * One fixed-window counter per rate-limit key. A request is one upsert: the
 * window restarts once `window_ends_at` has passed, otherwise the count goes up.
 */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    key: text('key').primaryKey(),
    hits: integer('hits').notNull(),
    windowEndsAt: timestamp('window_ends_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('rate_limit_counters_window_ends_at_idx').on(table.windowEndsAt)],
).enableRLS();

/**
 * The admin's pending step-up code (VEN-500), one per admin: issuing a
 * new one replaces the old. Only the SHA-256 of the code is stored.
 */
export const stepUpChallenges = pgTable('step_up_challenges', {
  adminId: uuid('admin_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  digest: text('digest').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}).enableRLS();

/** A confirmed step-up, fresh until `expires_at`. */
export const stepUpGrants = pgTable('step_up_grants', {
  adminId: uuid('admin_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}).enableRLS();

/**
 * A live event too large for a `NOTIFY` payload (Postgres caps one at 8000
 * bytes, and a 5000-character message can be four times that in UTF-8). The
 * notification carries this row's id instead, and every instance reads the
 * event from here. Rows are only needed for the moment it takes the others to
 * read them, so the publisher drops old ones as it writes.
 */
export const realtimeEvents = pgTable(
  'realtime_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    payload: text('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('realtime_events_created_at_idx').on(table.createdAt)],
).enableRLS();
