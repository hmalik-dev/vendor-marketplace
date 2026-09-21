import type { NeonAuthIdentity } from '@vendor-marketplace/db';
import type { AuthProvider } from '@vendor-marketplace/shared';
import type { AdminContext } from '../admin/account-unwind.js';
import { listLiveAuthIdentities } from '../users/users.dao.js';
import { applyAuthSyncEvent, retireIfConfirmedGone } from './auth-sync.service.js';
import {
  isProviderAvatar,
  isUnbackedIdentity,
  mirroredIdentity,
  type AuthIdentitySource,
  type MirroredIdentity,
} from './identity.js';

/**
 * Brings every live local row into agreement with Neon Auth.
 *
 * This is the whole of the sync. Neon Auth fires `user.created` only (VEN-444,
 * q4) — no update, no delete — so a change of name, address or avatar, and a
 * deleted identity, reach the local row here and nowhere else. The row itself
 * is created by the Terms acceptance gate. Written to be re-runnable: a run
 * when nothing has drifted writes nothing at all.
 */

export interface ReconcileSummary {
  /** Rows examined — every live local row Neon Auth issued the identity for. */
  examined: number;
  /** Rows whose name, email, or avatar disagreed with Neon Auth and were corrected. */
  updated: number;
  /** Rows whose identity no longer exists, retired exactly as a deletion is. */
  deleted: number;
  /**
   * Rows whose identity is confirmed gone but which hold confirmed bookings
   * (VEN-480). Not closed: the operator was alerted and closes them.
   */
  flagged: number;
  /** Rows already agreeing with Neon Auth. On a second run this is all of them. */
  unchanged: number;
  /**
   * Rows this pass could **not** repair: the identity's address is held by
   * another account, so `users.email` still disagrees (#462).
   *
   * Counted apart from `updated` because it is the opposite of a correction,
   * and apart from `unchanged` because something did change — the divergence is
   * now recorded on the row and listed at `/admin/customers?flag=email-stale`.
   */
  diverged: number;
  /** Rows Neon Auth never issued — seeded demo accounts and legacy-provider ids — left untouched. */
  skipped: number;
}

/**
 * The identity source could not be trusted, so nothing was written.
 *
 * Thrown before the first write, because a pass that retires on the strength of
 * an empty answer is a pass that has confused "the source is down, pointed at
 * the wrong branch or has lost its rows" with "every user deleted their
 * account" — and the retirement it would then perform refunds bookings.
 */
export class IdentitySourceUntrustworthyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentitySourceUntrustworthyError';
  }
}

const BATCH_SIZE = 100;

interface LocalRow {
  authUserId: string;
  authProvider: AuthProvider;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  pendingEmail: string | null;
}

/**
 * Whether applying the identity would change the row.
 *
 * Compared before writing, rather than writing unconditionally and calling it
 * idempotent: a blind update touches `updated_at` on every row on every run,
 * and it is the count of these that the idempotency assertion rests on. Each
 * clause mirrors what `applyAuthSyncEvent` would put in its patch — a `null`
 * field is no opinion there, so it must not read as drift here, or the run
 * would report a correction the write never makes and report it again next time.
 */
function drifted(row: LocalRow, identity: MirroredIdentity): boolean {
  return (
    (identity.email !== null && identity.email !== row.email) ||
    // Settled back onto the row's own address: the earlier attempt's record is stale (VEN-431).
    (identity.email !== null && identity.email === row.email && row.pendingEmail !== null) ||
    (identity.firstName !== null && identity.firstName !== row.firstName) ||
    (identity.lastName !== null && identity.lastName !== row.lastName) ||
    // An upload is the holder's, and an identity with no image says nothing (VEN-427).
    (identity.avatarUrl !== null &&
      isProviderAvatar(row.avatarUrl) &&
      identity.avatarUrl !== row.avatarUrl)
  );
}

export async function reconcileAuthUsers(
  /**
   * The context a deletion needs (#433): this pass hands a missing identity to
   * the very handler that refunds bookings, and taking less than that handler
   * needs is how a repair path comes to behave differently from the live one.
   */
  context: AdminContext,
  identities: AuthIdentitySource,
  /**
   * Reports what would change without writing anything — "how many rows would
   * this retire?" is worth being able to answer before the answer is
   * irreversible.
   */
  options: { dryRun?: boolean } = {},
  /** One instant for the whole pass, so two "now"s cannot disagree about a refund. */
  now: Date = new Date(),
): Promise<ReconcileSummary> {
  const rows = await listLiveAuthIdentities(context.db);
  const local = rows.filter((row) => !isUnbackedIdentity(row.authProvider));
  const summary: ReconcileSummary = {
    examined: local.length,
    updated: 0,
    deleted: 0,
    flagged: 0,
    unchanged: 0,
    diverged: 0,
    skipped: rows.length - local.length,
  };

  if (local.length === 0) {
    return summary;
  }

  /*
   * **Every lookup completes before any write.** A source that errors part-way
   * therefore aborts with the database untouched, rather than after some rows
   * were retired on a half-read answer.
   */
  const remote = new Map<string, NeonAuthIdentity>();

  for (let index = 0; index < local.length; index += BATCH_SIZE) {
    const batch = local.slice(index, index + BATCH_SIZE);

    for (const identity of await identities.lookup(batch.map((row) => row.authUserId))) {
      remote.set(identity.id, identity);
    }
  }

  /*
   * An empty answer for a table of several accounts is never "everyone left": a
   * real marketplace does not lose all its accounts between two runs, and a
   * source pointed at the wrong branch answers exactly this way. A table of one
   * has no such tell — the lone account deleting its identity is the ordinary
   * case, and refusing it would strand that account for ever — so the guard
   * needs at least two rows to disagree with.
   */
  if (remote.size === 0 && local.length > 1) {
    throw new IdentitySourceUntrustworthyError(
      `Neon Auth knows none of the ${local.length} identities this database holds. ` +
        'Nothing was retired. Check NEON_AUTH_DATABASE_URL points at the branch these users live on.',
    );
  }

  const control = remote.keys().next().value;

  for (const row of local) {
    const found = remote.get(row.authUserId);

    if (!found) {
      /*
       * One lookup that came back short is not a deletion (VEN-480): the row is
       * asked about again on its own, and closed only if that agrees.
       */
      const outcome = await retireIfConfirmedGone(context, identities, row.authUserId, now, {
        // Any identity proven present a moment ago: if the second answer lacks it, the source is not to be trusted.
        ...(control === undefined ? {} : { control }),
        ...(options.dryRun === undefined ? {} : { dryRun: options.dryRun }),
      });

      if (outcome === 'deleted') {
        summary.deleted += 1;
      } else if (outcome === 'flagged') {
        summary.flagged += 1;
      } else {
        summary.unchanged += 1;
      }
      continue;
    }

    const identity = mirroredIdentity(found);

    if (!drifted(row, identity)) {
      summary.unchanged += 1;
      continue;
    }

    if (options.dryRun) {
      summary.updated += 1;
      continue;
    }

    const outcome = await applyAuthSyncEvent(
      context,
      { type: 'updated', identity },
      now,
      identities,
    );

    if (outcome === 'updated') {
      summary.updated += 1;
    } else if (outcome === 'diverged') {
      summary.diverged += 1;
    } else {
      summary.unchanged += 1;
    }
  }

  return summary;
}
