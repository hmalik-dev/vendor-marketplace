import fp from 'fastify-plugin';
import { createClerkClient, verifyToken } from '@clerk/backend';
import type { UserRole } from '@vendor-marketplace/shared';
import { forbidden, unauthorized } from '../lib/errors.js';
import { resolveUserByClerkId, type ClerkUserSnapshot } from '../modules/users/users.service.js';

export interface AuthenticatedUser {
  /** Local `users.id`; the only identifier services and DAOs accept. */
  id: string;
  clerkUserId: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthenticatedUser | null;
  }
}

/** Verifies a session token and returns its Clerk subject. */
export type TokenVerifier = (token: string) => Promise<string>;

/** Loads the Clerk identity behind a subject, for the lazy-sync cold path. */
export type ClerkUserLoader = (clerkUserId: string) => Promise<ClerkUserSnapshot>;

export interface ClerkAuthPluginOptions {
  secretKey: string;
  /** Overridden by the route suites so they never reach Clerk's network. */
  verifySessionToken?: TokenVerifier;
  loadClerkUser?: ClerkUserLoader;
}

const BEARER_PREFIX = 'Bearer ';

export function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

function defaultVerifier(secretKey: string): TokenVerifier {
  return async (token) => {
    const payload = await verifyToken(token, { secretKey });
    if (!payload.sub) {
      throw unauthorized('Session token is missing a subject');
    }
    return payload.sub;
  };
}

function defaultLoader(secretKey: string): ClerkUserLoader {
  const clerk = createClerkClient({ secretKey });

  return async (clerkUserId) => {
    const user = await clerk.users.getUser(clerkUserId);
    const primaryEmail =
      user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
      throw unauthorized('Clerk account has no email address');
    }

    return {
      clerkUserId,
      email: primaryEmail,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      roleHint: user.unsafeMetadata?.role,
      avatarUrl: user.imageUrl || null,
    };
  };
}

/**
 * Resolves the caller on every request that presents a bearer token. A token
 * that is present but unusable fails the request outright rather than falling
 * back to anonymous access, so a stale session can never be mistaken for a
 * deliberate public call.
 */
export const clerkAuthPlugin = fp<ClerkAuthPluginOptions>(
  async (app, options) => {
    const verify = options.verifySessionToken ?? defaultVerifier(options.secretKey);
    const loadClerkUser = options.loadClerkUser ?? defaultLoader(options.secretKey);

    app.decorateRequest('auth', null);

    app.addHook('onRequest', async (request) => {
      /*
       * The header, and nothing else.
       *
       * `/events/*` used to be allowed to carry its session token in the query
       * string, because `EventSource` cannot set headers — and the API's own
       * request logger then wrote 27 live session JWTs into one lane's dev log
       * (#215). The stream authenticates with a single-use ticket now, so no
       * route needs this and accepting it anywhere would reopen the hole.
       */
      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        return;
      }

      let clerkUserId: string;
      try {
        clerkUserId = await verify(token);
      } catch (error) {
        request.log.info({ err: error }, 'Rejected an unverifiable session token');
        throw unauthorized('Session token is invalid or expired');
      }

      const user = await resolveUserByClerkId(app.db, clerkUserId, () =>
        loadClerkUser(clerkUserId),
      );

      if (!user) {
        throw unauthorized('No account is linked to this session');
      }

      if (user.isBanned) {
        throw forbidden('This account has been suspended');
      }

      request.auth = { id: user.id, clerkUserId: user.clerkUserId, role: user.role };
    });
  },
  { name: 'clerk-auth', dependencies: ['database'] },
);
