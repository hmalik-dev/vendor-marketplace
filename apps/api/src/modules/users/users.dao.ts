import { and, eq, isNull, sql } from 'drizzle-orm';
import { users, type NewUserRow, type UserRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

/** Live users only — a Clerk-deleted identity must not resolve to a session. */
const notDeleted = isNull(users.deletedAt);

export async function findUserByClerkId(
  db: AppDatabase,
  clerkUserId: string,
): Promise<UserRow | null> {
  if (!clerkUserId) {
    return null;
  }

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.clerkUserId, clerkUserId), notDeleted))
    .limit(1);

  return rows?.[0] ?? null;
}

export async function findUserById(db: AppDatabase, id: string): Promise<UserRow | null> {
  if (!id) {
    return null;
  }

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), notDeleted))
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Inserts a user, tolerating the race between the Clerk webhook and the user's
 * own first API call. Returns the winning row either way.
 */
export async function insertUserIfAbsent(
  db: AppDatabase,
  values: NewUserRow,
): Promise<UserRow | null> {
  const inserted = await db
    .insert(users)
    .values(values)
    .onConflictDoNothing({ target: users.clerkUserId })
    .returning();

  return inserted?.[0] ?? (await findUserByClerkId(db, values.clerkUserId));
}

export async function updateUserById(
  db: AppDatabase,
  id: string,
  patch: Partial<NewUserRow>,
): Promise<UserRow | null> {
  if (!id || Object.keys(patch).length === 0) {
    return null;
  }

  const updated = await db
    .update(users)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(users.id, id), notDeleted))
    .returning();

  return updated?.[0] ?? null;
}

/** Mirrors a Clerk `user.updated` event onto the local row, if one exists. */
export async function updateUserByClerkId(
  db: AppDatabase,
  clerkUserId: string,
  patch: Partial<NewUserRow>,
): Promise<UserRow | null> {
  if (!clerkUserId || Object.keys(patch).length === 0) {
    return null;
  }

  const updated = await db
    .update(users)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(users.clerkUserId, clerkUserId), notDeleted))
    .returning();

  return updated?.[0] ?? null;
}

/**
 * Retires the local row for a deleted Clerk identity. Bookings, reviews, and
 * messages reference this user, so the row stays for referential integrity.
 */
export async function softDeleteUserByClerkId(
  db: AppDatabase,
  clerkUserId: string,
): Promise<UserRow | null> {
  if (!clerkUserId) {
    return null;
  }

  const updated = await db
    .update(users)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(users.clerkUserId, clerkUserId), notDeleted))
    .returning();

  return updated?.[0] ?? null;
}
