import { toDateString } from '@vendor-marketplace/shared';
import type {
  AdminCloseAccountResult,
  AdminCloseBlocker,
  AdminUserDataRights,
  AdminUserExport,
  LegalAcceptanceRecord,
} from '@vendor-marketplace/shared';
import type { LegalAcceptanceRow, UserRow, VendorProfileRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { retireUserById } from '../users/users.dao.js';
import { findConfirmedBookingsToUnwind } from './admin.dao.js';
import { recordAdminActionBestEffort } from './admin.service.js';
import { CLOSURE_UNWIND, unwindAccountBookings, type AdminContext } from './account-unwind.js';
import {
  findBookingEventDates,
  findCounterparties,
  findExportBookingRequests,
  findExportBookings,
  findExportMessages,
  findExportNotifications,
  findExportReviews,
  findLegalAcceptancesForUser,
  findUserRecord,
  findVendorProfileRecord,
  type ExportBookingRow,
  type ExportMessageRow,
  type ExportRequestRow,
  type ExportReviewRow,
} from './data-rights.dao.js';

/**
 * The two promises the privacy policy makes, and the record behind them (#438).
 *
 * *"Ask us for a copy of what we hold"* and *"to close your account, ask us
 * through Contact support"* were both true of the document and false of the
 * product: a subject-access request reached `SUPPORT_EMAIL_TO` and an operator
 * with no query to run, and a closure request could not be performed at all
 * without a privileged write against the database.
 *
 * **Closure here refuses; it never prices.** D39 ruled that an account holding
 * a future confirmed booking cannot be closed at all — the customer cancels
 * their upcoming bookings first, through D3's existing tiers — so no new money
 * path exists on this route and none should ever be added to it.
 */

/**
 * The counterparty's contact details, which are a fact about a different
 * person.
 *
 * Withheld by construction rather than by filtering: `adminExportCounterparty`
 * has no `email` or `phone` key, so there is nothing here for a later writer to
 * populate by accident. This sentence is what the archive says it did.
 */
const COUNTERPARTY_WITHHOLDING = {
  section: 'counterparties',
  fields: ['email', 'phone'],
  reason:
    "The other party's contact details are their personal data, not the subject's. Their name is included because it is what the subject already saw on their own bookings.",
};

/**
 * The identifiers that name our systems rather than the person.
 *
 * `clerk_user_id` is the join key into the identity provider. Returning it
 * discloses how the platform is wired without telling the subject anything
 * about themselves, so it is left out and said so.
 */
const INTERNAL_ID_WITHHOLDING = {
  section: 'subject',
  fields: ['clerkUserId'],
  reason:
    'An internal join key into the identity provider. It names how the platform is wired rather than anything about the subject.',
};

function toAcceptanceRecord(row: LegalAcceptanceRow): LegalAcceptanceRecord {
  return {
    id: row.id,
    document: row.document,
    version: row.version,
    documentSha256: row.documentSha256,
    acceptanceMethod: row.acceptanceMethod,
    acceptedAt: row.acceptedAt,
    acceptedByUserId: row.acceptedByUserId,
    acceptedByName: row.acceptedByName,
    businessName: row.businessName,
    ip: row.ip,
    userAgent: row.userAgent,
  };
}

/**
 * Which side of a row the subject is not on.
 *
 * Every row above carries both party ids, so this is one rule applied in one
 * place rather than a ternary repeated on four row shapes.
 */
function otherParty(row: { customerId: string; vendorUserId: string }, subjectId: string): string {
  return row.customerId === subjectId ? row.vendorUserId : row.customerId;
}

interface GatheredRecord {
  user: UserRow;
  profile: VendorProfileRow | null;
  requests: ExportRequestRow[];
  bookings: ExportBookingRow[];
  reviews: ExportReviewRow[];
  messages: ExportMessageRow[];
  notifications: Awaited<ReturnType<typeof findExportNotifications>>;
  acceptances: LegalAcceptanceRow[];
}

/**
 * Everything the platform holds for one person, gathered once.
 *
 * **One gatherer for the export and for the console's retention panel**, which
 * is the ticket's fourth requirement read literally: an operator asked "what do
 * you still hold about me" has to get the same answer the export gives. Two
 * queries counting what a third query returns is how those two answers drift,
 * and the drift would show up as the console under-reporting a category the
 * export contains.
 */
async function gather(db: AppDatabase, user: UserRow): Promise<GatheredRecord> {
  const profile = await findVendorProfileRecord(db, user.id);
  const profileId = profile?.id ?? null;

  const [requests, bookingRows, reviewRows, messageRows, notificationRows, acceptances] =
    await Promise.all([
      findExportBookingRequests(db, user.id, profileId),
      findExportBookings(db, user.id, profileId),
      findExportReviews(db, user.id, profileId),
      findExportMessages(db, user.id, profileId),
      findExportNotifications(db, user.id),
      findLegalAcceptancesForUser(db, user.id),
    ]);

  return {
    user,
    profile,
    requests,
    bookings: bookingRows,
    reviews: reviewRows,
    messages: messageRows,
    notifications: notificationRows,
    acceptances,
  };
}

/** Reviews the subject wrote, as opposed to reviews written about them. */
function splitReviews(record: GatheredRecord): {
  written: ExportReviewRow[];
  received: ExportReviewRow[];
} {
  const written: ExportReviewRow[] = [];
  const received: ExportReviewRow[] = [];

  for (const review of record.reviews) {
    if (review.reviewerId === record.user.id) {
      written.push(review);
    } else {
      received.push(review);
    }
  }

  return { written, received };
}

/**
 * A copy of everything held for one person, for an operator answering a
 * subject-access request.
 *
 * Reads a **closed** account as readily as a live one. That is the case the
 * privacy policy's retention paragraph is written about, and a lookup that
 * 404'd on it would refuse the request it exists to serve.
 */
export async function exportUserData(
  context: AdminContext,
  actorId: string,
  userId: string,
): Promise<AdminUserExport> {
  const user = await findUserRecord(context.db, userId);

  if (!user) {
    throw notFound('No account with that id');
  }

  const record = await gather(context.db, user);
  const { written, received } = splitReviews(record);

  const counterpartyIds = new Set<string>();

  for (const row of [
    ...record.requests,
    ...record.bookings,
    ...record.reviews,
    ...record.messages,
  ]) {
    const other = otherParty(row, user.id);

    if (other !== user.id) {
      counterpartyIds.add(other);
    }
  }

  const counterparties = await findCounterparties(context.db, [...counterpartyIds]);

  /*
   * Last, and best-effort, for the reason every audit write on this module is:
   * the export has already been produced by the time this runs, and a database
   * that refused the row must not turn a completed answer into a 500 the
   * operator would retry — producing a second copy of the same person's file.
   */
  await recordExport(context, actorId, user.id, record);

  return {
    generatedAt: new Date(),
    subject: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      city: user.city,
      state: user.state,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      stripeCustomerId: user.stripeCustomerId,
      isBanned: user.isBanned,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
    },
    vendorProfile: record.profile
      ? {
          id: record.profile.id,
          businessName: record.profile.businessName,
          slug: record.profile.slug,
          tagline: record.profile.tagline,
          bio: record.profile.bio,
          address: record.profile.address,
          city: record.profile.city,
          state: record.profile.state,
          stripeAccountId: record.profile.stripeAccountId,
          isPublished: record.profile.isPublished,
          isDeleted: record.profile.isDeleted,
          createdAt: record.profile.createdAt,
        }
      : null,
    counterparties: counterparties.map((row) => ({
      id: row.id,
      name: row.businessName ?? `${row.firstName} ${row.lastName}`.trim(),
      role: row.businessName ? ('vendor' as const) : ('customer' as const),
    })),
    bookingRequests: record.requests.map((row) => ({
      id: row.id,
      counterpartyId: otherParty(row, user.id),
      eventDate: row.eventDate,
      eventType: row.eventType,
      eventLocation: row.eventLocation,
      guestCount: row.guestCount,
      customDetails: row.customDetails,
      status: row.status,
      quotedPriceCents: row.quotedPriceCents,
      finalPriceCents: row.finalPriceCents,
      createdAt: row.createdAt,
    })),
    bookings: record.bookings.map((row) => ({
      id: row.id,
      counterpartyId: otherParty(row, user.id),
      eventDate: row.eventDate,
      eventLocation: row.eventLocation,
      status: row.status,
      totalAmountCents: row.totalAmountCents,
      platformFeeCents: row.platformFeeCents,
      vendorPayoutCents: row.vendorPayoutCents,
      refundAmountCents: row.refundAmountCents,
      stripePaymentIntentId: row.stripePaymentIntentId,
      stripeTransferId: row.stripeTransferId,
      paidAt: row.paidAt,
      cancelledAt: row.cancelledAt,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt,
    })),
    reviewsWritten: written.map((row) => toExportReview(row, user.id)),
    reviewsReceived: received.map((row) => toExportReview(row, user.id)),
    messages: record.messages.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      sentBySubject: row.senderId === user.id,
      content: row.content,
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
    notifications: record.notifications,
    legalAcceptances: record.acceptances.map(toAcceptanceRecord),
    withheld: [COUNTERPARTY_WITHHOLDING, INTERNAL_ID_WITHHOLDING],
  };
}

function toExportReview(row: ExportReviewRow, subjectId: string) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    counterpartyId: otherParty(row, subjectId),
    type: row.type,
    rating: row.rating,
    title: row.title,
    content: row.content,
    isPublic: row.isPublic,
    createdAt: row.createdAt,
  };
}

async function recordExport(
  context: AdminContext,
  actorId: string,
  userId: string,
  record: GatheredRecord,
): Promise<void> {
  const { written, received } = splitReviews(record);

  await recordAdminActionBestEffort(context, {
    actorId,
    action: 'user_data_exported',
    subjectType: 'user',
    subjectId: userId,
    /*
     * Counts, never content. `AdminActionDetail` is a flat map of scalars
     * precisely so an audit row cannot become a second copy of the thing it
     * records — and this is the one action where that mistake would copy a
     * whole person's file into a table nothing can delete.
     */
    detail: {
      bookingRequests: record.requests.length,
      bookings: record.bookings.length,
      reviewsWritten: written.length,
      reviewsReceived: received.length,
      messages: record.messages.length,
      notifications: record.notifications.length,
      legalAcceptances: record.acceptances.length,
    },
  });
}

/**
 * The bookings that refuse a closure, resolved with the counterparty's name so
 * the refusal can say which ones.
 */
async function closeBlockers(
  db: AppDatabase,
  userId: string,
  vendorProfileId: string | null,
  now: Date,
): Promise<AdminCloseBlocker[]> {
  const held = await findConfirmedBookingsToUnwind(db, userId, vendorProfileId, toDateString(now));

  if (held.length === 0) {
    return [];
  }

  const [dateRows, counterparties] = await Promise.all([
    findBookingEventDates(
      db,
      held.map((booking) => booking.id),
    ),
    findCounterparties(
      db,
      held.map((booking) =>
        booking.customerId === userId ? booking.vendorUserId : booking.customerId,
      ),
    ),
  ]);
  const dates = new Map(dateRows.map((row) => [row.id, row.eventDate]));
  const names = new Map(
    counterparties.map((row) => [
      row.id,
      row.businessName ?? `${row.firstName} ${row.lastName}`.trim(),
    ]),
  );

  return held.map((booking) => {
    const other = booking.customerId === userId ? booking.vendorUserId : booking.customerId;

    return {
      bookingId: booking.id,
      eventDate: dates.get(booking.id) ?? '',
      counterpartyName: names.get(other) ?? 'the other party',
    };
  });
}

/**
 * Closes an account on its holder's request, or **refuses** (D39).
 *
 * The refusal is the ticket. An account holding a future confirmed booking
 * cannot be closed: the customer cancels their upcoming bookings first, which
 * routes them through D3's existing tiers and prices the cancellation the way
 * every other cancellation on this platform is priced. Closing instead would
 * have handed out a better outcome for walking away than for asking — a full
 * refund on every future booking at once, with the vendors paid nothing.
 *
 * What it does when it proceeds is **#433's path, not a second one**: the same
 * `unwindAccountBookings` the Clerk `user.deleted` webhook runs, so a closure
 * asked for through the product and one that arrives as a deleted identity
 * leave the marketplace in the same state. It soft-deletes; it never hard-
 * deletes. The privacy policy already says payment and booking records persist,
 * and the acceptance record survives an account by design.
 *
 * **The Clerk self-serve path remains an unrefusable backstop, and that is
 * stated rather than implied.** `<UserButton />` offers account deletion at the
 * identity provider; a deletion there is *reactive*, so by the time
 * `user.deleted` reaches the webhook there is no identity left to refuse and no
 * response to carry a 409. Disabling that control is a setting in the Clerk
 * instance, not a line of code in this repository, so this route is the
 * refusing door and the webhook is the one that cannot refuse — where it leaves
 * the booking confirmed, payable and logged for a human, which decides nothing.
 */
export async function closeAccount(
  context: AdminContext,
  actorId: string,
  userId: string,
  now: Date,
): Promise<AdminCloseAccountResult> {
  if (actorId === userId) {
    /*
     * The same refusal `setUserBanned` makes, for a sharper reason: an operator
     * who closed their own account would take their entire `admin_actions` log
     * with them one hard delete later, and an audit trail an actor can erase is
     * not one. 403 rather than 400 — it is about who the caller is.
     */
    throw forbidden('You cannot close your own account');
  }

  const user = await findUserRecord(context.db, userId);

  if (!user) {
    throw notFound('No account with that id');
  }

  if (user.deletedAt) {
    throw conflict('That account is already closed');
  }

  const profile = await findVendorProfileRecord(context.db, userId);
  const blockers = await closeBlockers(context.db, userId, profile?.id ?? null, now);

  if (blockers.length > 0) {
    throw conflict(
      `This account holds ${blockers.length} upcoming confirmed ${
        blockers.length === 1 ? 'booking' : 'bookings'
      }. Those have to be cancelled through the booking screens first — cancelling there prices the refund; closing the account here does not price anything.`,
      { bookings: blockers },
    );
  }

  const retired = await retireUserById(context.db, userId);

  if (!retired) {
    // Another closure took the claim between the read above and this update.
    throw conflict('That account is already closed');
  }

  /*
   * After the retirement, and deliberately.
   *
   * `unwindAccountBookings` declines the open requests and tells both
   * counterparties, and it must not run against an account that is still live:
   * the ordering `applyUserDeleted` argues for is the same one — the account
   * goes, then the marketplace is tidied around it — so a failure in the tidy
   * leaves a closed account with stranded requests rather than a live account
   * whose counterparties have been told it is gone.
   */
  const unwound = await unwindAccountBookings(
    context,
    userId,
    profile?.id ?? null,
    now,
    CLOSURE_UNWIND,
  );

  if (unwound.bookingsLeftForReview > 0 || unwound.refundsFailed > 0) {
    /*
     * Only reachable through the gap between the blocker read and this call: a
     * booking confirmed in between. It is left standing rather than priced, per
     * D39, and needs a human — the same line `applyUserDeleted` raises.
     */
    context.log.error(
      { userId, actorId, ...unwound },
      'An account closure left bookings confirmed; they need an operator',
    );
  }

  await recordAdminActionBestEffort(context, {
    actorId,
    action: 'user_closed',
    subjectType: 'user',
    subjectId: userId,
    detail: {
      requestsDeclined: unwound.requestsDeclined,
      bookingsCancelled: unwound.bookingsCancelled,
      bookingsLeftForReview: unwound.bookingsLeftForReview,
      profileRetired: retired.profileRetired,
    },
  });

  return {
    userId,
    closedAt: retired.user.deletedAt ?? now,
    requestsDeclined: unwound.requestsDeclined,
    bookingsCancelled: unwound.bookingsCancelled,
    bookingsLeftForReview: unwound.bookingsLeftForReview,
    profileRetired: retired.profileRetired,
  };
}

/**
 * What the console shows for one account: what is still held, what would refuse
 * a closure right now, and the legal record.
 *
 * The same gather the export runs, counted rather than enumerated — so the
 * console cannot quietly report a smaller record than the export hands over.
 */
export async function readUserDataRights(
  db: AppDatabase,
  userId: string,
  now: Date,
): Promise<AdminUserDataRights> {
  const user = await findUserRecord(db, userId);

  if (!user) {
    throw notFound('No account with that id');
  }

  const record = await gather(db, user);
  const { written, received } = splitReviews(record);
  const blockers = user.deletedAt
    ? []
    : await closeBlockers(db, userId, record.profile?.id ?? null, now);

  return {
    userId: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    isBanned: user.isBanned,
    closedAt: user.deletedAt,
    vendorProfileId: record.profile?.id ?? null,
    vendorSlug: record.profile?.slug ?? null,
    retained: {
      bookingRequests: record.requests.length,
      bookings: record.bookings.length,
      reviewsWritten: written.length,
      reviewsReceived: received.length,
      messages: record.messages.length,
      notifications: record.notifications.length,
      legalAcceptances: record.acceptances.length,
    },
    closeBlockers: blockers,
    legalAcceptances: record.acceptances.map(toAcceptanceRecord),
  };
}
