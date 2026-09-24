import type { AdminAccountChangeResult, AdminAccountList } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { conflict, notFound } from '../../lib/errors.js';
import { findAdmins, grantAdminByEmail, revokeAdminById } from './admins.dao.js';

export const LAST_ADMIN_REVOKE_REFUSAL =
  'This is the last admin account that can still sign in. Removing its access would leave nobody able to reach the console.';

export async function listAdmins(db: AppDatabase): Promise<AdminAccountList> {
  const admins = await findAdmins(db);

  return {
    items: admins.map((admin) => ({
      userId: admin.userId,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      isBanned: admin.isBanned,
      since: (admin.grantedAt ?? admin.createdAt).toISOString(),
      grantedAt: admin.grantedAt?.toISOString() ?? null,
      grantedByName: admin.grantedByName,
      revocable: admin.revocable,
    })),
  };
}

/** A repeat grant answers as the first did, and writes nothing. */
export async function grantAdmin(
  db: AppDatabase,
  actorId: string,
  email: string,
  now: Date,
): Promise<AdminAccountChangeResult> {
  const { result, userId } = await grantAdminByEmail(db, actorId, email, now);

  switch (result) {
    case 'not-found':
      throw notFound('No active account has that address');
    case 'ambiguous':
      throw conflict(
        'More than one active account holds that address, so it cannot be granted here',
      );
    case 'banned':
      throw conflict('That account is suspended, so it cannot be made an admin');
    case 'unverified':
      throw conflict(
        'That account has an address change the sign-in provider has not confirmed, so it cannot be made an admin yet',
      );
    case 'live-storefront':
      throw conflict(
        'That account owns a published storefront, which an admin cannot operate. Unpublish the storefront first, then grant access',
      );
    case 'open-bookings':
      throw conflict(
        'That account has open booking requests or bookings, which an admin cannot manage. Let them finish or cancel them first, then grant access',
      );
    default:
      return { userId: userId!, changed: result === 'changed' };
  }
}

export async function revokeAdmin(
  db: AppDatabase,
  actorId: string,
  userId: string,
  now: Date,
): Promise<AdminAccountChangeResult> {
  const result = await revokeAdminById(db, actorId, userId, now);

  switch (result) {
    case 'not-found':
      throw notFound('No account with that id');
    case 'last-admin':
      throw conflict(LAST_ADMIN_REVOKE_REFUSAL);
    case 'no-prior-role':
      throw conflict(
        'This admin was not granted access in the app, so there is no earlier role to return them to',
      );
    default:
      return { userId, changed: result === 'changed' };
  }
}
