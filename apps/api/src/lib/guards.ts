import type { onRequestAsyncHookHandler, preHandlerAsyncHookHandler } from 'fastify';
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

/**
 * The same guard, one lifecycle stage earlier.
 *
 * Fastify validates the request schema **before** `preHandler` runs, so a route
 * guarded only there answers a signed-out caller with a 400 describing why
 * their input was wrong — and for a `z.enum` that 400 carries the enum's
 * allowed values in `details`. The upload route leaked its whole storage-prefix
 * namespace that way, to anyone, unauthenticated.
 *
 * `onRequest` runs before validation. The auth plugin's own hook is registered
 * globally and therefore earlier still, so `request.auth` is already resolved
 * by the time this reads it.
 *
 * Reach for this on any route whose schema would say something to a caller who
 * has not proved who they are. `preHandler` remains right for the rest: it is
 * the stage the framework intends, and running every guard early would trade a
 * clearer stack for a benefit only this class of route gets.
 */
export const requireAuthBeforeValidation: onRequestAsyncHookHandler = async (request) => {
  authenticated(request.auth);
};

/** Route guard factory: an authenticated user holding one of `roles`. */
export function requireRole(...roles: readonly UserRole[]): preHandlerAsyncHookHandler {
  return async (request) => {
    assertRole(request.auth, roles);
  };
}

/**
 * The same guard, moved to `onRequest` for the same reason
 * `requireAuthBeforeValidation` exists — but here the stage that runs early
 * is Fastify's own **body parser**, not schema validation.
 *
 * A route with no `body` schema still parses the body before `preHandler`
 * runs: `POST /vendor/stripe/connect` with `content-type: application/json`
 * and an empty payload answered `400 VALIDATION_ERROR` to a signed-in
 * customer, because the parser's own `FST_ERR_CTP_EMPTY_JSON_BODY` reached
 * the error handler before `requireRole`'s `preHandler` guard ever ran. The
 * customer was still denied — no route below this ever executed — but the
 * wrong status code reads like a broken endpoint in an audit rather than the
 * refusal it actually was.
 *
 * Reach for this on a route a wrong-role caller might reach with a body
 * malformed enough to trip the parser — a POST or PUT guarded by role alone.
 */
export function requireRoleBeforeValidation(
  ...roles: readonly UserRole[]
): onRequestAsyncHookHandler {
  return async (request) => {
    assertRole(request.auth, roles);
  };
}
