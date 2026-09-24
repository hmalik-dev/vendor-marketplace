import {
  SIGN_UP_ROLES,
  stripBidiControls,
  stripRefusedText,
  type UpdateUserInput,
  type User,
  type SignUpRole,
} from '@vendor-marketplace/shared';
import type { NewUserRow, UserRow } from '@vendor-marketplace/db/schema';
import type { NeonAuthDirectory } from '@vendor-marketplace/db';
import type { AppDatabase } from '../../lib/database.js';
import { accountSuspended, notFound, unauthorized, validationFailed } from '../../lib/errors.js';
import { assertOwnedImageRefs, storedImageRef } from '../../lib/storage.js';
import { findUserById, insertUserIfAbsent, updateUserById } from './users.dao.js';

/** The subset of an auth identity the local `users` row mirrors. */
export interface AuthUserSnapshot {
  authUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  /**
   * The role the person confirmed on the acceptance screen. Left unnarrowed on
   * purpose: the caller writes this field, so `normalizeRole` validates it at
   * the single point where it is persisted rather than trusting each caller.
   */
  roleHint: unknown;
  avatarUrl: string | null;
}

/** `avg_customer_rating` is a Postgres NUMERIC, surfaced as a string by the driver. */
function parseRating(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toUser(row: UserRow): User {
  return { ...row, avgCustomerRating: parseRating(row.avgCustomerRating) };
}

/**
 * The role a new row is written with: exactly `customer` or `vendor`, as the
 * person confirmed it on the acceptance screen. It is trusted only for the
 * initial row creation and is immutable afterwards; every later authorization
 * decision reads the local column.
 *
 * **Anything else is refused, never narrowed.** `admin` is granted by an
 * admin and nothing else, and a missing or unrecognised value used to become
 * `customer` here, which fixed a vendor on the wrong side for good (VEN-507).
 */
export function normalizeRole(value: unknown): SignUpRole {
  const role = SIGN_UP_ROLES.find((candidate) => candidate === value);

  if (!role) {
    throw validationFailed('Choose whether you are joining as a customer or a vendor.');
  }

  return role;
}

/**
 * A name as the auth provider holds it, made safe to render.
 *
 * The auth provider owns this field and the account holder types it, so it is untrusted
 * free text arriving on a path that never sees a request-body schema — which is
 * how it escaped #398's first pass. It reaches the **public** vendor page
 * through `reviewerName`, and both parties' inboxes through `otherPartyName`,
 * so a `RIGHT-TO-LEFT OVERRIDE` in a first name reorders the sentence around it
 * for strangers, which is the exact effect that ticket exists to stop.
 *
 * Normalised here for the same reason `normalizeRole` is: the value is
 * persisted through this module, and doing it at the point of persistence
 * cannot be forgotten by a caller the way doing it per read can.
 */
export function mirroredAuthName(value: string): string {
  return stripRefusedText(stripBidiControls(value)).normalize('NFC').trim();
}

/**
 * An address as `users.email` stores it: trimmed and lowercased (VEN-649).
 *
 * The unique index is on `lower(email)` and a CHECK refuses anything else, so
 * every writer goes through this — a mixed-case address from the provider
 * would otherwise fail the insert rather than be one person's one account.
 */
export function mirroredAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** First and last name out of Better Auth's single `name` field. */
export function splitAuthName(name: string): { firstName: string; lastName: string } {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') };
}

/**
 * An auth identity as the local row records it — normalised, and stated once,
 * so `normalizeRole` and `mirroredAuthName` cannot be forgotten by a caller.
 */
function toNewUserRow(snapshot: AuthUserSnapshot): NewUserRow {
  return {
    authUserId: snapshot.authUserId,
    email: mirroredAuthEmail(snapshot.email),
    role: normalizeRole(snapshot.roleHint),
    firstName: mirroredAuthName(snapshot.firstName),
    lastName: mirroredAuthName(snapshot.lastName),
    avatarUrl: snapshot.avatarUrl,
  };
}

/**
 * How a person's name is frozen onto a record that can never be edited.
 *
 * The email is the fallback because an auth account can genuinely have no name,
 * and a blank in `legal_acceptances.accepted_by_name` would say nobody
 * accepted. Stated once because three writers freeze it — the Terms gate, the
 * vendor agreement and the E2E fixture — onto rows the database refuses to
 * update, so two spellings would be two versions of who a person is with no
 * test able to notice.
 */
export function displayName(user: Pick<UserRow, 'firstName' | 'lastName' | 'email'>): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

/**
 * Creates the local row for an auth identity if it is not there yet. Both the
 * `user.created` webhook and the acceptance gate land here, so the insert
 * tolerates the loser of that race — and it accepts a transaction, which is how
 * the gate writes the account and its acceptance as one act.
 *
 * **A row this writes is not yet a usable account.** Since #429 the gate reads
 * `legal_acceptances`, not this table, so a webhook-created row with no
 * acceptance is held at the interstitial exactly like an account that has none.
 */
export async function syncUserFromAuth(
  db: AppDatabase,
  snapshot: AuthUserSnapshot,
): Promise<UserRow | null> {
  return insertUserIfAbsent(db, toNewUserRow(snapshot));
}

/**
 * Re-checks an account that a stream ticket named, and returns who to serve.
 *
 * The event stream cannot use `requireAuth` — its whole point is that no
 * session token travels in its URL — so the admission decision `requireAuth`
 * would have made has to be made somewhere, and it belongs here rather than in
 * the route: routes declare schemas and guards, services hold the rules.
 *
 * It is re-checked rather than trusted from the ticket because a ban landing
 * between issue and connect would otherwise be ignored, and a stream, once
 * open, stays open. The same goes for a session generation bump (VEN-670): a
 * stream passes the `openedAt` it was admitted at, and one older than the
 * account's `sessionsInvalidatedAt` is refused, so a ticket spent in the gap
 * between the bump and the hub closing that user's streams does not outlive it.
 */
export async function resolveStreamSubject(
  db: AppDatabase,
  userId: string,
  openedAt?: Date,
): Promise<{ id: string }> {
  const account = await findUserById(db, userId);

  if (!account) {
    throw unauthorized('No account is linked to this stream ticket');
  }

  if (account.isBanned) {
    throw accountSuspended();
  }

  if (openedAt && account.sessionsInvalidatedAt && account.sessionsInvalidatedAt > openedAt) {
    throw unauthorized('This stream was opened before the sessions of this account were ended');
  }

  return { id: account.id };
}

export async function getUserProfile(db: AppDatabase, userId: string): Promise<User> {
  const row = await findUserById(db, userId);
  if (!row) {
    throw notFound('User not found');
  }

  return toUser(row);
}

/**
 * Writes a real name onto the Neon Auth identity itself, wherever
 * `users.firstName`/`lastName` are written from something other than the
 * identity's own name (VEN-642) — the customer-details step and the vendor
 * profile editor. Without this the scheduled reconcile
 * (`auth-sync.reconcile.ts`) reads the sign-up form's unchanged synthetic
 * email-prefix placeholder back off the identity and mirrors it onto `users`
 * the next time it runs, silently reverting a name the account holder just
 * gave.
 *
 * Best-effort: `directory` is `null` on a lane (no `NEON_AUTH_DATABASE_URL`),
 * and a transient failure here must not undo a `users` write that already
 * committed — the next successful call catches it up, since a real name never
 * changes back to the placeholder on its own.
 */
export async function syncAuthDisplayName(
  directory: NeonAuthDirectory | null,
  authUserId: string,
  firstName: string,
  lastName: string,
  log?: { warn: (details: unknown, message: string) => void },
): Promise<void> {
  if (!directory) {
    return;
  }

  try {
    await directory.updateName(authUserId, `${firstName} ${lastName}`.trim());
  } catch (error) {
    log?.warn(
      { err: error, authUserId },
      'Could not sync the display name onto the Neon Auth identity',
    );
  }
}

/**
 * Applies a self-service profile edit. Identity, role, ban, and derived
 * counters are absent from `updateUserSchema`, so they cannot be reached here.
 */
export async function updateUserProfile(
  db: AppDatabase,
  userId: string,
  input: UpdateUserInput,
  publicBaseUrl: string,
  authSync?: {
    authUserId: string;
    directory: NeonAuthDirectory | null;
    log?: { warn: (details: unknown, message: string) => void };
  },
): Promise<User> {
  assertOwnedImageRefs([input.avatarUrl], userId);

  /*
   * The schema compares the pair only when both keys arrive; a partial edit is
   * held against the stored other half (VEN-544).
   */
  if (input.typicalGuestCountMin !== undefined || input.typicalGuestCountMax !== undefined) {
    const current = await findUserById(db, userId);
    const min =
      input.typicalGuestCountMin !== undefined
        ? input.typicalGuestCountMin
        : (current?.typicalGuestCountMin ?? null);
    const max =
      input.typicalGuestCountMax !== undefined
        ? input.typicalGuestCountMax
        : (current?.typicalGuestCountMax ?? null);

    if (min !== null && max !== null && min > max) {
      throw validationFailed('Minimum guest count must not exceed maximum guest count');
    }
  }

  // Stored as a key, so it follows `STORAGE_PUBLIC_URL` and is never read as a
  // provider avatar the next sign-in would overwrite (VEN-648).
  const row = await updateUserById(
    db,
    userId,
    input.avatarUrl === undefined
      ? input
      : { ...input, avatarUrl: storedImageRef(input.avatarUrl, publicBaseUrl) },
  );
  if (!row) {
    throw notFound('User not found');
  }

  if (authSync && input.firstName !== undefined && input.lastName !== undefined) {
    await syncAuthDisplayName(
      authSync.directory,
      authSync.authUserId,
      input.firstName,
      input.lastName,
      authSync.log,
    );
  }

  return toUser(row);
}
