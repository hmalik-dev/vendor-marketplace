import { MAX_URL_LENGTH, type AuthProvider } from '@vendor-marketplace/shared';
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
    avatarUrl: providerAvatarUrl(identity.image),
  };
}

/**
 * Rows Neon Auth never issued: seeded marketplace accounts (`seed`).
 *
 * Read from `users.auth_provider`, recorded at insert (VEN-450), never guessed
 * from the shape of the id: a Neon Auth id that happened to start `user_` would
 * otherwise be taken for an auth one and skipped for ever. The distinction
 * matters more than it looks: without it every seeded vendor reads as "deleted
 * in Neon Auth" and a caller retires the entire public marketplace. Such a row
 * is outside this pass's jurisdiction.
 */
export function isSeededIdentity(authProvider: AuthProvider): boolean {
  return authProvider === 'seed';
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

/**
 * The avatar an identity provider hands us, or `null` when it is not one we
 * will store (VEN-538). A signed-in user can set their own `image` to anything,
 * so it is checked before it becomes a row: an absolute http(s) URL, no
 * credentials, no control characters, at most `MAX_URL_LENGTH`. Null means "no
 * opinion", so a bad value never blanks an existing avatar either.
 */
export function providerAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
  if (
    trimmed === '' ||
    trimmed.length > MAX_URL_LENGTH ||
    /[\u0000-\u001f\u007f\\]/.test(trimmed)
  ) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const isWeb = url.protocol === 'https:' || url.protocol === 'http:';

    return isWeb && url.username === '' && url.password === '' ? trimmed : null;
  } catch {
    return null;
  }
}
