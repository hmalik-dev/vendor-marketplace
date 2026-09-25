import { and, eq, gt, lte } from 'drizzle-orm';
import { signUpRoles } from '@vendor-marketplace/db/schema';
import type { SignUpRole } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/** Matches the verification code and sign-in window; a choice older than this is stale. */
export const SIGN_UP_ROLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Records the role chosen at sign-up for one provider identity (VEN-662).
 *
 * **First write wins.** A retry, a replay or a crafted second call for the same
 * id is a no-op, so nothing can flip a choice once it is made. Expired rows are
 * dropped on the way in, which is the only cleanup the table gets.
 */
export async function recordSignUpRole(
  db: AppDatabase,
  authUserId: string,
  role: SignUpRole,
  now: Date = new Date(),
): Promise<void> {
  await db.delete(signUpRoles).where(lte(signUpRoles.expiresAt, now));

  await db
    .insert(signUpRoles)
    .values({ authUserId, role, expiresAt: new Date(now.getTime() + SIGN_UP_ROLE_TTL_MS) })
    .onConflictDoNothing({ target: signUpRoles.authUserId });
}

/** The unexpired role recorded for exactly this identity, or `null`. */
export async function findSignUpRole(
  db: AppDatabase,
  authUserId: string,
  now: Date = new Date(),
): Promise<SignUpRole | null> {
  const [row] = await db
    .select({ role: signUpRoles.role })
    .from(signUpRoles)
    .where(and(eq(signUpRoles.authUserId, authUserId), gt(signUpRoles.expiresAt, now)));

  return row?.role === 'customer' || row?.role === 'vendor' ? row.role : null;
}

/**
 * Spent once the account row exists (the role now lives on `users.role`), and
 * forgotten when the identity's password is reset (VEN-663).
 */
export async function deleteSignUpRole(db: AppDatabase, authUserId: string): Promise<void> {
  await db.delete(signUpRoles).where(eq(signUpRoles.authUserId, authUserId));
}
