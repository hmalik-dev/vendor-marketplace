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
  interface FastifyInstance {
    /** Ends a Clerk identity outright; see `ClerkUserDeleter`. */
    deleteClerkUser: ClerkUserDeleter;
  }

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

/**
 * Deletes a Clerk identity — the identity itself, not just its sessions (#451).
 *
 * Closure releases the person's email address on our side, so the identity
 * holding that address at Clerk's end has to go with it; revoking sessions
 * alone would leave the two systems disagreeing about the same person, and
 * would still lock them out of signing up again. Deleting also ends the ghost
 * session the retired row would otherwise leave running: `<UserButton />`
 * chrome over an application that 401s every read.
 *
 * Idempotent by contract — an identity that is already gone is a success, not
 * an error, because Clerk's own self-serve deletion can have got there first.
 */
export type ClerkUserDeleter = (clerkUserId: string) => Promise<void>;

export interface ClerkAuthPluginOptions {
  secretKey: string;
  /** Overridden by the route suites so they never reach Clerk's network. */
  verifySessionToken?: TokenVerifier;
  loadClerkUser?: ClerkUserLoader;
  deleteClerkUser?: ClerkUserDeleter;
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

/**
 * The Clerk backend client, named once so both seams below take the same one.
 *
 * `ReturnType` rather than an imported type: the SDK's client type is not part
 * of what this file needs to name, and deriving it cannot drift.
 */
type ClerkBackendClient = ReturnType<typeof createClerkClient>;

function defaultLoader(clerk: ClerkBackendClient): ClerkUserLoader {
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
 * Clerk answers 404 for an identity that is not there, and this treats that as
 * done rather than as a failure: the person may have deleted themselves
 * through `<UserButton />` moments before an operator closed the account, and
 * both routes want the same end state. Read structurally rather than through
 * Clerk's error class so the check does not depend on the SDK's internals.
 */
function isAlreadyGone(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 404
  );
}

function defaultDeleter(clerk: ClerkBackendClient): ClerkUserDeleter {
  return async (clerkUserId) => {
    try {
      await clerk.users.deleteUser(clerkUserId);
    } catch (error) {
      if (isAlreadyGone(error)) {
        return;
      }

      throw error;
    }
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
    /*
     * One client, shared by both seams that reach Clerk's backend API. Built
     * from the same secret twice, they would be two places for a client option
     * — an `apiUrl`, a proxy, a timeout — to be added to one and not the other,
     * with nothing failing to say so.
     */
    const clerk = createClerkClient({ secretKey: options.secretKey });
    const verify = options.verifySessionToken ?? defaultVerifier(options.secretKey);
    const loadClerkUser = options.loadClerkUser ?? defaultLoader(clerk);

    app.decorate('deleteClerkUser', options.deleteClerkUser ?? defaultDeleter(clerk));

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
