import {
  USER_ROLES,
  stripBidiControls,
  type UpdateUserInput,
  type User,
  type UserRole,
} from '@vendor-marketplace/shared';
import type { NewUserRow, UserRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { assertOwnedImageRefs } from '../../lib/storage.js';
import { findUserById, insertUserIfAbsent, updateUserById } from './users.dao.js';

/** The subset of a Clerk identity the local `users` row mirrors. */
export interface ClerkUserSnapshot {
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  /**
   * Raw `unsafeMetadata.role` as Clerk reports it. Left unnarrowed on purpose:
   * the account holder can write this field, so it is normalized at the single
   * point where it is persisted rather than trusted by each caller.
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
 * Role is chosen at sign-up and lives in Clerk's `unsafeMetadata`, which the
 * user can technically write. It is trusted only for the initial row creation
 * and is immutable afterwards; every later authorization decision reads the
 * local column. Anything unrecognised falls back to the least-privileged role.
 */
export function normalizeRole(value: unknown): UserRole {
  return USER_ROLES.includes(value as UserRole) && value !== 'admin'
    ? (value as UserRole)
    : 'customer';
}

/**
 * A name as Clerk holds it, made safe to render.
 *
 * Clerk owns this field and the account holder types it, so it is untrusted
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
export function mirroredClerkName(value: string): string {
  return stripBidiControls(value).trim();
}

/**
 * A Clerk identity as the local row records it — normalised, and stated once,
 * so `normalizeRole` and `mirroredClerkName` cannot be forgotten by a caller.
 */
function toNewUserRow(snapshot: ClerkUserSnapshot): NewUserRow {
  return {
    clerkUserId: snapshot.clerkUserId,
    email: snapshot.email,
    role: normalizeRole(snapshot.roleHint),
    firstName: mirroredClerkName(snapshot.firstName),
    lastName: mirroredClerkName(snapshot.lastName),
    avatarUrl: snapshot.avatarUrl,
  };
}

/**
 * How a person's name is frozen onto a record that can never be edited.
 *
 * The email is the fallback because a Clerk account can genuinely have no name,
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
 * Creates the local row for a Clerk identity if it is not there yet. Both the
 * `user.created` webhook and the acceptance gate land here, so the insert
 * tolerates the loser of that race — and it accepts a transaction, which is how
 * the gate writes the account and its acceptance as one act.
 *
 * **A row this writes is not yet a usable account.** Since #429 the gate reads
 * `legal_acceptances`, not this table, so a webhook-created row with no
 * acceptance is held at the interstitial exactly like an account that has none.
 */
export async function syncUserFromClerk(
  db: AppDatabase,
  snapshot: ClerkUserSnapshot,
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
 * open, stays open.
 */
export async function resolveStreamSubject(
  db: AppDatabase,
  userId: string,
): Promise<{ id: string }> {
  const account = await findUserById(db, userId);

  if (!account) {
    throw unauthorized('No account is linked to this stream ticket');
  }

  if (account.isBanned) {
    throw forbidden('This account has been suspended');
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
 * Applies a self-service profile edit. Identity, role, ban, and derived
 * counters are absent from `updateUserSchema`, so they cannot be reached here.
 */
export async function updateUserProfile(
  db: AppDatabase,
  userId: string,
  input: UpdateUserInput,
): Promise<User> {
  assertOwnedImageRefs([input.avatarUrl], userId);

  const row = await updateUserById(db, userId, input);
  if (!row) {
    throw notFound('User not found');
  }

  return toUser(row);
}
