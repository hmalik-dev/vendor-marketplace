import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { CURRENT_TERMS_VERSION, type UserRole } from '@vendor-marketplace/shared';
import { accountSuspended, unauthorized } from '../lib/errors.js';
import { providerAvatarUrl } from '../modules/auth-sync/identity.js';
import { findSessionSubject } from '../modules/users/users.dao.js';
import { splitAuthName, type AuthUserSnapshot } from '../modules/users/users.service.js';

export interface AuthenticatedUser {
  /** Local `users.id`; the only identifier services and DAOs accept. */
  id: string;
  authUserId: string;
  role: UserRole;
}

/**
 * A verified Neon Auth subject, before the local account is resolved.
 *
 * The acceptance gate is the only thing that reads this. It exists because
 * that gate is what **creates** the local row — in the same transaction as the
 * acceptance — so it has to be reachable by a session that has no row yet, and
 * it needs the token's claims to write one from.
 */
export interface AuthIdentity {
  authUserId: string;
  loadSnapshot: () => Promise<AuthUserSnapshot>;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * A route a suspended or retired account must still reach — set on the one
     * route that exists for somebody who cannot get in. The account is then
     * read as signed out (`auth` stays null) instead of failing the request.
     */
    openToLockedOut?: boolean;
  }

  interface FastifyRequest {
    auth: AuthenticatedUser | null;
    /** Set whenever a valid session token was presented. */
    authIdentity: AuthIdentity | null;
    /**
     * True when the session is genuine but the account has not accepted the
     * current Terms — so `auth` is null for a reason that is not "signed out".
     */
    termsRequired: boolean;
  }
}

/** Verifies a session token and returns its Neon Auth subject. */
export type TokenVerifier = (token: string) => Promise<string>;

/** Loads the identity behind a verified token, for the acceptance gate's cold path. */
export type AuthUserLoader = (authUserId: string, token: string) => Promise<AuthUserSnapshot>;

export interface NeonAuthPluginOptions {
  /** The branch's Neon Auth endpoint; issuer and audience of every token. */
  baseUrl: string;
  /** Overridden by the route suites so they never reach Neon's network. */
  verifySessionToken?: TokenVerifier;
  loadAuthUser?: AuthUserLoader;
  /** Key source for the default verifier; a local set in the plugin's own suite. */
  jwks?: JWTVerifyGetKey;
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
 * Neon issues `iss` and `aud` as the endpoint's **origin**, not the `/auth`
 * path the JWKS lives under (VEN-444, q1).
 */
export function tokenOrigin(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

function jwksFor(baseUrl: string): JWTVerifyGetKey {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/.well-known/jwks.json`);
  return createRemoteJWKSet(url);
}

/**
 * Checks signature, issuer, audience and expiry against the branch's JWKS.
 *
 * The token's own `role` claim is always `authenticated` and is never read: the
 * only role that counts is the local `users.role` column.
 */
async function verifiedClaims(baseUrl: string, jwks: JWTVerifyGetKey, token: string) {
  const origin = tokenOrigin(baseUrl);
  const { payload } = await jwtVerify(token, jwks, {
    issuer: origin,
    audience: origin,
    algorithms: ['EdDSA'],
  });

  if (!payload.sub) {
    throw unauthorized('Session token is missing a subject');
  }

  /*
   * Sign-in already refuses an unverified address, so a token for one should
   * not exist; refusing it here means a change to that setting cannot quietly
   * admit the addresses the invite gate relies on being real.
   */
  if (payload.emailVerified !== true) {
    throw unauthorized('The address on this session is not verified');
  }

  return { claims: payload as Record<string, unknown>, sub: payload.sub };
}

function stringClaim(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Reads `iat` (as epoch milliseconds) from an already-verified token's payload,
 * without a second signature check — `verify` above has already proven the
 * payload is what the issuer signed. Used only to compare against
 * `users.sessions_invalidated_at` (VEN-628); a token with no readable `iat`
 * compares as `null` and is never refused on that basis alone.
 */
function issuedAtMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const iat = (JSON.parse(json) as { iat?: unknown }).iat;
    return typeof iat === 'number' ? iat * 1000 : null;
  } catch {
    return null;
  }
}

/** The default verifier: signature, issuer, audience, expiry and a verified address. */
export function createNeonTokenVerifier(baseUrl: string, jwks?: JWTVerifyGetKey): TokenVerifier {
  const keys = jwks ?? jwksFor(baseUrl);
  return async (token) => (await verifiedClaims(baseUrl, keys, token)).sub;
}

/** The default loader: the row is written from the token's own verified claims. */
export function createNeonUserLoader(baseUrl: string, jwks?: JWTVerifyGetKey): AuthUserLoader {
  const keys = jwks ?? jwksFor(baseUrl);
  return async (authUserId, token) => {
    const { claims } = await verifiedClaims(baseUrl, keys, token);
    const email = stringClaim(claims['email']);
    if (!email) {
      throw unauthorized('Session token has no email address');
    }

    return {
      authUserId,
      email,
      ...splitAuthName(stringClaim(claims['name'])),
      // Set by the acceptance gate from the sign-up choice, never by the token.
      roleHint: undefined,
      avatarUrl: providerAvatarUrl(claims['image']),
    };
  };
}

/**
 * Resolves the caller on every request that presents a bearer token. A token
 * that is present but unusable fails the request outright rather than falling
 * back to anonymous access, so a stale session can never be mistaken for a
 * deliberate public call.
 */
export const neonAuthPlugin = fp<NeonAuthPluginOptions>(
  async (app, options) => {
    const verify =
      options.verifySessionToken ?? createNeonTokenVerifier(options.baseUrl, options.jwks);
    const loadAuthUser =
      options.loadAuthUser ?? createNeonUserLoader(options.baseUrl, options.jwks);

    app.decorateRequest('auth', null);
    app.decorateRequest('authIdentity', null);
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

      let authUserId: string;
      try {
        authUserId = await verify(token);
      } catch (error) {
        /*
         * A reason, never the error: jose attaches the rejected token's decoded
         * claims (`sub`, `email`, `name`) to an expiry or claim failure, and an
         * expired token is routine — one per idle tab every fifteen minutes.
         */
        request.log.info(
          { reason: error instanceof Error ? error.name : 'unknown' },
          'Rejected an unverifiable session token',
        );
        throw unauthorized('Session token is invalid or expired');
      }

      request.authIdentity = {
        authUserId,
        loadSnapshot: () => loadAuthUser(authUserId, token),
      };

      /*
       * The account and the acceptance in one round trip.
       *
       * The gate runs before every route rather than beside some of them — a
       * rule enforced route by route is one the next route forgets — so it is
       * on the hot path for every authenticated request, and asking the
       * question as a second query would have cost a whole network round trip
       * per request against a hosted Postgres.
       *
       * This is also the whole defence against Neon Auth's open sign-up
       * (VEN-444, branch ii): anyone can mint a valid token, so a token proves
       * an identity and nothing else. The row this reads is what makes it a
       * customer, a vendor or no one, and a token stays verifiable for its 15
       * minutes after the identity is deleted — the row check is the gate.
       */
      const subject = await findSessionSubject(
        app.db,
        authUserId,
        'terms_of_service',
        CURRENT_TERMS_VERSION,
      );

      /*
       * An identity that has been deleted keeps its retired row so bookings and
       * reviews can still reference it, and it must not resolve to a session.
       * It is checked *before* the branch below because the two are otherwise
       * indistinguishable to it: an erased account would be invited to accept
       * the Terms and bring itself back.
       */
      const openToLockedOut = request.routeOptions.config.openToLockedOut === true;

      if (subject?.user.deletedAt) {
        if (openToLockedOut) {
          return;
        }

        throw unauthorized('No account is linked to this session');
      }

      /*
       * **No account row yet is the gated state, not an error, and this hook
       * never creates one.** The only writer on the product path is the
       * acceptance gate, in the same transaction as the acceptance itself — so
       * a session with no row is somebody who has authenticated and not yet
       * ticked the box, and the answer they are owed is the interstitial
       * rather than a 401 that reads as signed out.
       */
      if (!subject) {
        request.termsRequired = true;
        return;
      }

      const { user } = subject;

      /*
       * A Neon Auth JWT is stateless and stays verifiable until it expires
       * regardless of sign-out (VEN-628) — this is the bound on that window.
       * `sessions_invalidated_at` is bumped once, by the web tier's sign-out
       * proxy; any token minted before it is refused the same way an expired
       * one is, so a captured token cannot outlive the sign-out that should
       * have ended it by more than the time this column takes to write.
       *
       * Compared at whole-second resolution, floored down: `iat` is seconds
       * (a JWT convention) but `now()` carries microseconds, so a token
       * minted in the same wall-clock second as the write — on a re-sign-in
       * immediately after, say — must not be refused for its whole
       * remaining life over a sub-second race neither clock can resolve.
       */
      if (
        user.sessionsInvalidatedAt !== null &&
        (issuedAtMs(token) ?? Infinity) <
          Math.floor(user.sessionsInvalidatedAt.getTime() / 1000) * 1000
      ) {
        throw unauthorized('Session token is invalid or expired');
      }

      if (user.isBanned) {
        if (openToLockedOut) {
          return;
        }

        throw accountSuspended();
      }

      if (!subject.holdsDocument) {
        request.termsRequired = true;
        return;
      }

      request.auth = { id: user.id, authUserId: user.authUserId, role: user.role };
    });
  },
  { name: 'neon-auth', dependencies: ['database'] },
);
