import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Live-stream tickets (VEN-462), shared by every API instance.
 *
 * Keyed on the SHA-256 of the ticket, so a database dump holds nothing that can
 * be presented. A ticket is spent with one `delete … returning`, which is what
 * lets exactly one of two racing instances win.
 */
export const streamTickets = pgTable(
  'stream_tickets',
  {
    fingerprint: text('fingerprint').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('stream_tickets_user_id_idx').on(table.userId)],
).enableRLS();

/**
 * One row per call charged to a throttle bucket (VEN-462), so a sign-in
 * throttle is one count across serverless instances, cold starts and rotating
 * addresses. Rows older than their bucket's window are removed as the bucket is
 * next charged, and by the expiry timer.
 */
export const throttleHits = pgTable(
  'throttle_hits',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bucket: text('bucket').notNull(),
    hitAt: timestamp('hit_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('throttle_hits_bucket_hit_at_idx').on(table.bucket, table.hitAt)],
).enableRLS();
