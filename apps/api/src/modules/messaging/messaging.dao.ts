import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
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
import type { NotificationType } from '@vendor-marketplace/shared';
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
  /*
   * Resolved first, and as literal values, deliberately (#402).
   *
   * The predicate used to read `conversations.customer_id = $1 OR
   * vendor_profiles.user_id = $1`. An OR spanning two tables is an access path
   * for neither `conversations_customer_idx` nor `conversations_vendor_idx`, so
   * Postgres read every conversation on the platform, joined each to its
   * vendor, and filtered — a per-request cost that scaled with the
   * marketplace's total thread count rather than with this reader's.
   *
   * Naming the vendor's profiles in a *subquery* does not fix it: a sublink
   * cannot be pulled out of an `OR`, so it plans as a hashed SubPlan under the
   * same sequential scan and additionally hashes `users` and
   * `booking_requests` — measured worse than what it replaced. Two statements
   * is what buys the index: with the ids in hand both arms are literal
   * predicates on `conversations`, which plans as a `BitmapOr` over the two
   * indexes. The extra round trip is a sub-millisecond lookup on
   * `vendor_profiles_user_idx`.
   */
  const owned = await db
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, userId));

  const ownedIds = owned.map((row) => row.id);

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
      // The join stays only to carry the columns the list renders.
      .where(
        ownedIds.length === 0
          ? eq(conversations.customerId, userId)
          : or(eq(conversations.customerId, userId), inArray(conversations.vendorId, ownedIds)),
      )
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

/**
 * The newest message's opening words in each conversation, for the list preview.
 *
 * A correlated top-1 per id, and not the whole table (#402). The query was
 * `SELECT * FROM messages WHERE conversation_id IN (...) ORDER BY created_at
 * DESC` with no bound at all: the full history of every thread the reader has
 * ever had came through the pool and into Node on every list render, and all
 * but one row per conversation was then thrown away in a `for` loop. The cost
 * scaled with total messages sent rather than with thread count.
 *
 * `DISTINCT ON` fixes what crosses the wire but still reads and sorts every
 * row; this turns each conversation into one `Index Scan Backward … LIMIT 1`
 * on `messages_conversation_created_idx`, so the cost is flat in thread depth.
 * Measured on a 3,010-message thread: 29 rows read against 3,290, and 116
 * buffers against 471.
 *
 * `id` breaks a `created_at` tie, so two messages written in the same
 * microsecond pick the same preview on every render. Only `previewLength`
 * characters are fetched, because that is all the caller renders.
 */
export async function findLastMessagePreviews(
  db: AppDatabase,
  conversationIds: readonly string[],
  previewLength: number,
): Promise<Map<string, string>> {
  if (conversationIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      conversationId: conversations.id,
      /*
       * Correlated rather than a lateral join, for the same plan without
       * leaving the query builder: Postgres answers it with one index scan
       * backwards per conversation, stopping at the first row.
       *
       * The inner table is **aliased and its columns written by hand**, and
       * that is load-bearing. Drizzle renders an interpolated column inside a
       * `sql` template unqualified, so the obvious spelling produces `where
       * "conversation_id" = "id"` — both resolved against the subquery's own
       * scope, comparing a message to its own id and answering `null` for
       * every row. A silently empty preview on every conversation, with no
       * error anywhere.
       */
      preview: sql<string | null>`(
        select left(newest.content, ${previewLength})
        from ${messages} as newest
        where newest.conversation_id = conversations.id
        order by newest.created_at desc, newest.id desc
        limit 1
      )`,
    })
    .from(conversations)
    .where(inArray(conversations.id, [...conversationIds]));

  return new Map(
    rows
      .filter((row): row is { conversationId: string; preview: string } => row.preview !== null)
      .map((row) => [row.conversationId, row.preview]),
  );
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

/**
 * One page of a thread, **paged backwards from the newest** and returned
 * oldest-first — a thread is read downwards but joined at its end.
 *
 * The page used to be taken from the oldest message forwards (#402), so page 1
 * of a 60-message thread was messages 1-50 and the client, which asks for no
 * other page, rendered a conversation that stopped ten messages before the
 * present. The reader's own last reply and the answer to it were both hidden
 * behind a reload that could never reach them.
 *
 * Page 1 is therefore the newest `limit` rows, page 2 the `limit` before those,
 * and each page is reversed so the caller can concatenate pages downwards
 * without re-sorting. `id` breaks a `created_at` tie, without which a row can
 * appear on two pages and another on none.
 */
export async function findMessages(
  db: AppDatabase,
  conversationId: string,
  limit: number,
  offset: number,
): Promise<MessageRow[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit)
    .offset(offset);

  return rows.reverse();
}

export async function countMessages(db: AppDatabase, conversationId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  return rows?.[0]?.total ?? 0;
}

/**
 * Stores a message and moves its thread to the top of both parties' lists, in
 * one transaction.
 *
 * The two statements used to run separately (#399). A failure between them left
 * the message stored and `last_message_at` stale, so the thread did not surface
 * on either `/messages` list and the recipient's preview lagged until some
 * later message happened to update the same row — a message delivered to a
 * screen nobody would look at. It also broke the rule that a multi-statement
 * mutation runs in one transaction.
 *
 * The timestamp is the message's own `created_at` rather than a second `now()`,
 * so the ordering key names a message that exists.
 *
 * The predicate makes the bump monotonic. Two sends serialise on the
 * conversation row, and without it the later-starting transaction writes
 * whichever `created_at` it happens to hold — so a thread's ordering key can
 * walk backwards and the thread drops down both parties' lists on the message
 * that should have raised it. `is null` is kept as its own arm because a
 * conversation that has never carried a message has no timestamp to compare.
 */
export async function insertMessage(db: AppDatabase, values: NewMessageRow): Promise<MessageRow> {
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(messages).values(values).returning();
    const row = inserted?.[0];

    if (!row) {
      throw new Error('Message insert returned no row');
    }

    await tx
      .update(conversations)
      .set({ lastMessageAt: row.createdAt })
      .where(
        and(
          eq(conversations.id, row.conversationId),
          or(isNull(conversations.lastMessageAt), lt(conversations.lastMessageAt, row.createdAt)),
        ),
      );

    return row;
  });
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

/**
 * A notification insert with its `type` narrowed to the shared vocabulary.
 *
 * `notifications.type` is a `varchar`, not a `pgEnum`, so `NewNotificationRow`
 * accepts any string and a typo reaches the database as data — which is how
 * `tag_suggestion_resolved` was written and stored for a type that does not
 * exist. The column stays a varchar; this is the type that makes the write
 * obey `NOTIFICATION_TYPES` the way `.claude/rules/shared-contracts.md`
 * requires of every enum.
 */
export type NotificationWrite = Omit<NewNotificationRow, 'type'> & { type: NotificationType };

export async function insertNotification(
  db: AppDatabase,
  values: NotificationWrite,
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
