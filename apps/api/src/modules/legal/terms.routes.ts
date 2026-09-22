import { acceptTermsSchema, termsAcceptanceStatusSchema } from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authSubject, requireAuthSubject } from '../../lib/guards.js';
import { acceptanceContext } from './acceptance-context.js';
import { acceptTerms, readTermsStatus } from './terms.service.js';

/**
 * The acceptance gate's two routes, and the **only** two an account that has
 * not accepted the current Terms can reach.
 *
 * Every other guarded route refuses such a session with `TERMS_REQUIRED`, so
 * these deliberately do not use `requireAuth`: they authorise on the verified
 * Auth subject rather than on a local account row, because on a first sign-in
 * there is no local row yet — this is the path that creates it.
 */
export const termsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/legal/terms',
    { onRequest: requireAuthSubject, schema: { response: { 200: termsAcceptanceStatusSchema } } },
    async (request) => {
      const identity = authSubject(request.authIdentity);

      return readTermsStatus(app.db, identity.authUserId, identity.loadSnapshot);
    },
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
      onRequest: requireAuthSubject,
      schema: { body: acceptTermsSchema, response: { 200: termsAcceptanceStatusSchema } },
    },
    async (request) => {
      const identity = authSubject(request.authIdentity);

      return acceptTerms(
        app.db,
        identity.authUserId,
        identity.loadSnapshot,
        request.body,
        acceptanceContext(request),
      );
    },
  );
};
