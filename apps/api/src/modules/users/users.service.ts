import {
  USER_ROLES,
  type UpdateUserInput,
  type User,
  type UserRole,
} from '@vendor-marketplace/shared';
import type { NewUserRow, UserRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { notFound } from '../../lib/errors.js';
import {
  findUserByClerkId,
  findUserById,
  insertUserIfAbsent,
  updateUserById,
} from './users.dao.js';

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
 * Creates the local row for a Clerk identity if it is not there yet. Both the
 * `user.created` webhook and the user's own first authenticated request land
 * here, so the insert tolerates the loser of that race.
 */
export async function syncUserFromClerk(
  db: AppDatabase,
  snapshot: ClerkUserSnapshot,
): Promise<UserRow | null> {
  const values: NewUserRow = {
    clerkUserId: snapshot.clerkUserId,
    email: snapshot.email,
    role: normalizeRole(snapshot.roleHint),
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    avatarUrl: snapshot.avatarUrl,
  };

  return insertUserIfAbsent(db, values);
}

/**
 * Resolves a verified Clerk subject to a local user, lazily creating the row
 * when the webhook has not landed yet. `loadSnapshot` is only called on that
 * cold path, so the common case stays a single indexed lookup.
 */
export async function resolveUserByClerkId(
  db: AppDatabase,
  clerkUserId: string,
  loadSnapshot: () => Promise<ClerkUserSnapshot>,
): Promise<UserRow | null> {
  const existing = await findUserByClerkId(db, clerkUserId);
  if (existing) {
    return existing;
  }

  const snapshot = await loadSnapshot();
  return syncUserFromClerk(db, snapshot);
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
  const row = await updateUserById(db, userId, input);
  if (!row) {
    throw notFound('User not found');
  }

  return toUser(row);
}
