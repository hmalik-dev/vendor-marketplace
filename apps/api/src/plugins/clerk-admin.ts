import fp from 'fastify-plugin';
import { createClerkClient } from '@clerk/backend';
import type { ClerkUserSource } from '../modules/webhooks/clerk-user-source.js';

/**
 * Ends a Clerk identity outright — the identity itself, not just its sessions
 * (#451).
 *
 * Idempotent by contract: an identity that is already gone is a success, not an
 * error. Sign-in no longer runs on Clerk, so this and the webhook that reads
 * `clerkUsers` exist only until the operator, closure and sync work moves to
 * Neon Auth (VEN-448), which deletes this file.
 */
export type ClerkUserDeleter = (authUserId: string) => Promise<void>;

declare module 'fastify' {
  interface FastifyInstance {
    /** Ends a Clerk identity outright; see `ClerkUserDeleter`. */
    deleteClerkUser: ClerkUserDeleter;
    /** Reads Clerk identities outside a session; the Clerk webhook asks it who holds an address. */
    clerkUsers: ClerkUserSource;
  }
}

export interface ClerkAdminPluginOptions {
  secretKey: string;
  /** Overridden by the route suites so they never reach Clerk's network. */
  deleteClerkUser?: ClerkUserDeleter;
  clerkUsers?: ClerkUserSource;
}

/**
 * Clerk answers 404 for an identity that is not there, and this treats that as
 * done rather than as a failure. Read structurally rather than through Clerk's
 * error class so the check does not depend on the SDK's internals.
 */
function isAlreadyGone(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 404
  );
}

export const clerkAdminPlugin = fp<ClerkAdminPluginOptions>(
  async (app, options) => {
    const clerk = createClerkClient({ secretKey: options.secretKey });

    app.decorate(
      'deleteClerkUser',
      options.deleteClerkUser ??
        (async (authUserId) => {
          try {
            await clerk.users.deleteUser(authUserId);
          } catch (error) {
            if (!isAlreadyGone(error)) {
              throw error;
            }
          }
        }),
    );
    app.decorate('clerkUsers', options.clerkUsers ?? clerk.users);
  },
  { name: 'clerk-admin' },
);
