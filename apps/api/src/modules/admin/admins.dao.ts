import { adminActions, users } from '@vendor-marketplace/db/schema';
import { ADMIN_ACCESS_ACTIONS, type UserRole } from '@vendor-marketplace/shared';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AppDatabase } from '../../lib/database.js';
import { hasAnotherLiveAdmin, ADMIN_RETIREMENT_LOCK } from '../users/users.dao.js';
import { insertAdminAction } from './admin.dao.js';

/** What a grant or a revoke did, for the service to turn into a response or a refusal. */
export type AdminChange =
  | 'changed'
  | 'unchanged'
  | 'not-found'
  | 'ambiguous'
  | 'banned'
  | 'unverified'
  | 'last-admin'
  | 'no-prior-role';

/**
 * The one transaction that may change `users.role` (VEN-533's guard opens for
 * this setting and nothing else). `SET LOCAL` ends with the transaction, so it
 * cannot reach a pooled connection's next borrower.
 */
async function setRoleUnderGrant(
  tx: AppDatabase,
  userId: string,
  role: UserRole,
  now: Date,
): Promise<void> {
  await tx.execute(sql`SET LOCAL app.admin_role_grant = 'on'`);
  await tx.update(users).set({ role, updatedAt: now }).where(eq(users.id, userId));
}

/**
 * Makes the live account holding `email` an admin, and records it.
 *
 * Under the retirement lock every other admin change takes, so a grant and a
 * revoke or ban cannot each read a live set the other is about to change. The
 * role and its audit row commit together or not at all.
 *
 * Refused for a banned account, and for one whose address the auth provider
 * disagrees with (`pending_email`): the address this row holds is then not one
 * the holder has confirmed, and an admin is chosen by that address.
 */
export async function grantAdminByEmail(
  db: AppDatabase,
  actorId: string,
  email: string,
  now: Date,
): Promise<{ result: AdminChange; userId?: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(ADMIN_RETIREMENT_LOCK);

    /*
     * Two live rows can differ only by case (`users_email_key` is case
     * sensitive), so a case-insensitive match may name more than one account.
     * Picking one would hand admin access to whichever came first; refuse.
     */
    const targets = await tx
      .select({
        id: users.id,
        role: users.role,
        isBanned: users.isBanned,
        pendingEmail: users.pendingEmail,
      })
      .from(users)
      .where(and(sql`lower(${users.email}) = lower(${email})`, isNull(users.deletedAt)))
      .limit(2);

    if (targets.length > 1) {
      return { result: 'ambiguous' };
    }

    const [target] = targets;

    if (!target) {
      return { result: 'not-found' };
    }

    if (target.role === 'admin') {
      return { result: 'unchanged', userId: target.id };
    }

    if (target.isBanned) {
      return { result: 'banned', userId: target.id };
    }

    if (target.pendingEmail !== null) {
      return { result: 'unverified', userId: target.id };
    }

    await setRoleUnderGrant(tx, target.id, 'admin', now);
    await insertAdminAction(tx, {
      actorId,
      action: ADMIN_ACCESS_ACTIONS.granted,
      subjectType: 'user',
      subjectId: target.id,
      detail: { previousRole: target.role },
    });

    return { result: 'changed', userId: target.id };
  });
}

/** A recorded prior role an admin can be returned to, or `null`. */
function restorableRole(role: unknown): UserRole | null {
  return role === 'customer' || role === 'vendor' ? role : null;
}

/** The role an admin held before their latest grant, or `null` if none was recorded. */
async function priorRoleOf(tx: AppDatabase, userId: string): Promise<UserRole | null> {
  const [grant] = await tx
    .select({ detail: adminActions.detail })
    .from(adminActions)
    .where(
      and(
        eq(adminActions.subjectId, userId),
        eq(adminActions.action, ADMIN_ACCESS_ACTIONS.granted),
      ),
    )
    .orderBy(desc(adminActions.createdAt), desc(adminActions.id))
    .limit(1);

  return restorableRole(grant?.detail.previousRole);
}

/**
 * Takes admin access away, restoring the role the grant recorded.
 *
 * Refused when it would leave nobody who can sign in to the console — checked
 * under the same lock as a ban or closure (VEN-417), so the caller revoking the
 * other admin while that one revokes them cannot both commit. An account
 * that is not live (banned) is not counted, so revoking one never trips it.
 */
export async function revokeAdminById(
  db: AppDatabase,
  actorId: string,
  userId: string,
  now: Date,
): Promise<AdminChange> {
  return db.transaction(async (tx) => {
    await tx.execute(ADMIN_RETIREMENT_LOCK);

    const [target] = await tx
      .select({ role: users.role, isBanned: users.isBanned, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) {
      return 'not-found';
    }

    if (target.role !== 'admin') {
      return 'unchanged';
    }

    const live = !target.isBanned && target.deletedAt === null;

    if (live && !(await hasAnotherLiveAdmin(tx, userId))) {
      return 'last-admin';
    }

    const previousRole = await priorRoleOf(tx, userId);

    if (!previousRole) {
      return 'no-prior-role';
    }

    await setRoleUnderGrant(tx, userId, previousRole, now);
    await insertAdminAction(tx, {
      actorId,
      action: ADMIN_ACCESS_ACTIONS.revoked,
      subjectType: 'user',
      subjectId: userId,
      detail: { restoredRole: previousRole },
    });

    return 'changed';
  });
}

export interface AdminProjection {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  isBanned: boolean;
  createdAt: Date;
  grantedAt: Date | null;
  grantedByName: string | null;
  revocable: boolean;
}

/** Every admin who has not been retired, oldest first, with who granted them and when. */
export async function findAdmins(db: AppDatabase): Promise<AdminProjection[]> {
  const admins = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))
    .orderBy(users.createdAt, users.id);

  if (admins.length === 0) {
    return [];
  }

  const grants = await db
    .select({
      subjectId: adminActions.subjectId,
      actorId: adminActions.actorId,
      detail: adminActions.detail,
      createdAt: adminActions.createdAt,
    })
    .from(adminActions)
    .where(
      and(
        eq(adminActions.action, ADMIN_ACCESS_ACTIONS.granted),
        inArray(
          adminActions.subjectId,
          admins.map((admin) => admin.userId),
        ),
      ),
    )
    .orderBy(desc(adminActions.createdAt), desc(adminActions.id));
  const latest = new Map<string, (typeof grants)[number]>();

  for (const grant of grants) {
    if (!latest.has(grant.subjectId)) {
      latest.set(grant.subjectId, grant);
    }
  }

  const granterIds = [...new Set([...latest.values()].map((grant) => grant.actorId))];
  const granters = granterIds.length
    ? await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(inArray(users.id, granterIds))
    : [];
  const granterName = new Map(granters.map((g) => [g.id, `${g.firstName} ${g.lastName}`.trim()]));

  return admins.map((admin) => {
    const grant = latest.get(admin.userId);

    return {
      ...admin,
      grantedAt: grant?.createdAt ?? null,
      grantedByName: grant ? (granterName.get(grant.actorId) ?? null) : null,
      revocable: restorableRole(grant?.detail.previousRole) !== null,
    };
  });
}
