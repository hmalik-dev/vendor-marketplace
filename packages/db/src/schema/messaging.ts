import { isNull, sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { bookingRequests } from './bookings.js';
import { users } from './users.js';
import { vendorProfiles } from './vendor-profiles.js';

/**
 * One conversation per booking request, plus at most one unattached thread per
 * customer/vendor pair.
 *
 * The scoping is the design's, not an implementation detail: `18-messaging.md`
 * gives every thread a context rail headed **This request**, whose actions are
 * `Send revised quote`, `Accept as-is` and `Decline politely`. Those act on one
 * request, so a thread that spanned three of them could not draw the rail at
 * all — and a customer who asked the same photographer about a wedding and then
 * a birthday saw both negotiations under whichever line came first.
 *
 * The unattached thread is what `Send a message` on a vendor profile opens: a
 * conversation that exists before any request does. Its rail has no request to
 * show, which is honest, and the first request the customer sends opens its own
 * thread beside it.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    /** Context link to the request that started the thread. */
    bookingRequestId: uuid('booking_request_id').references(() => bookingRequests.id, {
      onDelete: 'set null',
    }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /*
     * Two partial keys rather than one composite: a `NULL` booking request is
     * distinct from every other `NULL` under the default `NULLS DISTINCT`, so a
     * three-column unique index would let a pair accumulate unattached threads
     * without limit — one per click of `Send a message`.
     */
    uniqueIndex('conversations_request_key').on(table.bookingRequestId),
    uniqueIndex('conversations_customer_vendor_open_key')
      .on(table.customerId, table.vendorId)
      .where(isNull(table.bookingRequestId)),
    index('conversations_customer_idx').on(table.customerId, table.lastMessageAt),
    index('conversations_vendor_idx').on(table.vendorId, table.lastMessageAt),
  ],
);

export type ConversationRow = typeof conversations.$inferSelect;
export type NewConversationRow = typeof conversations.$inferInsert;

export const messages = pgTable(
  'messages',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Stored as plain text; React escapes on render. */
    content: text('content').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('messages_conversation_created_idx').on(table.conversationId, table.createdAt)],
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
