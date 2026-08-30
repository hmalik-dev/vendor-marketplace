import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import {
  bookingRequests,
  conversations,
  messages,
  notifications,
  users,
  vendorProfiles,
  type ConversationRow,
  type MessageRow,
  type NewMessageRow,
  type NewNotificationRow,
  type NotificationRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

export interface ConversationListRow {
  id: string;
  customerId: string;
  vendorUserId: string;
  vendorSlug: string;
  vendorBusinessName: string;
  vendorAvatarUrl: string | null;
  customerFirstName: string;
  customerLastName: string;
  customerAvatarUrl: string | null;
  lastMessageAt: Date | null;
  /** The linked request's date and occasion, for the context line. */
  requestEventDate: string | null;
  requestEventType: string | null;
}

/**
 * Every conversation this user is in, newest activity first.
 *
 * The vendor side is reached through `vendor_profiles.user_id` rather than a
 * second column on the conversation: the thread belongs to the *business*, and
 * a vendor whose account changes hands should not lose their threads.
 */
export async function findConversationsFor(
  db: AppDatabase,
  userId: string,
): Promise<ConversationListRow[]> {
  return (
    db
      .select({
        id: conversations.id,
        customerId: conversations.customerId,
        vendorUserId: vendorProfiles.userId,
        vendorSlug: vendorProfiles.slug,
        vendorBusinessName: vendorProfiles.businessName,
        vendorAvatarUrl: vendorProfiles.profileImageUrl,
        customerFirstName: users.firstName,
        customerLastName: users.lastName,
        customerAvatarUrl: users.avatarUrl,
        lastMessageAt: conversations.lastMessageAt,
        requestEventDate: bookingRequests.eventDate,
        requestEventType: bookingRequests.eventType,
      })
      .from(conversations)
      .innerJoin(vendorProfiles, eq(conversations.vendorId, vendorProfiles.id))
      .innerJoin(users, eq(conversations.customerId, users.id))
      .leftJoin(bookingRequests, eq(conversations.bookingRequestId, bookingRequests.id))
      .where(or(eq(conversations.customerId, userId), eq(vendorProfiles.userId, userId)))
      /*
       * `NULLS LAST` is load-bearing, not tidiness. `ensureConversation` opens a
       * thread with **every** booking request and leaves `last_message_at` null
       * until somebody writes, and Postgres sorts nulls *first* under `DESC` — so
       * the default ordering led with every thread that had never been used.
       *
       * On `/messages` that was merely wrong-looking, because the whole list
       * renders. Frame `07`'s bookings rail draws only the first three, so it
       * turned into lost data: three rows reading "No messages yet." above a reply
       * that arrived an hour ago (#302).
       */
      .orderBy(sql`${conversations.lastMessageAt} DESC NULLS LAST`, desc(conversations.createdAt))
  );
}

/**
 * A conversation with both parties' names — enough to check who the caller is
 * *and* to address a notification at the other one without a second read.
 */
export interface ConversationParties extends ConversationRow {
  vendorUserId: string;
  vendorBusinessName: string;
  customerFirstName: string;
  customerLastName: string;
}

/** The conversation and the two people in it, for a participant check. */
export async function findConversationById(
  db: AppDatabase,
  conversationId: string,
): Promise<ConversationParties | null> {
  const rows = await db
    .select({
      id: conversations.id,
      customerId: conversations.customerId,
      vendorId: conversations.vendorId,
      bookingRequestId: conversations.bookingRequestId,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      vendorUserId: vendorProfiles.userId,
      vendorBusinessName: vendorProfiles.businessName,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
    })
    .from(conversations)
    .innerJoin(vendorProfiles, eq(conversations.vendorId, vendorProfiles.id))
    .innerJoin(users, eq(conversations.customerId, users.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return rows?.[0] ?? null;
}

/** The newest message in each conversation, for the list preview. */
export async function findLastMessages(
  db: AppDatabase,
  conversationIds: readonly string[],
): Promise<Map<string, MessageRow>> {
  if (conversationIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select()
    .from(messages)
    .where(inArray(messages.conversationId, [...conversationIds]))
    .orderBy(desc(messages.createdAt));

  const newest = new Map<string, MessageRow>();
  for (const row of rows) {
    if (!newest.has(row.conversationId)) {
      newest.set(row.conversationId, row);
    }
  }

  return newest;
}

/**
 * Unread counts per conversation — messages *this* user did not send.
 *
 * Scoped to the conversations named, not to every message in the table: the
 * caller already knows which threads are the reader's, and without the bound
 * this counts the whole `messages` table on every list render to build a map
 * whose extra keys nobody reads.
 */
export async function countUnreadPerConversation(
  db: AppDatabase,
  userId: string,
  conversationIds: readonly string[],
): Promise<Map<string, number>> {
  if (conversationIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ conversationId: messages.conversationId, total: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, [...conversationIds]),
        ne(messages.senderId, userId),
        isNull(messages.readAt),
      ),
    )
    .groupBy(messages.conversationId);

  return new Map(rows.map((row) => [row.conversationId, row.total]));
}

/** Whether anything else in this thread is still waiting to be read. */
export async function countUnreadInConversation(
  db: AppDatabase,
  conversationId: string,
  readerId: string,
  excludeMessageId: string,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, readerId),
        ne(messages.id, excludeMessageId),
        isNull(messages.readAt),
      ),
    );

  return rows?.[0]?.total ?? 0;
}

/** One page of a thread, oldest first — a thread is read downwards. */
export async function findMessages(
  db: AppDatabase,
  conversationId: string,
  limit: number,
  offset: number,
): Promise<MessageRow[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countMessages(db: AppDatabase, conversationId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  return rows?.[0]?.total ?? 0;
}

export async function insertMessage(db: AppDatabase, values: NewMessageRow): Promise<MessageRow> {
  const inserted = await db.insert(messages).values(values).returning();
  const row = inserted?.[0];

  if (!row) {
    throw new Error('Message insert returned no row');
  }

  await db
    .update(conversations)
    .set({ lastMessageAt: row.createdAt })
    .where(eq(conversations.id, row.conversationId));

  return row;
}

/** Marks everything the *other* party sent as read. */
export async function markConversationRead(
  db: AppDatabase,
  conversationId: string,
  readerId: string,
): Promise<void> {
  await db
    .update(messages)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, readerId),
        isNull(messages.readAt),
      ),
    );
}

/**
 * The vendor a customer may open a thread with from their profile: published,
 * not deleted, and reachable by the slug in the URL they were reading.
 */
export async function findOpenableVendor(
  db: AppDatabase,
  slug: string,
): Promise<{ id: string; userId: string } | null> {
  if (!slug) {
    return null;
  }

  const rows = await db
    .select({ id: vendorProfiles.id, userId: vendorProfiles.userId })
    .from(vendorProfiles)
    .where(
      and(
        eq(vendorProfiles.slug, slug),
        eq(vendorProfiles.isPublished, true),
        eq(vendorProfiles.isDeleted, false),
      ),
    )
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * The customer/vendor thread that belongs to no request, opened if it is not
 * there yet. Returns the row either way, and whether this call is what created
 * it — the route answers 201 or 200 on that, the way request creation does.
 *
 * `DO NOTHING` returns no row on a conflict, so the existing thread is read
 * back rather than assumed: the alternative, `DO UPDATE` on a column that needs
 * no change, would rewrite a row and bump nothing for the sake of a return
 * value.
 */
export async function openUnattachedConversation(
  db: AppDatabase,
  values: { customerId: string; vendorId: string },
): Promise<{ conversation: ConversationRow; created: boolean }> {
  const inserted = await db
    .insert(conversations)
    .values(values)
    /*
     * `where` on a DO NOTHING is the *index* predicate, not a row filter: it is
     * how Postgres is told which arbiter to infer, and the partial unique index
     * cannot be matched without it.
     */
    .onConflictDoNothing({
      target: [conversations.customerId, conversations.vendorId],
      where: isNull(conversations.bookingRequestId),
    })
    .returning();

  const created = inserted?.[0];

  if (created) {
    return { conversation: created, created: true };
  }

  const existing = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.customerId, values.customerId),
        eq(conversations.vendorId, values.vendorId),
        isNull(conversations.bookingRequestId),
      ),
    )
    .limit(1);

  const row = existing?.[0];

  if (!row) {
    throw new Error('Conversation insert conflicted with a row that is not there');
  }

  return { conversation: row, created: false };
}

export async function insertNotification(
  db: AppDatabase,
  values: NewNotificationRow,
): Promise<NotificationRow | null> {
  const inserted = await db.insert(notifications).values(values).returning();

  return inserted?.[0] ?? null;
}

export async function findNotifications(
  db: AppDatabase,
  userId: string,
  limit: number,
  offset: number,
): Promise<NotificationRow[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countNotifications(db: AppDatabase, userId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  return rows?.[0]?.total ?? 0;
}

/** Scoped to the owner, so an id from elsewhere marks nothing. */
export async function markNotificationRead(
  db: AppDatabase,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const updated = await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });

  return updated.length > 0;
}

export async function markAllNotificationsRead(db: AppDatabase, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
