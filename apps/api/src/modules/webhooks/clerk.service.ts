import type { UserRow } from '@vendor-marketplace/db/schema';
import {
  DELETION_UNWIND,
  unwindAccountBookings,
  type AdminContext,
} from '../admin/account-unwind.js';
import { findVendorProfileByUserId } from '../admin/admin.dao.js';
import {
  findLiveUserByEmail,
  findUserByAuthId,
  retireUserByAuthId,
  updateUserByAuthId,
} from '../users/users.dao.js';
import { mirroredAuthName, syncUserFromAuth } from '../users/users.service.js';
import {
  asWebhookData,
  clerkUsersIn,
  isClerkIdentity,
  type ClerkApiUser,
  type ClerkUserSource,
} from './clerk-user-source.js';
import { primaryEmail, type ClerkWebhookEvent } from './clerk.schemas.js';

export type ClerkWebhookOutcome =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'ignored'
  /**
   * Applied, but the address could not be written because another row holds it
   * (#462). Distinct from `updated` because `pnpm reconcile:clerk` counts these
   * and would otherwise report a row it did not repair as corrected — on every
   * run, since the row stays drifted.
   */
  | 'diverged';

/**
 * Applies one verified Clerk lifecycle event. Events arrive out of order and
 * are redelivered on any non-2xx reply, so every branch is idempotent and an
 * event for an unknown user is a no-op rather than an error.
 *
 * It takes the full `AdminContext` rather than a database handle because
 * `user.deleted` moves money (#433): a deletion unwinds the account's bookings
 * on exactly the code path a ban does, and that path needs Stripe, the event hub
 * and the mailer.
 */
export async function applyClerkUserEvent(
  context: AdminContext,
  event: ClerkWebhookEvent,
  now: Date,
  /** Asked who really holds an address a `user.updated` collided on. */
  clerk: ClerkUserSource,
): Promise<ClerkWebhookOutcome> {
  const db = context.db;
  const authUserId = event.data.id;

  switch (event.type) {
    case 'user.created': {
      const email = primaryEmail(event.data);
      if (!email) {
        return 'ignored';
      }

      const created: UserRow | null = await syncUserFromAuth(db, {
        authUserId,
        email,
        firstName: event.data.first_name ?? '',
        lastName: event.data.last_name ?? '',
        roleHint: event.data.unsafe_metadata?.role,
        avatarUrl: event.data.image_url || null,
      });

      return created ? 'created' : 'ignored';
    }

    case 'user.updated': {
      // Role is fixed at sign-up; only contact details are mirrored onward.
      const email = primaryEmail(event.data);
      /*
       * The names go through `mirroredAuthName` here as well as on the create
       * path: this patch does not pass through `syncUserFromAuth`, so a bidi
       * control stripped at sign-up would come straight back the next time the
       * account holder edited their Clerk profile (#398).
       */
      const patch = {
        ...(email === null ? {} : { email }),
        ...(event.data.first_name === undefined || event.data.first_name === null
          ? {}
          : { firstName: mirroredAuthName(event.data.first_name) }),
        ...(event.data.last_name === undefined || event.data.last_name === null
          ? {}
          : { lastName: mirroredAuthName(event.data.last_name) }),
        ...(event.data.image_url === undefined ? {} : { avatarUrl: event.data.image_url || null }),
      };

      let mirrored = await updateUserByAuthId(db, authUserId, patch);

      /*
       * A collision means the holder is the stale row — Clerk gives an address
       * to one identity — so ask Clerk about it and retry once if that
       * released the address (VEN-386).
       */
      if (
        mirrored?.emailDiverged &&
        email !== null &&
        (await releaseStaleHolder(context, clerk, mirrored.user, email, now))
      ) {
        mirrored = await updateUserByAuthId(db, authUserId, patch);
      }

      if (!mirrored) {
        return 'ignored';
      }

      /*
       * The address Clerk sent belongs to another row, so it was recorded as
       * pending rather than written (#462). The event still **succeeds**: svix
       * would redeliver a failure until it gave up, and every one of those
       * deliveries would meet the same other row.
       *
       * `email_sync_failed_at` and `pending_email` are what an operator acts
       * on — `/admin/customers?flag=email-stale` lists them — and this line is
       * the same class of report as the stranded-refund line below: something
       * went wrong after a committed operation, and only a person can finish
       * it.
       */
      if (mirrored.emailDiverged) {
        context.log.error(
          { userId: mirrored.user.id, authUserId },
          'Clerk sent an address another account already holds; users.email is now stale',
        );

        return 'diverged';
      }

      return 'updated';
    }

    case 'user.deleted': {
      return applyUserDeleted(context, authUserId, now);
    }

    default:
      return 'ignored';
  }
}

/**
 * Frees an address a live row holds but Clerk no longer gives it, and answers
 * whether the claimant's write is now worth retrying (VEN-386).
 *
 * The holder is stale by construction — a missed `user.deleted`, or a
 * `user.updated` moving it off the address still in flight — so Clerk is the
 * arbiter:
 *
 * - **Gone from Clerk** → the deletion that never arrived, through the same
 *   `applyUserDeleted` a delivered one takes. Retiring the row alone would
 *   leave its bookings for an account nobody can answer.
 * - **Moved in Clerk** → its address is mirrored, which releases this one.
 *   Exactly one hop: if that address collides too the holder records its own
 *   divergence and the chain stops here, rather than walking accounts.
 * - **Still the owner**, or **Clerk unreachable** → nothing to do; the claimant
 *   stays `diverged`, as before this ticket.
 *
 * A holder Clerk never issued (a seeded account) is never asked about: Clerk
 * would answer "no such user", and reading that as a deletion retires the demo
 * marketplace.
 */
async function releaseStaleHolder(
  context: AdminContext,
  clerk: ClerkUserSource,
  claimant: UserRow,
  email: string,
  now: Date,
): Promise<boolean> {
  const { id: claimantId, authUserId: claimantClerkUserId } = claimant;
  const holder = await findLiveUserByEmail(context.db, email);

  if (!holder) {
    // Released between the collision and this read.
    return true;
  }

  if (holder.id === claimantId || !isClerkIdentity(holder.authUserId)) {
    return false;
  }

  let remote: ClerkApiUser | undefined;
  try {
    /*
     * The claimant is asked about too, as a control: Clerk just sent its
     * event, so it exists. If Clerk does not know it either, this API holds a
     * key for a different Clerk instance — and reading every holder as deleted
     * would retire live accounts and refund their bookings.
     */
    const found = clerkUsersIn(
      await clerk.getUserList({ userId: [holder.authUserId, claimantClerkUserId], limit: 2 }),
    );

    if (!found.some((user) => user.id === claimantClerkUserId)) {
      throw new Error('Clerk does not know the identity whose event it just delivered');
    }

    remote = found.find((user) => user.id === holder.authUserId);
  } catch (error) {
    context.log.error(
      { userId: claimantId, holderId: holder.id, err: error },
      'Could not ask Clerk who holds a contested address; the account stays diverged',
    );

    return false;
  }

  if (!remote) {
    await applyUserDeleted(context, holder.authUserId, now);

    return true;
  }

  const remoteEmail = primaryEmail(asWebhookData(remote));

  if (remoteEmail === null || remoteEmail === email) {
    return false;
  }

  const corrected = await updateUserByAuthId(context.db, holder.authUserId, {
    email: remoteEmail,
  });

  return corrected !== null && !corrected.emailDiverged;
}

/**
 * A Clerk identity is gone, so the marketplace has to stop pointing at it.
 *
 * The ban path argues this at length and the argument is the same one: nobody
 * should be waiting on an account that can no longer answer. The row and the
 * storefront are retired, open requests are declined, and future confirmed
 * bookings against the closed account are cancelled and refunded in full.
 *
 * The vendor profile is read **before** the retirement, because the retirement
 * writes `is_deleted` and `findVendorProfileByUserId` filters on it.
 *
 * **The retirement is the claim, and it is taken first.** It is a conditional
 * `UPDATE ... WHERE deleted_at IS NULL RETURNING`, so exactly one delivery of a
 * redelivered event gets a row back and the rest return before they can reach
 * the unwind. Reading the user first and retiring afterwards looked equivalent
 * and was not: a read is not a claim, and the window between it and the
 * retirement was the whole Stripe loop — unbounded in the number of bookings,
 * two round trips each. An account with enough of them outruns svix's delivery
 * timeout, and the redelivery then re-entered the unwind alongside the first.
 * The money survived that (`findRefund` and the per-booking idempotency key),
 * but the loser's duplicate-key failures counted into `refundsFailed` and fired
 * the "refunds stuck" alarm on a delivery where nothing was stuck — and that
 * line is the only signal a genuinely stranded booking produces.
 *
 * **What that costs, and what actually repairs it.** A process killed after the
 * retirement leaves the storefront correctly retired and some or all of its
 * bookings not unwound, and no redelivery will fix that: the event now reads as
 * already applied, so a retry returns `'ignored'` above. `pnpm reconcile:clerk`
 * does **not** reach it either — `listLiveClerkIdentities` selects on
 * `deleted_at is null`, so a retired row is never examined, and it would hit the
 * same `'ignored'` if it were. Do not claim otherwise.
 *
 * The repair is a person, and the console is what tells them: `refundStuck` in
 * `admin.dao.ts` now flags a confirmed future booking whose customer or vendor
 * account is retired, exactly as it flags one on a banned account, so
 * `/admin/bookings?flag=refund-stuck` lists every booking this window strands.
 * That surface is the reason the ordering is safe to flip; without it the
 * stranded rows would be invisible and the flip would be a bad trade.
 *
 * The money-before-row ordering that `unwindAccountBookings` argues for is a
 * different ordering and is untouched: it is about the **booking** row, inside
 * the loop.
 */
async function applyUserDeleted(
  context: AdminContext,
  authUserId: string,
  now: Date,
): Promise<ClerkWebhookOutcome> {
  const target = await findUserByAuthId(context.db, authUserId);

  if (!target) {
    return 'ignored';
  }

  const profile = await findVendorProfileByUserId(context.db, target.id);
  const retired = await retireUserByAuthId(context.db, authUserId);

  if (!retired) {
    // Another delivery of this event took the claim first.
    return 'ignored';
  }

  const unwound = await unwindAccountBookings(
    context,
    target.id,
    profile?.id ?? null,
    now,
    DELETION_UNWIND,
  );

  /*
   * The same signal a ban surfaces in its response (#400), which a webhook has
   * no response to put it in. A stuck refund leaves a **confirmed** booking on
   * an account nobody can reach, and only a human can finish it — so it is
   * logged at error rather than counted into a body Clerk discards.
   *
   * `bookingsLeftForReview` is the deliberate half of the same problem: a
   * booking the closed account had paid for, which this path refuses to price.
   * Both need a person, so both raise the line.
   */
  if (unwound.refundsFailed > 0 || unwound.bookingsLeftForReview > 0) {
    context.log.error(
      { userId: target.id, ...unwound },
      'An account deletion left bookings confirmed; they need an operator',
    );
  } else {
    context.log.info({ userId: target.id, ...unwound }, 'Unwound a deleted account');
  }

  return 'deleted';
}
