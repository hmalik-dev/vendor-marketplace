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
 * Seeded marketplace accounts (`seed_mkt_…`) have no identity anywhere.
 *
 * The distinction matters more than it looks: without it every seeded vendor
 * reads as "deleted in Neon Auth" and a caller retires the entire public
 * marketplace. A row Neon Auth never issued is not a row it deleted, and is
 * outside its jurisdiction.
 */
const SEEDED_PREFIX = 'seed_';

export function isSeededIdentity(authUserId: string): boolean {
  return authUserId.startsWith(SEEDED_PREFIX);
}

/**
 * A row the previous identity provider issued (Clerk ids are `user_` plus 27
 * alphanumerics). Neon Auth does not know it, so reading its absence as a
 * deletion would retire and refund a live account: it is outside this pass's
 * jurisdiction until someone migrates it deliberately, exactly as a seeded row is.
 */
const LEGACY_ID = /^user_[A-Za-z0-9]{24,}$/;

export function isLegacyIdentity(authUserId: string): boolean {
  return LEGACY_ID.test(authUserId);
}

/** Rows no Neon Auth identity backs: seeded accounts and legacy-provider ones. */
export function isUnbackedIdentity(authUserId: string): boolean {
  return isSeededIdentity(authUserId) || isLegacyIdentity(authUserId);
}

/**
 * True for a stored avatar the identity provider owns — an absolute URL — and
 * false for an upload, which is an object key or a site path (VEN-427).
 */
export function isProviderAvatar(avatarUrl: string | null): boolean {
  return avatarUrl === null || /^https?:\/\//i.test(avatarUrl);
}
