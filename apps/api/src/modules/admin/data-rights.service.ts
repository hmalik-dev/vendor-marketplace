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
import type { ClerkUserDeleter } from '../../plugins/clerk-auth.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { retireUserById } from '../users/users.dao.js';
import { isClerkIdentity } from '../webhooks/clerk.reconcile.js';
import { findConfirmedBookingsToUnwind } from './admin.dao.js';
import { fullName, recordAdminActionBestEffort } from './admin.service.js';
import {
  bestEffortNotice,
  CLOSURE_UNWIND,
  unwindAccountBookings,
  type AdminContext,
} from './account-unwind.js';
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
  await recordExport(context, actorId, user.id, record, { written, received });

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
      pendingEmail: user.pendingEmail,
      emailSyncFailedAt: user.emailSyncFailedAt,
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
      name: row.businessName ?? fullName(row.firstName, row.lastName),
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
  reviews: { written: ExportReviewRow[]; received: ExportReviewRow[] },
): Promise<void> {
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
      reviewsWritten: reviews.written.length,
      reviewsReceived: reviews.received.length,
      messages: record.messages.length,
      notifications: record.notifications.length,
      legalAcceptances: record.acceptances.length,
    },
  });
}

/**
 * The bookings that refuse a closure, resolved with the counterparty's name so
 * the refusal can say which ones.
 *
 * **The subject's own bookings, as the customer on them — never the ones they
 * hold as the vendor.** D39 draws the line there explicitly: refunding a future
 * confirmed booking in full "is correct when a **vendor** is removed — the
 * customer did nothing wrong and the vendor walked away — and it inverts when a
 * **customer** removes themselves". So the refusal exists for the customer side
 * only, and `unwindAccountBookings` already agrees with that: its
 * leave-for-review branch is guarded on `initiatedBy === 'account-holder' &&
 * booking.customerId === targetId`, and everything else is refunded in full.
 *
 * Passing `null` for the vendor profile is what narrows
 * `findConfirmedBookingsToUnwind` — which selects **both** sides, exactly the
 * width D39 was written to correct — down to `customer_id = subject`. Refusing
 * on the vendor side instead would have been a dead end rather than a rule: only
 * the customer can cancel a confirmed booking (`payments.service.ts` answers
 * `Only the customer can cancel a confirmed booking`), so a vendor asking to
 * close would be told to do something they cannot do, by a counterparty with no
 * reason to do it for them.
 */
async function closeBlockers(
  db: AppDatabase,
  userId: string,
  now: Date,
): Promise<AdminCloseBlocker[]> {
  const held = await findConfirmedBookingsToUnwind(db, userId, null, toDateString(now));

  if (held.length === 0) {
    return [];
  }

  /* The side the subject is not on, decided once per booking by the one rule. */
  const sides = held.map((booking) => ({ booking, other: otherParty(booking, userId) }));

  const [dateRows, counterparties] = await Promise.all([
    findBookingEventDates(
      db,
      sides.map(({ booking }) => booking.id),
    ),
    findCounterparties(
      db,
      sides.map(({ other }) => other),
    ),
  ]);
  const dates = new Map(dateRows.map((row) => [row.id, row.eventDate]));
  const names = new Map(
    counterparties.map((row) => [
      row.id,
      row.businessName ?? fullName(row.firstName, row.lastName),
    ]),
  );

  return sides.map(({ booking, other }) => ({
    bookingId: booking.id,
    eventDate: dates.get(booking.id) ?? '',
    counterpartyName: names.get(other) ?? 'the other party',
  }));
}

/**
 * The bookings a closure would cancel and refund in full: the ones this
 * account holds **as the vendor**.
 *
 * The other side of `closeBlockers`, and the side that moves money. D39
 * refuses a customer's closure while their own forward bookings stand, and
 * refunds a vendor's customers in full when the vendor goes — so a closure is
 * never priced against the person asking for it, and is always priced for the
 * person on the other end. The console needs the count because the operator
 * confirming the closure is the only person who can be told first.
 */
async function vendorSideRefundsOnClose(
  db: AppDatabase,
  userId: string,
  vendorProfileId: string | null,
  now: Date,
): Promise<number> {
  if (!vendorProfileId) {
    return 0;
  }

  const held = await findConfirmedBookingsToUnwind(db, userId, vendorProfileId, toDateString(now));

  return held.filter((booking) => booking.customerId !== userId).length;
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
 *
 * ---
 *
 * **NEVER DRIVE THIS ROUTE AGAINST A SEEDED E2E ACCOUNT.** Since #451 a closure
 * **deletes the Clerk identity**, and that deletion is not recoverable from
 * this repository. `db:seed:e2e` *resolves* the Clerk ids behind the E2E
 * customer, vendor and admin emails rather than creating them — deliberately,
 * because a `users` row carrying an E2E email under an invented id locks that
 * account out on its next sign-in — so re-seeding cannot put a deleted identity
 * back. Only a person with the Clerk dashboard can. The admin fixture is the
 * worst case: it is the only route to `/admin` at all, because `role = 'admin'`
 * is unreachable from inside the product.
 *
 * Verify against a throwaway `+clerk_test` sign-up instead. The **refusal**
 * path is safe and is what most passes actually want — D39 answers 409 while
 * the account holds a future confirmed booking, and the console disables the
 * button before it can be pressed — so verifying the refusal never reaches the
 * deletion.
 */
export async function closeAccount(
  context: AdminContext,
  actorId: string,
  userId: string,
  now: Date,
  deleteClerkUser: ClerkUserDeleter,
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

  if (user.role === 'admin') {
    /*
     * A second refusal, and #451 is what earns it.
     *
     * Closing another operator used to be a reversible soft-delete. It now
     * **destroys their Clerk identity**, and nothing in this repository can put
     * one back: `db:seed:e2e` resolves the Clerk ids behind its accounts rather
     * than creating them, and `role = 'admin'` is unreachable from inside the
     * product, so the only recovery is a person provisioning a user in the
     * Clerk dashboard by hand. The self-closure refusal above already says an
     * audit trail its own actor can erase is not one; the same argument is
     * stronger for a peer now that the erasure cannot be undone.
     *
     * **Ruled 2026-09-07: hurdles, not refusal — and the hurdles are #460.**
     * An operator account must stay closable, because people leave; the
     * friction just has to be proportionate to being unrecoverable. So this
     * refusal is the *default until that friction exists*, not the destination:
     * #460 builds a typed confirmation on the target's own email, a structural
     * refusal when no other live admin would remain, a dialog saying the
     * sign-in comes back only from Clerk's dashboard, and its own
     * `admin_actions` value. Delete this refusal **in the same commit** that
     * adds them — relaxing it first would leave the console worse than it is
     * today, which is the one outcome neither direction wants.
     */
    throw forbidden(
      'An operator account cannot be closed here. Closing it would delete a sign-in that only the identity provider can restore.',
    );
  }

  if (user.deletedAt) {
    throw conflict('That account is already closed');
  }

  const profile = await findVendorProfileRecord(context.db, userId);
  const blockers = await closeBlockers(context.db, userId, now);

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

  /*
   * The identity itself goes, not just its sessions — last, and deliberately.
   *
   * Deleting the Clerk user fires `user.deleted` straight back at our own
   * webhook, so the local row has to be retired and the marketplace already
   * tidied by the time that arrives. It is: `applyUserDeleted` looks for a
   * **live** row and finds none, and `retireUserByClerkId` would fail its
   * `notDeleted` predicate anyway. The redelivery is therefore `ignored` and
   * cannot unwind this account a second time or refund anything twice, which
   * is #433's replay guard doing exactly the job it was built for.
   *
   * Reported rather than thrown, through the same helper the audit write and
   * the unwind's notifications use: the retirement has already committed and
   * an operator cannot repeat a closure — the route answers 409 on a closed
   * account — so a network failure at Clerk must not answer 500 and tell them
   * nothing happened. It comes back as `identityDeleted: false`, and the
   * console asks for a person, the shape a refused refund already takes.
   */
  const identityDeleted = isClerkIdentity(user.clerkUserId)
    ? await bestEffortNotice(
        context,
        { userId },
        () => deleteClerkUser(user.clerkUserId),
        'An account closure could not delete its Clerk identity; that person is still signed in',
      )
    : /*
       * A row Clerk never issued has no identity to end, so there is nothing
       * owed and nothing to call. `isClerkIdentity` is the predicate the
       * reconcile pass already owns for this exact distinction — *"a row Clerk
       * never issued is not a row Clerk deleted"* — and the seeded marketplace
       * accounts (`seed_mkt_…`) are live, listed on `/admin/customers`, and
       * closable. Without it, closing one sends a fabricated id to Clerk and
       * reports whatever Clerk says about it: a 404 becomes `true`, telling an
       * operator a sign-in was deleted that never existed, and a 400 becomes
       * `false`, sending them to the dashboard to hunt for it. Both answers are
       * written into `admin_actions`, which carries an immutability trigger, so
       * the false record cannot be corrected afterwards.
       */
      true;

  await recordAdminActionBestEffort(context, {
    actorId,
    action: 'user_closed',
    subjectType: 'user',
    subjectId: userId,
    detail: {
      requestsDeclined: unwound.requestsDeclined,
      bookingsCancelled: unwound.bookingsCancelled,
      bookingsLeftForReview: unwound.bookingsLeftForReview,
      refundsIssued: unwound.refundsIssued,
      refundsFailed: unwound.refundsFailed,
      profileRetired: retired.profileRetired,
      identityDeleted,
    },
  });

  return {
    userId,
    closedAt: retired.user.deletedAt ?? now,
    requestsDeclined: unwound.requestsDeclined,
    bookingsCancelled: unwound.bookingsCancelled,
    bookingsLeftForReview: unwound.bookingsLeftForReview,
    refundsIssued: unwound.refundsIssued,
    refundsFailed: unwound.refundsFailed,
    profileRetired: retired.profileRetired,
    identityDeleted,
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
  const blockers = user.deletedAt ? [] : await closeBlockers(db, userId, now);
  const bookingsRefundedOnClose = user.deletedAt
    ? 0
    : await vendorSideRefundsOnClose(db, userId, record.profile?.id ?? null, now);

  return {
    userId: user.id,
    email: user.email,
    name: fullName(user.firstName, user.lastName),
    role: user.role,
    isBanned: user.isBanned,
    pendingEmail: user.pendingEmail,
    emailSyncFailedAt: user.emailSyncFailedAt,
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
    bookingsRefundedOnClose,
    legalAcceptances: record.acceptances.map(toAcceptanceRecord),
  };
}
