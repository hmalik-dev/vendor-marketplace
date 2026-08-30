import type { preHandlerAsyncHookHandler } from 'fastify';
import type { UserRole } from '@vendor-marketplace/shared';
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
 *
 * The refusal deliberately does **not** name the role it wanted. That sentence
 * is a rule written for whoever wrote the route, and this message is rendered
 * verbatim by a dozen call sites — a toast, an upload tile, a form error — so
 * naming the rule puts "This endpoint requires the vendor role" in front of a
 * customer who can do nothing with it. Which role a route needs is readable
 * from the route; what the reader needs is that this account is the wrong one.
 */
export function assertRole(
  auth: AuthenticatedUser | null,
  roles: readonly UserRole[],
): AuthenticatedUser {
  const user = authenticated(auth);

  if (!roles.includes(user.role)) {
    throw forbidden();
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
