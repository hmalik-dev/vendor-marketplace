import type { AdminOperatorChangeResult, AdminOperatorList } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { conflict, notFound } from '../../lib/errors.js';
import { findOperators, grantOperatorByEmail, revokeOperatorById } from './admin-operators.dao.js';

export const LAST_OPERATOR_REVOKE_REFUSAL =
  'This is the last operator account that can still sign in. Removing its access would leave nobody able to reach the console.';

export async function listOperators(db: AppDatabase): Promise<AdminOperatorList> {
  const operators = await findOperators(db);

  return {
    items: operators.map((operator) => ({
      userId: operator.userId,
      firstName: operator.firstName,
      lastName: operator.lastName,
      email: operator.email,
      isBanned: operator.isBanned,
      since: (operator.grantedAt ?? operator.createdAt).toISOString(),
      grantedAt: operator.grantedAt?.toISOString() ?? null,
      grantedByName: operator.grantedByName,
      revocable: operator.revocable,
    })),
  };
}

/** A repeat grant answers as the first did, and writes nothing. */
export async function grantOperator(
  db: AppDatabase,
  actorId: string,
  email: string,
  now: Date,
): Promise<AdminOperatorChangeResult> {
  const { result, userId } = await grantOperatorByEmail(db, actorId, email, now);

  switch (result) {
    case 'not-found':
      throw notFound('No active account has that address');
    case 'ambiguous':
      throw conflict(
        'More than one active account holds that address, so it cannot be granted here',
      );
    case 'banned':
      throw conflict('That account is suspended, so it cannot be made an operator');
    case 'unverified':
      throw conflict(
        'That account has an address change the sign-in provider has not confirmed, so it cannot be made an operator yet',
      );
    default:
      return { userId: userId!, changed: result === 'changed' };
  }
}

export async function revokeOperator(
  db: AppDatabase,
  actorId: string,
  userId: string,
  now: Date,
): Promise<AdminOperatorChangeResult> {
  const result = await revokeOperatorById(db, actorId, userId, now);

  switch (result) {
    case 'not-found':
      throw notFound('No account with that id');
    case 'last-operator':
      throw conflict(LAST_OPERATOR_REVOKE_REFUSAL);
    case 'no-prior-role':
      throw conflict(
        'This operator was not granted access in the app, so there is no earlier role to return them to',
      );
    default:
      return { userId, changed: result === 'changed' };
  }
}
