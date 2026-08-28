import {
  EVENT_TYPE_LABELS,
  type ConversationSummary,
  type EventType,
  type NotificationItem,
  type Paginated,
  type SendMessageResult,
} from '@vendor-marketplace/shared';
import type { MessageRow, NotificationRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import type { EventHub } from '../../lib/event-stream.js';
import { forbidden, notFound } from '../../lib/errors.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import {
  countMessages,
  countNotifications,
  countUnreadPerConversation,
  findConversationById,
  findConversationsFor,
  findLastMessages,
  findMessages,
  findNotifications,
  insertMessage,
  markAllNotificationsRead,
  markConversationRead,
  markNotificationRead,
  type ConversationListRow,
} from './messaging.dao.js';

/** How much of the last message the list shows before it would wrap. */
const PREVIEW_LENGTH = 120;

const CONTEXT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * "Jun 14 wedding" — the line that makes a list of names navigable.
 *
 * A vendor with thirty threads is looking for the June 14 wedding, not for a
 * person, which is why this is on every row rather than only in the rail.
 */
function bookingContext(row: ConversationListRow): string | null {
  if (!row.requestEventDate) {
    return null;
  }

  const date = CONTEXT_DATE.format(new Date(`${row.requestEventDate}T00:00:00Z`));
  const occasion = row.requestEventType
    ? (EVENT_TYPE_LABELS[row.requestEventType as EventType] ?? row.requestEventType).toLowerCase()
    : null;

  return occasion ? `${date} ${occasion}` : date;
}

/**
 * Where a notification leads, built from its payload here rather than in the
 * client — the browser should not have to know how an id becomes a route.
 */
export function notificationHref(row: NotificationRow): string | null {
  const data = row.data ?? {};
  const conversationId = typeof data.conversationId === 'string' ? data.conversationId : null;

  if (conversationId) {
    return `/messages?conversation=${conversationId}`;
  }

  if (typeof data.bookingRequestId === 'string') {
    // Both sides have a surface listing their requests; the role decides which.
    return row.type === 'new_request' ? '/vendor/dashboard' : '/bookings';
  }

  return null;
}

function toNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type as NotificationItem['type'],
    title: row.title,
    body: row.body,
    href: notificationHref(row),
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

/** Which side of the conversation this user is, or `null` for a stranger. */
function sideOf(
  row: { customerId: string; vendorUserId: string },
  userId: string,
): 'customer' | 'vendor' | null {
  if (row.customerId === userId) {
    return 'customer';
  }

  return row.vendorUserId === userId ? 'vendor' : null;
}

export async function listConversations(
  db: AppDatabase,
  user: AuthenticatedUser,
): Promise<ConversationSummary[]> {
  const rows = await findConversationsFor(db, user.id);

  if (rows.length === 0) {
    return [];
  }

  const [lastMessages, unread] = await Promise.all([
    findLastMessages(
      db,
      rows.map((row) => row.id),
    ),
    countUnreadPerConversation(db, user.id),
  ]);

  return rows.map((row) => {
    const side = sideOf(row, user.id);
    const last = lastMessages.get(row.id);

    /*
     * Each party sees the other. A customer sees the business they are
     * booking; a vendor sees the person, by first name and initial — the same
     * limit the tiered customer profile applies before acceptance.
     */
    const otherPartyName =
      side === 'customer'
        ? row.vendorBusinessName
        : [row.customerFirstName, row.customerLastName.trim().slice(0, 1)]
            .filter(Boolean)
            .join(' ')
            .trim() || 'A customer';

    return {
      id: row.id,
      otherPartyName,
      otherPartyAvatarUrl: side === 'customer' ? row.vendorAvatarUrl : row.customerAvatarUrl,
      lastMessagePreview: last ? last.content.slice(0, PREVIEW_LENGTH) : null,
      lastMessageAt: row.lastMessageAt,
      unreadCount: unread.get(row.id) ?? 0,
      bookingContext: bookingContext(row),
      vendorSlug: row.vendorSlug,
    };
  });
}

/** Fails unless the caller is one of the two people in the conversation. */
async function requireParticipant(
  db: AppDatabase,
  user: AuthenticatedUser,
  conversationId: string,
): Promise<void> {
  const row = await findConversationById(db, conversationId);

  if (!row) {
    throw notFound('That conversation does not exist');
  }

  if (sideOf(row, user.id) === null) {
    throw forbidden('You are not part of that conversation');
  }
}

export async function listMessages(
  db: AppDatabase,
  user: AuthenticatedUser,
  conversationId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<SendMessageResult>> {
  await requireParticipant(db, user, conversationId);

  const [rows, total] = await Promise.all([
    findMessages(db, conversationId, pageSize, (page - 1) * pageSize),
    countMessages(db, conversationId),
  ]);

  return { items: rows.map(toMessage), total, page, pageSize };
}

function toMessage(row: MessageRow): SendMessageResult {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    content: row.content,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export async function sendMessage(
  db: AppDatabase,
  hub: EventHub,
  user: AuthenticatedUser,
  conversationId: string,
  content: string,
): Promise<SendMessageResult> {
  const row = await findConversationById(db, conversationId);

  if (!row) {
    throw notFound('That conversation does not exist');
  }

  const side = sideOf(row, user.id);
  if (side === null) {
    throw forbidden('You are not part of that conversation');
  }

  const inserted = await insertMessage(db, {
    conversationId,
    senderId: user.id,
    content,
  });

  const message = toMessage(inserted);

  /*
   * Pushed to *both* parties, not just the recipient: the sender may have the
   * thread open in another tab, and a message that appears in one tab and not
   * the other is the bug that makes people distrust a live surface.
   */
  for (const participant of [row.customerId, row.vendorUserId]) {
    hub.publish(participant, { type: 'new_message', conversationId, message });
  }

  return message;
}

export async function readConversation(
  db: AppDatabase,
  user: AuthenticatedUser,
  conversationId: string,
): Promise<void> {
  await requireParticipant(db, user, conversationId);
  await markConversationRead(db, conversationId, user.id);
}

export async function listNotifications(
  db: AppDatabase,
  user: AuthenticatedUser,
  page: number,
  pageSize: number,
): Promise<Paginated<NotificationItem>> {
  const [rows, total] = await Promise.all([
    findNotifications(db, user.id, pageSize, (page - 1) * pageSize),
    countNotifications(db, user.id),
  ]);

  return { items: rows.map(toNotification), total, page, pageSize };
}

export async function readNotification(
  db: AppDatabase,
  user: AuthenticatedUser,
  notificationId: string,
): Promise<void> {
  /*
   * A no-op is not an error: marking an already-read notification read is what
   * a second click does, and a 404 there would be noise. The scoping is what
   * matters, and it is in the query — an id belonging to somebody else marks
   * nothing.
   */
  await markNotificationRead(db, user.id, notificationId);
}

export async function readAllNotifications(
  db: AppDatabase,
  user: AuthenticatedUser,
): Promise<void> {
  await markAllNotificationsRead(db, user.id);
}
