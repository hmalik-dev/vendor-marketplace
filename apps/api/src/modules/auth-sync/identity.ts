import type { AuthProvider } from '@vendor-marketplace/shared';
import type { NeonAuthDirectory, NeonAuthIdentity } from '@vendor-marketplace/db';
import { mirroredAuthName, splitAuthName } from '../users/users.service.js';

/**
 * The half of Neon Auth the API reads outside a session: who holds an address,
 * and whether an identity still exists. One seam for the reconcile pass and the
 * sync's contested-address check, so the suites supply one fake.
 */
export type AuthIdentitySource = Pick<NeonAuthDirectory, 'lookup'>;

/** Ends an identity outright — the identity itself, not just its sessions. Idempotent. */
export type AuthIdentityDeleter = NeonAuthDirectory['deleteIdentity'];

/**
 * What an identity says about the local row, field by field.
 *
 * `null` means Neon Auth has **no opinion**, never "clear it". That is the whole
 * of the avatar rule (VEN-427): an identity with no image must not blank one
 * the account holder uploaded, and a name field left empty must not erase one
 * they typed.
 */
export interface MirroredIdentity {
  authUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export function mirroredIdentity(identity: NeonAuthIdentity): MirroredIdentity {
  const { firstName, lastName } = splitAuthName(identity.name);

  return {
    authUserId: identity.id,
    email: identity.email.trim() === '' ? null : identity.email.trim(),
    // Normalised here, not only at the write, so the drift check compares what the write would store.
    firstName: mirroredAuthName(firstName) === '' ? null : mirroredAuthName(firstName),
    lastName: mirroredAuthName(lastName) === '' ? null : mirroredAuthName(lastName),
    avatarUrl: identity.image,
  };
}

/**
 * Rows Neon Auth never issued: seeded marketplace accounts (`seed`) and ones the
 * previous identity provider issued (`legacy_clerk`).
 *
 * Read from `users.auth_provider`, recorded at insert (VEN-450), never guessed
 * from the shape of the id: a Neon Auth id that happened to start `user_` would
 * otherwise be taken for an auth one and skipped for ever. The distinction
 * matters more than it looks: without it every seeded vendor reads as "deleted
 * in Neon Auth" and a caller retires the entire public marketplace, and a
 * legacy live account would be retired and refunded. Such a row is outside this
 * pass's jurisdiction until someone migrates it deliberately.
 */
export function isSeededIdentity(authProvider: AuthProvider): boolean {
  return authProvider === 'seed';
}

export function isLegacyIdentity(authProvider: AuthProvider): boolean {
  return authProvider === 'legacy_clerk';
}

/** Rows no Neon Auth identity backs. */
export function isUnbackedIdentity(authProvider: AuthProvider): boolean {
  return authProvider !== 'neon_auth';
}

/**
 * True for a stored avatar the identity provider owns — an absolute URL — and
 * false for an upload, which is an object key or a site path (VEN-427).
 */
export function isProviderAvatar(avatarUrl: string | null): boolean {
  return avatarUrl === null || /^https?:\/\//i.test(avatarUrl);
}
