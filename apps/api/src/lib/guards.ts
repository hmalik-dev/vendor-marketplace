import type { preHandlerAsyncHookHandler } from 'fastify';
import type { UserRole } from '@vendorhub/shared';
import { forbidden, unauthorized } from './errors.js';
import type { AuthenticatedUser } from '../plugins/clerk-auth.js';

/**
 * Reads the caller resolved by the auth plugin, or fails the request with 401.
 * Handlers call this to narrow `request.auth` after `requireAuth` has run.
 */
export function authenticated(auth: AuthenticatedUser | null): AuthenticatedUser {
  if (!auth) {
    throw unauthorized();
  }

  return auth;
}

/**
 * Authorization always reads the local `users.role` column rather than Clerk
 * metadata, which the account holder can write.
 */
export function assertRole(
  auth: AuthenticatedUser | null,
  roles: readonly UserRole[],
): AuthenticatedUser {
  const user = authenticated(auth);

  if (!roles.includes(user.role)) {
    throw forbidden(`This endpoint requires the ${roles.join(' or ')} role`);
  }

  return user;
}

/** Route guard: any authenticated user. */
export const requireAuth: preHandlerAsyncHookHandler = async (request) => {
  authenticated(request.auth);
};

/** Route guard factory: an authenticated user holding one of `roles`. */
export function requireRole(...roles: readonly UserRole[]): preHandlerAsyncHookHandler {
  return async (request) => {
    assertRole(request.auth, roles);
  };
}
