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

/**
 * The one route family that may carry its token in the query string.
 *
 * `EventSource` cannot set request headers — that is a limitation of the
 * browser API, not a choice — so an authenticated stream has nowhere else to
 * put the token. It is confined to this prefix rather than accepted anywhere,
 * because a token in a URL is a token in access logs, browser history and
 * `Referer`, and every other route has a header available to it.
 */
const QUERY_TOKEN_PATH_PREFIX = '/events/';

export function extractQueryToken(url: string): string | null {
  const path = url.split('?')[0] ?? '';

  if (!path.startsWith(QUERY_TOKEN_PATH_PREFIX)) {
    return null;
  }

  const query = url.slice(path.length + 1);
  const token = new URLSearchParams(query).get('token')?.trim();

  return token ? token : null;
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
      const token =
        extractBearerToken(request.headers.authorization) ?? extractQueryToken(request.url);
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
