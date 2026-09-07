import fp from 'fastify-plugin';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { CURRENT_TERMS_VERSION, type UserRole } from '@vendor-marketplace/shared';
import { forbidden, unauthorized } from '../lib/errors.js';
import { findSessionSubject } from '../modules/users/users.dao.js';
import type { ClerkUserSnapshot } from '../modules/users/users.service.js';

export interface AuthenticatedUser {
  /** Local `users.id`; the only identifier services and DAOs accept. */
  id: string;
  clerkUserId: string;
  role: UserRole;
}

/**
 * A verified Clerk subject, before the local account is resolved.
 *
 * The acceptance gate is the only thing that reads this. It exists because
 * that gate is what **creates** the local row — in the same transaction as the
 * acceptance — so it has to be reachable by a session that has no row yet, and
 * it needs the Clerk snapshot to write one from.
 */
export interface ClerkIdentity {
  clerkUserId: string;
  loadSnapshot: () => Promise<ClerkUserSnapshot>;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthenticatedUser | null;
    /** Set whenever a valid session token was presented. */
    clerkIdentity: ClerkIdentity | null;
    /**
     * True when the session is genuine but the account has not accepted the
     * current Terms — so `auth` is null for a reason that is not "signed out".
     */
    termsRequired: boolean;
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
    app.decorateRequest('clerkIdentity', null);
    app.decorateRequest('termsRequired', false);

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

      request.clerkIdentity = { clerkUserId, loadSnapshot: () => loadClerkUser(clerkUserId) };

      /*
       * The account and the acceptance in one round trip.
       *
       * The gate runs before every route rather than beside some of them — a
       * rule enforced route by route is one the next route forgets — so it is
       * on the hot path for every authenticated request, and asking the
       * question as a second query would have cost a whole network round trip
       * per request against a hosted Postgres.
       */
      const subject = await findSessionSubject(
        app.db,
        clerkUserId,
        'terms_of_service',
        CURRENT_TERMS_VERSION,
      );

      /*
       * An identity Clerk has deleted keeps its retired row so bookings and
       * reviews can still reference it, and it must not resolve to a session —
       * the answer it got before this gate existed, and still gets. It is
       * checked *before* the branch below because the two are otherwise
       * indistinguishable to it: an erased account would be invited to accept
       * the Terms and bring itself back.
       */
      if (subject?.user.deletedAt) {
        throw unauthorized('No account is linked to this session');
      }

      /*
       * **No account row yet is the gated state, not an error.**
       *
       * This hook used to create the row lazily, which is what made an account
       * exist without having accepted anything. Since #429 the only writer on
       * the product path is the acceptance gate, in the same transaction as the
       * acceptance itself — so a session with no row is somebody who has
       * authenticated and not yet ticked the box, and the answer they are owed
       * is the interstitial rather than a 401 that reads as signed out.
       */
      if (!subject) {
        request.termsRequired = true;
        return;
      }

      const { user } = subject;

      if (user.isBanned) {
        throw forbidden('This account has been suspended');
      }

      if (!subject.holdsDocument) {
        request.termsRequired = true;
        return;
      }

      request.auth = { id: user.id, clerkUserId: user.clerkUserId, role: user.role };
    });
  },
  { name: 'clerk-auth', dependencies: ['database'] },
);
