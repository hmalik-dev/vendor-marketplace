import {
  EVENT_TYPE_LABELS,
  type ConversationSummary,
  type EventType,
  type NotificationItem,
  type OpenedConversation,
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
  countUnreadInConversation,
  countUnreadPerConversation,
  findConversationById,
  findConversationsFor,
  findLastMessages,
  findMessages,
  findNotifications,
  findOpenableVendor,
  insertMessage,
  insertNotification,
  markAllNotificationsRead,
  markConversationRead,
  markNotificationRead,
  openUnattachedConversation,
  type ConversationListRow,
  type ConversationParties,
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

  /*
   * A review lands on whichever surface shows the recipient the review itself,
   * and the two directions have different ones: a vendor reads a public review
   * on their own profile's Reviews tab, a customer reads a private one on
   * theirs. The vendor slug in the payload is what distinguishes them — a
   * `vendor_to_customer` row carries none, because there is no public page for
   * it to lead to.
   */
  if (row.type === 'new_review') {
    return typeof data.vendorSlug === 'string'
      ? `/vendors/${data.vendorSlug}?tab=reviews`
      : '/customer/profile?tab=reviews';
  }

  /*
   * An approved tag is already on the vendor's profile by the time this is
   * read, so the link goes to where they can see it — the editor's tag
   * section — rather than to a queue they have no access to.
   */
  if (row.type === 'tag_suggestion_approved') {
    return '/vendor/profile/edit';
  }

  if (typeof data.bookingRequestId === 'string') {
    if (row.type === 'new_request') {
      return '/vendor/dashboard';
    }

    /*
     * `request_quoted` is the one type that is always addressed to the customer
     * and always has something for them to do, so it is the one that deep-links
     * to the request itself. Its body says "open the request to see the price
     * and accept it", and until that page existed the link landed on the hub
     * and the promise went unmet.
     *
     * The rest stay on the hub deliberately. `request_accepted` goes to
     * whichever party did *not* accept, so it reaches vendors too, and
     * `/bookings/<id>` is a customer-only route — deep-linking it by type alone
     * would send a vendor to a page that refuses them.
     */
    if (row.type === 'request_quoted') {
      return `/bookings/${data.bookingRequestId}`;
    }

    return '/bookings';
  }

  return null;
}

/** A stored notification as every surface reads it — the list and the stream. */
export function toNotification(row: NotificationRow): NotificationItem {
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

/**
 * How each party is named to the other. A customer sees the business they are
 * booking; a vendor sees the person, by first name and initial — the same limit
 * the tiered customer profile applies before acceptance.
 */
function nameOfSide(
  row: {
    vendorBusinessName: string;
    customerFirstName: string;
    customerLastName: string;
  },
  side: 'customer' | 'vendor',
): string {
  if (side === 'vendor') {
    return row.vendorBusinessName;
  }

  return (
    [row.customerFirstName, row.customerLastName.trim().slice(0, 1)]
      .filter(Boolean)
      .join(' ')
      .trim() || 'A customer'
  );
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
    countUnreadPerConversation(
      db,
      user.id,
      rows.map((row) => row.id),
    ),
  ]);

  return rows.map((row) => {
    const side = sideOf(row, user.id);
    const last = lastMessages.get(row.id);

    // Each party sees the other, named by `nameOfSide`.
    const otherPartyName = nameOfSide(row, side === 'customer' ? 'vendor' : 'customer');

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

/**
 * The thread `Send a message` on a vendor's profile opens, created if it is not
 * there yet.
 *
 * Unattached to any request on purpose: this is the customer who has questions
 * *before* they ask for a date, and #219 found they had nowhere to ask them —
 * the control was disabled, and `/messages` could only open a thread that
 * already existed. Idempotent, so the button opens the same thread every time
 * rather than one per click.
 */
export async function openConversation(
  db: AppDatabase,
  user: AuthenticatedUser,
  vendorSlug: string,
): Promise<{ conversation: OpenedConversation; created: boolean }> {
  const vendor = await findOpenableVendor(db, vendorSlug);

  if (!vendor) {
    throw notFound('That vendor is not taking messages');
  }

  // The same refusal `createBookingRequest` makes, for the same reason: a
  // vendor writing to themselves would be both sides of `sideOf`.
  if (vendor.userId === user.id) {
    throw forbidden('You cannot message your own listing');
  }

  const { conversation, created } = await openUnattachedConversation(db, {
    customerId: user.id,
    vendorId: vendor.id,
  });

  return { conversation: { id: conversation.id }, created };
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

  await notifyRecipient(db, hub, row, side, inserted);

  return message;
}

/**
 * The bell, for whichever party did *not* send — in both directions, because a
 * vendor's reply is exactly as easy to miss as a customer's question, and until
 * now neither raised anything a closed tab could find later. The live push
 * above reaches an open stream only.
 *
 * **One row per unread run, not one per message.** A back-and-forth of thirty
 * messages is one thing to be told about, and thirty rows would bury every
 * other notification in the panel under a conversation the reader can already
 * see. Once they have opened the thread — which marks it read — the next
 * message raises a new one.
 */
async function notifyRecipient(
  db: AppDatabase,
  hub: EventHub,
  row: ConversationParties,
  side: 'customer' | 'vendor',
  sent: MessageRow,
): Promise<void> {
  const recipientId = side === 'customer' ? row.vendorUserId : row.customerId;
  const alreadyWaiting = await countUnreadInConversation(db, row.id, recipientId, sent.id);

  if (alreadyWaiting > 0) {
    return;
  }

  const stored = await insertNotification(db, {
    userId: recipientId,
    type: 'new_message',
    title: 'New message',
    body: `${nameOfSide(row, side)} sent you a message. Open the thread to reply.`,
    data: { conversationId: row.id },
  });

  if (stored) {
    hub.publish(recipientId, { type: 'new_notification', notification: toNotification(stored) });
  }
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
