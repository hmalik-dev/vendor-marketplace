import { withRequestIdentity } from '@vendor-marketplace/db';
import { unwindFloorDate } from '@vendor-marketplace/shared';
import type {
  AdminCloseAccountResult,
  AdminCloseBlocker,
  AdminUserDataRights,
  AdminUserExport,
  CloseOwnAccount,
  CloseOwnAccountReadiness,
  CloseOwnAccountResult,
  LegalAcceptanceRecord,
} from '@vendor-marketplace/shared';
import type { LegalAcceptanceRow, UserRow, VendorProfileRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { removeOwnedObjects, type ObjectStorage } from '../../lib/storage.js';
import { isSeededIdentity, type AuthIdentityDeleter } from '../auth-sync/identity.js';
import {
  conflict,
  forbidden,
  notFound,
  validationFailed,
  type AppError,
} from '../../lib/errors.js';
import type { StepUpStore } from '../../lib/step-up.js';
import { completeStepUp } from './admin-step-up.service.js';
import {
  hasAnotherLiveOperator,
  retireOperatorById,
  retireUserById,
  type RetirementAudit,
} from '../users/users.dao.js';
import { findConfirmedBookingsToUnwind, insertAdminAction } from './admin.dao.js';
import { fullName, recordAdminActionBestEffort } from './admin.service.js';
import {
  bestEffortNotice,
  CLOSURE_UNWIND,
  countUnwindPending,
  SUSPENSION_UNWIND,
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
 * `auth_user_id` is the join key into the identity provider. Returning it
 * discloses how the platform is wired without telling the subject anything
 * about themselves, so it is left out and said so.
 */
const INTERNAL_ID_WITHHOLDING = {
  section: 'subject',
  fields: ['authUserId'],
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
async function gather(db: AppDatabase, user: UserRow, actorId: string): Promise<GatheredRecord> {
  const profile = await findVendorProfileRecord(db, user.id);
  const profileId = profile?.id ?? null;

  const [requests, bookingRows, reviewRows, messageRows, notificationRows, acceptances] =
    await Promise.all([
      findExportBookingRequests(db, user.id, profileId),
      findExportBookings(db, user.id, profileId),
      findExportReviews(db, user.id, profileId),
      withRequestIdentity(db, { userId: actorId, role: 'admin', operator: true }, (tx) =>
        findExportMessages(tx, user.id, profileId),
      ),
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

  const record = await gather(context.db, user, actorId);
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
  /*
   * Not best-effort (VEN-684). The row is what the hourly ceiling counts, and
   * nothing irreversible has happened yet: the file has not been returned. So a
   * log that cannot be written withholds the file — an export that could not be
   * logged did not happen, as it does for the CSV exports (VEN-475).
   */
  await insertAdminAction(context.db, {
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
  const held = await findConfirmedBookingsToUnwind(db, userId, null, unwindFloorDate(now));

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

  const held = await findConfirmedBookingsToUnwind(
    db,
    userId,
    vendorProfileId,
    unwindFloorDate(now),
  );

  return held.filter((booking) => booking.customerId !== userId).length;
}

/** The last-operator refusal — one sentence for the unlocked read and the locked write. */
export const LAST_OPERATOR_REFUSAL =
  'This is the last operator account that can still sign in. Closing it would leave nobody able to reach the console, and only the identity provider could restore one.';

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
 * `unwindAccountBookings` the reconcile pass runs for an identity deleted at
 * Neon Auth, so a closure asked for through the product and one that arrives as
 * a deleted identity leave the marketplace in the same state. It soft-deletes; it never hard-
 * deletes. The privacy policy already says payment and booking records persist,
 * and the acceptance record survives an account by design.
 *
 * **A deletion at the identity provider remains an unrefusable backstop, and
 * that is stated rather than implied.** Neon Auth has no self-serve account
 * deletion in this product, but its console can delete a user; that deletion is
 * *reactive*, so by the time the reconcile pass sees it there is no identity
 * left to refuse and no response to carry a 409. This route is the refusing
 * door and the pass is the one that cannot refuse — where it leaves the booking
 * confirmed, payable and logged for a human, which decides nothing.
 *
 * ---
 *
 * **NEVER DRIVE THIS ROUTE AGAINST A SEEDED E2E ACCOUNT.** A closure
 * **deletes the Neon Auth identity**, and that deletion is not recoverable from
 * this repository. `db:seed:e2e` *resolves* the ids behind the E2E customer,
 * vendor and admin by signing in as them rather than creating them —
 * deliberately, because a `users` row carrying an E2E email under an invented id
 * locks that account out on its next sign-in — so re-seeding cannot put a
 * deleted identity back. Only a person can. The admin fixture is the worst
 * case: it is the only route to `/admin` at all, because `role = 'admin'` is
 * unreachable from inside the product.
 *
 * Verify against the throwaway account instead. The **refusal** path is safe
 * and is what most passes actually want — D39 answers 409 while the account
 * holds a future confirmed booking, and the console disables the button before
 * it can be pressed — so verifying the refusal never reaches the deletion.
 */

/**
 * Ends the identity, and reports it only when something was actually removed.
 *
 * "Nothing removed" is not success here: an id this branch does not hold reads
 * the same as one already gone — a store pointed at the wrong branch is the
 * anticipated mistake — and `identityDeleted: true` goes to the console,
 * which acts on it. So the console asks for a person instead.
 */
async function deleteAndConfirm(
  context: AdminContext,
  userId: string,
  authUserId: string,
  deleteIdentity: AuthIdentityDeleter,
): Promise<boolean> {
  let removed = false;
  const completed = await bestEffortNotice(
    context,
    { userId },
    async () => {
      removed = await deleteIdentity(authUserId);
    },
    'An account closure could not delete its Neon Auth identity; that person can still sign in',
  );

  if (completed && !removed) {
    context.log.error(
      { userId },
      'An account closure found no Neon Auth identity to delete; the store may point at another branch',
    );
    /*
     * And a page, not only a log line (VEN-649): a delete that removed nothing
     * is also what a change to Neon's private schema looks like, and then every
     * closure leaves a person able to sign in until someone reads the logs.
     */
    context.alerts?.dispatch({
      kind: 'auth_identity_kept',
      subjectId: userId,
      summary: 'An account closure removed no Neon Auth identity',
      details: [
        `User ${userId} is closed here, but deleting their Neon Auth identity affected 0 rows.`,
        'Either the identity was already gone, or the API reads a different Neon Auth branch or schema than the one that signs this person in.',
        'Check the identity in the Neon console; if it still exists, the person can still sign in.',
      ],
      adminPath: `/admin/users/${userId}`,
    });
  }

  return completed && removed;
}

/** The 409 that refuses a closure while future confirmed bookings stand (D39). */
function blockedByBookings(blocked: AdminCloseBlocker[]): AppError {
  return conflict(
    `This account holds ${blocked.length} upcoming confirmed ${
      blocked.length === 1 ? 'booking' : 'bookings'
    }. Those have to be cancelled through the booking screens first — cancelling there prices the refund; closing the account here does not price anything.`,
    { bookings: blocked },
  );
}

export async function closeAccount(
  context: AdminContext,
  actorId: string,
  userId: string,
  now: Date,
  /** `null` where the deployment has no connection to Neon Auth's schema. */
  deleteIdentity: AuthIdentityDeleter | null,
  storage: Pick<ObjectStorage, 'list' | 'remove'>,
): Promise<AdminCloseAccountResult> {
  const user = await findUserRecord(context.db, userId);

  if (!user) {
    throw notFound('No account with that id');
  }

  /*
   * Closing another operator is allowed, past friction (VEN-391, ruled
   * 2026-09-07: hurdles, not refusal — people leave). The friction is the
   * console's typed confirmation on the target's email, and this structural
   * refusal: never the last operator who can still sign in.
   *
   * **Before the self-closure refusal, and not relying on it.** That refusal
   * happens to guarantee an actor survives, but a guard that depends on another
   * guard's side effect breaks silently when that one changes — so this answers
   * the same 409 whoever asks. `retireOperatorById` repeats the check under a
   * lock, because two operators closing each other at once both pass this read.
   */
  const operatorTarget = user.role === 'admin';

  if (operatorTarget && !user.deletedAt && !(await hasAnotherLiveOperator(context.db, userId))) {
    throw conflict(LAST_OPERATOR_REFUSAL);
  }

  if (actorId === userId) {
    /*
     * The same refusal `setUserBanned` makes, for a sharper reason: an operator
     * who closed their own account would retire the actor of their own audit
     * rows, and an audit trail an actor can retire is not one. 403 rather than 400 — it is about who the caller is.
     */
    throw forbidden('You cannot close your own account');
  }

  return runClosure(context, actorId, user, now, deleteIdentity, storage);
}

/**
 * The closure itself, past the checks that are about **who is asking**: the
 * admin route's last-admin and self-closure refusals stay in
 * `closeAccount`, and a person closing their own account reaches this through
 * `closeOwnAccount` with its own confirmation. One core, so both leave the
 * marketplace in the same state.
 */
async function runClosure(
  context: AdminContext,
  actorId: string,
  user: UserRow,
  now: Date,
  deleteIdentity: AuthIdentityDeleter | null,
  storage: Pick<ObjectStorage, 'list' | 'remove'>,
): Promise<AdminCloseAccountResult> {
  const userId = user.id;
  const operatorTarget = user.role === 'admin';
  const profile = await findVendorProfileRecord(context.db, userId);

  /*
   * A closure re-run on a closed account is the **resume** (VEN-478), where the
   * unwind was interrupted after the retirement committed: it skips the
   * retirement and its intent row and finishes the unwind. Only while something
   * is still pending; a finished closure is still a 409.
   */
  const resuming = user.deletedAt !== null;

  if (
    resuming &&
    (await countUnwindPending(context.db, userId, profile?.id ?? null, now, CLOSURE_UNWIND)) === 0
  ) {
    throw conflict('That account is already closed');
  }

  /*
   * The blockers are read **inside** the retirement, under the account's row
   * lock (VEN-483). Read before it, a booking confirmed in between was left
   * standing with a closed customer; now it either commits first and refuses
   * the closure here, or waits until the retirement has committed.
   */
  function blockersOf(tx: AppDatabase): Promise<AdminCloseBlocker[]> {
    return closeBlockers(tx, userId, now);
  }

  /*
   * The audit row commits with the retirement or not at all (VEN-463): a closure
   * that cannot be recorded does not happen, and the operator simply repeats it.
   * It is the intent row (VEN-478): the trail starts with the attempt, and what
   * the unwind then did is a row of its own, because rows cannot be updated.
   */
  const audit: RetirementAudit = (tx, { profileRetired }) =>
    insertAdminAction(tx, {
      actorId,
      action: operatorTarget ? 'operator_account_closed' : 'user_closed',
      subjectType: 'user',
      subjectId: userId,
      detail: { profileRetired },
    });

  let retired: { user: UserRow; profileRetired: boolean };

  if (resuming) {
    retired = { user, profileRetired: false };
  } else {
    const result = operatorTarget
      ? await retireOperatorById(context.db, userId, blockersOf, audit)
      : await retireUserById(context.db, userId, blockersOf, audit);

    if (result === 'last-operator') {
      throw conflict(LAST_OPERATOR_REFUSAL);
    }

    if (result && 'blocked' in result) {
      throw blockedByBookings(result.blocked);
    }

    if (!result) {
      // Another closure took the claim between the read above and this update.
      throw conflict('That account is already closed');
    }

    retired = result;
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
   * The person's uploads go once the closure has committed (VEN-614): a closed
   * vendor's storefront images and a customer's avatar are public URLs, and
   * the rows that named them are kept for the financial record. Best-effort,
   * like everything after the commit: the upload sweep no longer counts a
   * closed account's rows as references, so it deletes whatever this missed.
   */
  await bestEffortNotice(
    context,
    { userId },
    async () => {
      await removeOwnedObjects(storage, user.id);
    },
    "An account closure could not delete the account's uploads; the upload sweep will retry",
  );

  /*
   * The identity itself goes, not just its sessions — last, and deliberately.
   *
   * The local row is already retired and the marketplace tidied by the time the
   * identity goes, so the next reconcile pass finds no **live** row for it and
   * cannot unwind this account a second time or refund anything twice — #433's
   * replay guard doing exactly the job it was built for. Until the identity is
   * gone a session token for it still verifies for up to 15 minutes (VEN-444,
   * q3); the retired row is what refuses it meanwhile.
   *
   * Reported rather than thrown, through the same helper the unwind's
   * notifications use: the retirement has already committed and
   * an operator cannot repeat a closure — the route answers 409 on a closed
   * account — so a failure at Neon Auth must not answer 500 and tell them
   * nothing happened. It comes back as `identityDeleted: false`, and the
   * console asks for a person, the shape a refused refund already takes.
   *
   * A seeded marketplace account (`auth_provider = 'seed'`) has no identity anywhere, so
   * nothing is owed. A deployment with no connection to the identity store
   * (`deleteIdentity` is `null`) cannot end one, and says so the same way.
   */
  const identityDeleted = isSeededIdentity(user.authProvider)
    ? true
    : deleteIdentity === null
      ? false
      : await deleteAndConfirm(context, userId, user.authUserId, deleteIdentity);

  context.log.info(
    { userId, actorId, ...unwound, identityDeleted },
    'An account closure finished unwinding',
  );

  /*
   * What the closure then did, as a row of its own: the intent row above
   * cannot be updated. Always written, because `identityDeleted` is the fact
   * about an irreversible act that the trail must hold.
   */
  await recordAdminActionBestEffort(context, {
    actorId,
    action: 'account_unwind_finished',
    subjectType: 'user',
    subjectId: userId,
    detail: {
      requestsDeclined: unwound.requestsDeclined,
      bookingsCancelled: unwound.bookingsCancelled,
      bookingsLeftForReview: unwound.bookingsLeftForReview,
      refundsIssued: unwound.refundsIssued,
      refundsFailed: unwound.refundsFailed,
      /*
       * A resume records only a deletion it made: it cannot tell "the first run
       * already deleted it" from "never could", and a `false` here would put an
       * uncorrectable falsehood in the log.
       */
      ...(resuming && !identityDeleted ? {} : { identityDeleted }),
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

/** Refused for an admin account: the console is the only door, and it keeps its own guards. */
export const ADMIN_SELF_CLOSURE_REFUSAL =
  'Admin accounts cannot be closed from account settings. Ask another admin to close it from the console.';

/** The address typed back is compared the way sign-in compares it. */
function sameAddress(typed: string, onFile: string): boolean {
  return typed.trim().toLowerCase() === onFile.trim().toLowerCase();
}

async function readOwnCloser(db: AppDatabase, userId: string): Promise<UserRow> {
  const user = await findUserRecord(db, userId);

  if (!user) {
    throw notFound('No account with that id');
  }

  if (user.role === 'admin') {
    throw forbidden(ADMIN_SELF_CLOSURE_REFUSAL);
  }

  return user;
}

/**
 * What would refuse the caller's own closure right now, so the settings page
 * can say so before it asks for a code (VEN-680).
 */
export async function readOwnCloseReadiness(
  db: AppDatabase,
  userId: string,
  now: Date,
): Promise<CloseOwnAccountReadiness> {
  const user = await readOwnCloser(db, userId);

  return { blockers: user.deletedAt ? [] : await closeBlockers(db, userId, now) };
}

/**
 * A customer or vendor closes **their own** account (VEN-680): the closure an
 * admin performs, run for the caller after a fresh proof — the address typed
 * back and the emailed code — so a stolen session alone cannot do it.
 *
 * Order matters. The typed address and the D39 refusal are checked **before**
 * the code is spent, so a mistyped address or a standing booking costs the
 * person nothing; the core re-reads the blockers under the row lock, which is
 * the check that holds. The audit row names the person as its actor: a retired
 * row keeps its id, so the foreign key holds. An admin account is refused
 * here and keeps its own guards on the console route.
 *
 * A closed account answers 409 through the core; one whose unwind was
 * interrupted is finished by re-running the closure (VEN-478) and skips the
 * proof, since nothing new is being ended. A closed person's session no longer
 * resolves, so over HTTP the console's route is what finishes it; this branch
 * is the service's own.
 */
export async function closeOwnAccount(
  context: AdminContext,
  userId: string,
  confirmation: CloseOwnAccount,
  now: Date,
  deleteIdentity: AuthIdentityDeleter | null,
  storage: Pick<ObjectStorage, 'list' | 'remove'>,
  stepUp: StepUpStore,
): Promise<CloseOwnAccountResult> {
  const user = await readOwnCloser(context.db, userId);

  if (!user.deletedAt) {
    if (!sameAddress(confirmation.email, user.email)) {
      throw validationFailed('That is not the email address on this account.');
    }

    const blockers = await closeBlockers(context.db, userId, now);

    if (blockers.length > 0) {
      throw blockedByBookings(blockers);
    }

    await completeStepUp(stepUp, userId, confirmation.code, now);
    // The grant a spent code buys opens admin routes and nothing here needs it.
    await stepUp.revoke(userId);
  }

  const closed = await runClosure(context, userId, user, now, deleteIdentity, storage);

  return { closedAt: closed.closedAt };
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
  actorId: string,
  userId: string,
  now: Date,
): Promise<AdminUserDataRights> {
  const user = await findUserRecord(db, userId);

  if (!user) {
    throw notFound('No account with that id');
  }

  const record = await gather(db, user, actorId);
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
    unwindPending:
      user.deletedAt || user.isBanned
        ? await countUnwindPending(
            db,
            userId,
            record.profile?.id ?? null,
            now,
            user.deletedAt ? CLOSURE_UNWIND : SUSPENSION_UNWIND,
          )
        : 0,
    bookingsRefundedOnClose,
    legalAcceptances: record.acceptances.map(toAcceptanceRecord),
  };
}
