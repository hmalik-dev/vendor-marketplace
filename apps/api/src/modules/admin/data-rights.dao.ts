import { eq, inArray, or } from 'drizzle-orm';
import {
  bookingRequests,
  bookings,
  conversations,
  legalAcceptances,
  messages,
  notifications,
  reviews,
  users,
  vendorProfiles,
  type LegalAcceptanceRow,
  type UserRow,
  type VendorProfileRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

/**
 * The reads behind the data-rights surfaces (#438) — the export, the console's
 * retention panel, and the legal record.
 *
 * Its own file rather than more of `admin.dao.ts`, which is 1,400 lines and
 * held by two other lanes. The seam is real as well as convenient: everything
 * here reads **one person's whole record**, including the rows a closed account
 * retains, while `admin.dao.ts` reads the live marketplace a page at a time.
 */

/**
 * The account, **closed or not**.
 *
 * Deliberately not `findUserById`, which filters `deleted_at is null` because
 * every other admin operation acts on a live account. These surfaces exist to
 * answer "what do you still hold about me", and a closed account is precisely
 * the case that question is asked in — a lookup that could not see one would
 * answer 404 to the person the privacy policy wrote the promise for.
 */
export async function findUserRecord(db: AppDatabase, userId: string): Promise<UserRow | null> {
  if (!userId) {
    return null;
  }

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return rows?.[0] ?? null;
}

/**
 * The vendor profile, **retired or not**, for the same reason.
 *
 * `findVendorProfileByUserId` filters `is_deleted = false`, which is right for
 * a ban — you cannot unpublish a storefront that is already gone — and wrong
 * here: a closed vendor's profile row is retained, and the export has to say so.
 */
export async function findVendorProfileRecord(
  db: AppDatabase,
  userId: string,
): Promise<VendorProfileRow | null> {
  if (!userId) {
    return null;
  }

  const rows = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, userId))
    .limit(1);

  return rows?.[0] ?? null;
}

/** Both sides of a request, the way every other unwind-shaped read scopes one. */
function requestSides(userId: string, vendorProfileId: string | null) {
  return vendorProfileId
    ? or(eq(bookingRequests.customerId, userId), eq(bookingRequests.vendorId, vendorProfileId))
    : eq(bookingRequests.customerId, userId);
}

function bookingSides(userId: string, vendorProfileId: string | null) {
  return vendorProfileId
    ? or(eq(bookings.customerId, userId), eq(bookings.vendorId, vendorProfileId))
    : eq(bookings.customerId, userId);
}

export interface ExportRequestRow {
  id: string;
  customerId: string;
  vendorUserId: string;
  eventDate: string;
  eventType: string | null;
  eventLocation: string | null;
  guestCount: number | null;
  customDetails: string | null;
  status: string;
  quotedPriceCents: number | null;
  finalPriceCents: number | null;
  createdAt: Date;
}

export async function findExportBookingRequests(
  db: AppDatabase,
  userId: string,
  vendorProfileId: string | null,
): Promise<ExportRequestRow[]> {
  return db
    .select({
      id: bookingRequests.id,
      customerId: bookingRequests.customerId,
      vendorUserId: vendorProfiles.userId,
      eventDate: bookingRequests.eventDate,
      eventType: bookingRequests.eventType,
      eventLocation: bookingRequests.eventLocation,
      guestCount: bookingRequests.guestCount,
      customDetails: bookingRequests.customDetails,
      status: bookingRequests.status,
      quotedPriceCents: bookingRequests.quotedPriceCents,
      finalPriceCents: bookingRequests.finalPriceCents,
      createdAt: bookingRequests.createdAt,
    })
    .from(bookingRequests)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookingRequests.vendorId))
    .where(requestSides(userId, vendorProfileId))
    .orderBy(bookingRequests.createdAt);
}

export interface ExportBookingRow {
  id: string;
  customerId: string;
  vendorUserId: string;
  eventDate: string;
  eventLocation: string | null;
  status: string;
  totalAmountCents: number;
  platformFeeCents: number;
  vendorPayoutCents: number;
  refundAmountCents: number | null;
  stripePaymentIntentId: string | null;
  stripeTransferId: string | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
}

export async function findExportBookings(
  db: AppDatabase,
  userId: string,
  vendorProfileId: string | null,
): Promise<ExportBookingRow[]> {
  return db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      vendorUserId: vendorProfiles.userId,
      eventDate: bookings.eventDate,
      eventLocation: bookings.eventLocation,
      status: bookings.status,
      totalAmountCents: bookings.totalAmountCents,
      platformFeeCents: bookings.platformFeeCents,
      vendorPayoutCents: bookings.vendorPayoutCents,
      refundAmountCents: bookings.refundAmountCents,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      stripeTransferId: bookings.stripeTransferId,
      paidAt: bookings.paidAt,
      cancelledAt: bookings.cancelledAt,
      cancellationReason: bookings.cancellationReason,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(bookingSides(userId, vendorProfileId))
    .orderBy(bookings.createdAt);
}

export interface ExportReviewRow {
  id: string;
  bookingId: string;
  reviewerId: string;
  customerId: string;
  vendorUserId: string;
  type: string;
  rating: number;
  title: string | null;
  content: string | null;
  isPublic: boolean;
  createdAt: Date;
}

/**
 * Every review the subject is a party to, in one query, tagged with both
 * parties so the caller can split written from received.
 *
 * One query rather than two because the four cases — customer wrote, vendor
 * wrote, customer was reviewed, vendor was reviewed — are the same join with
 * the same rows, and splitting them in SQL would have run it twice to get two
 * halves of one set.
 */
export async function findExportReviews(
  db: AppDatabase,
  userId: string,
  vendorProfileId: string | null,
): Promise<ExportReviewRow[]> {
  const sides = vendorProfileId
    ? or(eq(bookings.customerId, userId), eq(bookings.vendorId, vendorProfileId))
    : eq(bookings.customerId, userId);

  return db
    .select({
      id: reviews.id,
      bookingId: reviews.bookingId,
      reviewerId: reviews.reviewerId,
      customerId: bookings.customerId,
      vendorUserId: vendorProfiles.userId,
      type: reviews.type,
      rating: reviews.rating,
      title: reviews.title,
      content: reviews.content,
      isPublic: reviews.isPublic,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(sides)
    .orderBy(reviews.createdAt);
}

export interface ExportMessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  customerId: string;
  vendorUserId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Every message in every thread the subject is party to — **including the
 * counterparty's**.
 *
 * Their words are in the subject's copy of a conversation the subject read, so
 * withholding them would return half a thread and answer nothing. What is
 * withheld is the counterparty's contact details, which is a different fact
 * about a different person and is not in this query at all.
 */
export async function findExportMessages(
  db: AppDatabase,
  userId: string,
  vendorProfileId: string | null,
): Promise<ExportMessageRow[]> {
  const sides = vendorProfileId
    ? or(eq(conversations.customerId, userId), eq(conversations.vendorId, vendorProfileId))
    : eq(conversations.customerId, userId);

  return db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      customerId: conversations.customerId,
      vendorUserId: vendorProfiles.userId,
      content: messages.content,
      readAt: messages.readAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, conversations.vendorId))
    .where(sides)
    .orderBy(messages.createdAt);
}

export async function findExportNotifications(
  db: AppDatabase,
  userId: string,
): Promise<
  {
    id: string;
    type: string;
    title: string;
    body: string | null;
    readAt: Date | null;
    createdAt: Date;
  }[]
> {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(notifications.createdAt);
}

/**
 * Every acceptance **this person** made — their Terms row and, where they are a
 * vendor, the agreement rows they signed on the business's behalf.
 *
 * Anchored on `accepted_by_user_id` rather than `vendor_id`, which is what the
 * row is about since #429 and what makes one read serve both halves of the
 * ticket's "per vendor and per user".
 */
export async function findLegalAcceptancesForUser(
  db: AppDatabase,
  userId: string,
): Promise<LegalAcceptanceRow[]> {
  return db
    .select()
    .from(legalAcceptances)
    .where(eq(legalAcceptances.acceptedByUserId, userId))
    .orderBy(legalAcceptances.acceptedAt);
}

export interface CounterpartyRow {
  id: string;
  firstName: string;
  lastName: string;
  businessName: string | null;
}

/**
 * The other parties, resolved in one pass from the ids the rows above carry.
 *
 * `left join`, because a counterparty who is not a vendor has no profile — and
 * an inner join here would have silently dropped every customer the subject
 * dealt with from a vendor's own export.
 */
export async function findCounterparties(
  db: AppDatabase,
  ids: readonly string[],
): Promise<CounterpartyRow[]> {
  if (ids.length === 0) {
    return [];
  }

  return db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      businessName: vendorProfiles.businessName,
    })
    .from(users)
    .leftJoin(vendorProfiles, eq(vendorProfiles.userId, users.id))
    .where(inArray(users.id, [...ids]));
}

/**
 * The event dates for a known set of booking ids.
 *
 * The refusal that names what to cancel needs a date beside each booking, and
 * `findConfirmedBookingsToUnwind` deliberately does not select one — it is the
 * unwind's query, and widening it to serve a message would put a display
 * concern in the money path. The **predicate** stays the unwind's, which is the
 * part that has to agree; this only decorates what it already chose.
 */
export async function findBookingEventDates(
  db: AppDatabase,
  ids: readonly string[],
): Promise<{ id: string; eventDate: string }[]> {
  if (ids.length === 0) {
    return [];
  }

  return db
    .select({ id: bookings.id, eventDate: bookings.eventDate })
    .from(bookings)
    .where(inArray(bookings.id, [...ids]));
}
