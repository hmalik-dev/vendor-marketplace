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
  return db
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
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt));
}

/** The conversation row alone, for a participant check. */
export async function findConversationById(
  db: AppDatabase,
  conversationId: string,
): Promise<(ConversationRow & { vendorUserId: string }) | null> {
  const rows = await db
    .select({
      id: conversations.id,
      customerId: conversations.customerId,
      vendorId: conversations.vendorId,
      bookingRequestId: conversations.bookingRequestId,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      vendorUserId: vendorProfiles.userId,
    })
    .from(conversations)
    .innerJoin(vendorProfiles, eq(conversations.vendorId, vendorProfiles.id))
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

/** Unread counts per conversation — messages *this* user did not send. */
export async function countUnreadPerConversation(
  db: AppDatabase,
  userId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ conversationId: messages.conversationId, total: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(ne(messages.senderId, userId), isNull(messages.readAt)))
    .groupBy(messages.conversationId);

  return new Map(rows.map((row) => [row.conversationId, row.total]));
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
