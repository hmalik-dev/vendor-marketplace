import type { UserRow } from '@vendor-marketplace/db/schema';
import { unwindFloorDate } from '@vendor-marketplace/shared';
import {
  DELETION_UNWIND,
  unwindAccountBookings,
  type AdminContext,
} from '../admin/account-unwind.js';
import { findConfirmedBookingsToUnwind, findVendorProfileByUserId } from '../admin/admin.dao.js';
import {
  findLiveUserByEmail,
  findUserByAuthId,
  retireUserByAuthId,
  updateUserByAuthId,
} from '../users/users.dao.js';
import { mirroredAuthName } from '../users/users.service.js';
import {
  isProviderAvatar,
  isUnbackedIdentity,
  mirroredIdentity,
  providerAvatarUrl,
  type AuthIdentitySource,
  type MirroredIdentity,
} from './identity.js';

export type AuthSyncEvent =
  { type: 'updated'; identity: MirroredIdentity } | { type: 'deleted'; authUserId: string };

export type AuthSyncOutcome =
  | 'updated'
  | 'deleted'
  | 'ignored'
  /**
   * Applied, but the address could not be written because another row holds it
   * (#462). Distinct from `updated` because `pnpm reconcile:auth` counts these
   * and would otherwise report a row it did not repair as corrected — on every
   * run, since the row stays drifted.
   */
  | 'diverged';

/**
 * Applies one change to an auth identity onto its local row.
 *
 * Neon Auth sends no `user.updated` or `user.deleted` (VEN-444, q4), so there
 * is no webhook: the reconcile pass reads the identities and hands each
 * difference here, and the row is **created** only by the acceptance gate. It
 * is idempotent all the same — the pass is re-runnable and two admins may
 * run it at once — and an event for an unknown user is a no-op, not an error.
 *
 * It takes the full `AdminContext` rather than a database handle because a
 * deletion moves money (#433): it unwinds the account's bookings on exactly the
 * code path a ban does, and that path needs Stripe, the event hub and the
 * mailer.
 */
export async function applyAuthSyncEvent(
  context: AdminContext,
  event: AuthSyncEvent,
  now: Date,
  /** Asked who really holds an address an update collided on. */
  identities: AuthIdentitySource,
): Promise<AuthSyncOutcome> {
  if (event.type === 'deleted') {
    return applyUserDeleted(context, event.authUserId, now);
  }

  const db = context.db;
  const { identity } = event;
  const authUserId = identity.authUserId;

  // Role is fixed at first acceptance; only contact details are mirrored onward.
  const current = await findUserByAuthId(db, authUserId);

  if (!current) {
    return 'ignored';
  }

  /*
   * Every field is written only when the identity has something to say, and the
   * names go through `mirroredAuthName`: this patch does not pass through
   * `syncUserFromAuth`, so a bidi control stripped at sign-up would come
   * straight back the next time the account holder edited their profile
   * (#398).
   *
   * **The avatar is the one that can do harm.** An identity with no image
   * carries no opinion, and an upload is never overwritten by the provider's
   * picture (VEN-427): a row whose avatar is an object key or a site path
   * belongs to its holder, so only an absent or provider-hosted one is mirrored.
   */
  const avatarUrl = providerAvatarUrl(identity.avatarUrl);
  const patch = {
    ...(identity.email === null ? {} : { email: identity.email }),
    ...(identity.firstName === null ? {} : { firstName: mirroredAuthName(identity.firstName) }),
    ...(identity.lastName === null ? {} : { lastName: mirroredAuthName(identity.lastName) }),
    ...(avatarUrl === null || !isProviderAvatar(current.avatarUrl) ? {} : { avatarUrl }),
  };

  let mirrored = await updateUserByAuthId(db, authUserId, patch);

  /*
   * A collision means the holder is the stale row — Neon Auth gives an address
   * to one identity — so ask it about the holder and retry once if that
   * released the address (VEN-386).
   */
  if (
    mirrored?.emailDiverged &&
    identity.email !== null &&
    (await releaseStaleHolder(context, identities, mirrored.user, identity.email, now))
  ) {
    mirrored = await updateUserByAuthId(db, authUserId, patch);
  }

  if (!mirrored) {
    return 'ignored';
  }

  /*
   * The address the identity holds belongs to another row, so it was recorded
   * as pending rather than written (#462). The pass still **succeeds**: the
   * collision is a fact about a different row and will be as true on the next
   * run.
   *
   * `email_sync_failed_at` and `pending_email` are what an admin acts on —
   * `/admin/customers?flag=email-stale` lists them — and this line is the same
   * class of report as the stranded-refund line below: something went wrong
   * after a committed operation, and only a person can finish it.
   */
  if (mirrored.emailDiverged) {
    context.log.error(
      { userId: mirrored.user.id, authUserId },
      'Neon Auth holds an address another account already holds; users.email is now stale',
    );

    return 'diverged';
  }

  return 'updated';
}

/**
 * Frees an address a live row holds but Neon Auth no longer gives it, and
 * answers whether the claimant's write is now worth retrying (VEN-386).
 *
 * The holder is stale by construction — a deletion nobody synced, or an update
 * moving it off the address still unsynced — so Neon Auth is the arbiter:
 *
 * - **Gone from Neon Auth** → the deletion that was never synced, through the
 *   same `applyUserDeleted` a reconcile pass takes. Retiring the row alone
 *   would leave its bookings for an account nobody can answer.
 * - **Moved in Neon Auth** → its address is mirrored, which releases this one.
 *   Exactly one hop: if that address collides too the holder records its own
 *   divergence and the chain stops here, rather than walking accounts.
 * - **Still the owner**, or **Neon Auth unreachable** → nothing to do; the
 *   claimant stays `diverged`.
 *
 * A holder Neon Auth never issued (a seeded account) is never asked about: it
 * would answer "no such user", and reading that as a deletion retires the demo
 * marketplace.
 */
async function releaseStaleHolder(
  context: AdminContext,
  identities: AuthIdentitySource,
  claimant: UserRow,
  email: string,
  now: Date,
): Promise<boolean> {
  const { id: claimantId, authUserId: claimantAuthUserId } = claimant;
  const holder = await findLiveUserByEmail(context.db, email);

  if (!holder) {
    // Released between the collision and this read.
    return true;
  }

  if (holder.id === claimantId || isUnbackedIdentity(holder.authProvider)) {
    return false;
  }

  let remote: MirroredIdentity | undefined;
  try {
    /*
     * The claimant is asked about too, as a control: it is being synced, so it
     * exists. If Neon Auth does not know it either, this API is reading a
     * different branch's identities — and reading every holder as deleted would
     * retire live accounts and refund their bookings.
     */
    const found = await identities.lookup([holder.authUserId, claimantAuthUserId]);

    if (!found.some((identity) => identity.id === claimantAuthUserId)) {
      throw new Error('Neon Auth does not know the identity being synced');
    }

    const holderIdentity = found.find((identity) => identity.id === holder.authUserId);
    remote = holderIdentity === undefined ? undefined : mirroredIdentity(holderIdentity);
  } catch (error) {
    context.log.error(
      { userId: claimantId, holderId: holder.id, err: error },
      'Could not ask Neon Auth who holds a contested address; the account stays diverged',
    );

    return false;
  }

  if (!remote) {
    let outcome: RetireIfGoneOutcome;
    try {
      outcome = await retireIfConfirmedGone(context, identities, holder.authUserId, now, {
        control: claimantAuthUserId,
      });
    } catch (error) {
      context.log.error(
        { userId: claimantId, holderId: holder.id, err: error },
        'Could not confirm with Neon Auth that a contested address is held by a deleted account; the account stays diverged',
      );

      return false;
    }

    // Retired now, or already gone; anything else is a holder left standing.
    return outcome === 'deleted' || outcome === 'ignored';
  }

  if (remote.email === null || remote.email === email) {
    return false;
  }

  const corrected = await updateUserByAuthId(context.db, holder.authUserId, {
    email: remote.email,
  });

  return corrected !== null && !corrected.emailDiverged;
}

export type RetireIfGoneOutcome =
  /** Confirmed gone and retired through the deletion unwind. */
  | 'deleted'
  /** Confirmed gone, but holding confirmed bookings: an admin was alerted, nothing was closed. */
  | 'flagged'
  /** The confirming lookup found the identity: the first answer was short, not a deletion. */
  | 'present'
  /** No live local row, or another delivery took the claim first. */
  | 'ignored';

/**
 * Closes an account on a **positive** not-found, and never on a short answer
 * (VEN-480).
 *
 * The caller's first lookup did not return the id. That is evidence, not proof:
 * the lookup is a plain read of Neon's `neon_auth` schema, and retiring a
 * vendor refunds their future bookings, which cannot be taken back. So the
 * identity is asked for once more, alone, and only an id absent from **both**
 * answers is read as deleted. The `control` identity, when given, is a row known
 * to exist; if the second answer lacks it too the source is not to be trusted
 * and this throws rather than guess.
 *
 * An account with future confirmed bookings is never closed here, even when
 * confirmed gone. Those refunds are money moving on the strength of an
 * automatic read, so the admin is told and closes it through the console,
 * which runs the same `applyUserDeleted` unwind.
 */
export async function retireIfConfirmedGone(
  context: AdminContext,
  identities: AuthIdentitySource,
  authUserId: string,
  now: Date,
  options: { control?: string; dryRun?: boolean } = {},
): Promise<RetireIfGoneOutcome> {
  const target = await findUserByAuthId(context.db, authUserId);

  if (!target || target.deletedAt !== null) {
    return 'ignored';
  }

  const confirming = await identities.lookup(
    options.control === undefined ? [authUserId] : [authUserId, options.control],
  );

  if (options.control !== undefined && !confirming.some((found) => found.id === options.control)) {
    throw new Error('Neon Auth does not know the identity being synced');
  }

  if (confirming.some((found) => found.id === authUserId)) {
    return 'present';
  }

  const profile = await findVendorProfileByUserId(context.db, target.id);
  /*
   * The vendor side only. A booking the deleted account paid for as a customer
   * is left standing by the unwind (D39) and moves no money, so retiring the row
   * is safe; and the console's closure refuses to run over it, which would leave
   * a flag nobody could clear.
   */
  const stranded = profile
    ? (
        await findConfirmedBookingsToUnwind(context.db, target.id, profile.id, unwindFloorDate(now))
      ).filter((booking) => booking.vendorId === profile.id)
    : [];

  if (stranded.length > 0) {
    if (!options.dryRun) {
      context.log.error(
        { userId: target.id, confirmedBookings: stranded.length },
        'Neon Auth no longer has an account that holds confirmed bookings; an admin must close it',
      );
      context.alerts?.dispatch({
        kind: 'auth_identity_deleted',
        subjectId: target.id,
        summary: `An account deleted in Neon Auth holds ${stranded.length} confirmed booking(s)`,
        details: [
          `User ${target.id} no longer exists in Neon Auth, confirmed by two lookups.`,
          `Confirmed future bookings: ${stranded.length}. Nothing was closed or refunded automatically.`,
          'Close the account from the console to cancel and refund them.',
        ],
        adminPath: `/admin/users/${target.id}`,
      });
    }

    return 'flagged';
  }

  if (options.dryRun) {
    return 'deleted';
  }

  return (await applyUserDeleted(context, authUserId, now)) === 'deleted' ? 'deleted' : 'ignored';
}

/**
 * A Neon Auth identity is gone, so the marketplace has to stop pointing at it.
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
 * two round trips each. An account with enough of them outruns a caller's own
 * timeout, and the redelivery then re-entered the unwind alongside the first.
 * The money survived that (`findRefund` and the per-booking idempotency key),
 * but the loser's duplicate-key failures counted into `refundsFailed` and fired
 * the "refunds stuck" alarm on a delivery where nothing was stuck — and that
 * line is the only signal a genuinely stranded booking produces.
 *
 * **What that costs, and what actually repairs it.** A process killed after the
 * retirement leaves the storefront correctly retired and some or all of its
 * bookings not unwound, and no redelivery will fix that: the event now reads as
 * already applied, so a retry returns `'ignored'` above. `pnpm reconcile:auth`
 * does **not** reach it either — `listLiveAuthIdentities` selects on
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
): Promise<AuthSyncOutcome> {
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
   * logged at error rather than counted into a summary nobody reads.
   *
   * `bookingsLeftForReview` is the deliberate half of the same problem: a
   * booking the closed account had paid for, which this path refuses to price.
   * Both need a person, so both raise the line.
   */
  if (unwound.refundsFailed > 0 || unwound.bookingsLeftForReview > 0) {
    context.log.error(
      { userId: target.id, ...unwound },
      'An account deletion left bookings confirmed; they need an admin',
    );
  } else {
    context.log.info({ userId: target.id, ...unwound }, 'Unwound a deleted account');
  }

  return 'deleted';
}
