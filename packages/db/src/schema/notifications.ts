import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { MAX_NOTIFICATION_TITLE_LENGTH } from '@vendor-marketplace/shared';
import { users } from './users.js';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** One of `NOTIFICATION_TYPES`; kept as varchar so new types need no migration. */
    type: varchar('type', { length: 50 }).notNull(),
    /**
     * Wider than the 200-character business name it interpolates, because the
     * title is derived: `"<business name> sent a quote"` is 214 at the name's
     * own limit. See `MAX_NOTIFICATION_TITLE_LENGTH` (#408).
     */
    title: varchar('title', { length: MAX_NOTIFICATION_TITLE_LENGTH }).notNull(),
    body: text('body'),
    /** Deep-link payload, e.g. `{ bookingId, vendorSlug, conversationId }`. */
    data: jsonb('data').$type<Record<string, unknown>>(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Serves both the unread badge count and the paginated notification list.
    index('notifications_user_read_idx').on(table.userId, table.readAt, table.createdAt),
  ],
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
