import { acceptTermsSchema, termsAcceptanceStatusSchema } from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { clerkSubject, requireClerkSubject } from '../../lib/guards.js';
import { acceptanceContext } from './acceptance-context.js';
import { acceptTerms, readTermsStatus, unacceptedTermsStatus } from './terms.service.js';

/**
 * The acceptance gate's two routes, and the **only** two an account that has
 * not accepted the current Terms can reach.
 *
 * Every other guarded route refuses such a session with `TERMS_REQUIRED`, so
 * these deliberately do not use `requireAuth`: they authorise on the verified
 * Clerk subject rather than on a local account row, because on a first sign-in
 * there is no local row yet — this is the path that creates it.
 */
export const termsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/legal/terms',
    { onRequest: requireClerkSubject, schema: { response: { 200: termsAcceptanceStatusSchema } } },
    async (request) =>
      /*
       * No account row yet is the ordinary case here — it is every first
       * sign-in — and it needs no query to answer: nothing has been accepted.
       */
      request.auth ? readTermsStatus(app.db, request.auth.id) : unacceptedTermsStatus(),
  );

  /**
   * Accept, once, immutably — and bring the account into existence doing it.
   *
   * The subject is checked at `onRequest`, before Fastify parses the body: a
   * caller with no session can otherwise send a payload malformed enough to
   * trip the JSON parser and be answered with a 400 describing the schema
   * instead of the 401 they are owed. The same rule the vendor agreement's
   * accept route follows, and 200 for the same reason it answers 200 — this is
   * an action whose result is the status the gate re-reads, not a resource with
   * a URL of its own.
   */
  app.post(
    '/legal/terms/accept',
    {
      onRequest: requireClerkSubject,
      schema: { body: acceptTermsSchema, response: { 200: termsAcceptanceStatusSchema } },
    },
    async (request) => {
      const identity = clerkSubject(request.clerkIdentity);

      return acceptTerms(
        app.db,
        identity.clerkUserId,
        identity.loadSnapshot,
        request.body,
        acceptanceContext(request),
      );
    },
  );
};
