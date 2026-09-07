import {
  acceptVendorAgreementSchema,
  vendorAgreementStatusSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import { acceptanceContext } from '../legal/acceptance-context.js';
import { acceptVendorAgreement, readAgreementStatus } from './legal-agreement.service.js';

export const legalAgreementRoutes: FastifyPluginAsyncZod = async (app) => {
  const vendorOnly = requireRole('vendor');

  app.get(
    '/vendor/agreement',
    { preHandler: vendorOnly, schema: { response: { 200: vendorAgreementStatusSchema } } },
    async (request) => readAgreementStatus(app.db, assertRole(request.auth, ['vendor']).id),
  );

  /**
   * Accept, once, immutably.
   *
   * Role is checked before body parsing rather than in a `preHandler`: a
   * wrong-role caller can send a body malformed enough to trip Fastify's own
   * JSON parser, and that 400 must not outrun the 403 they are owed — the same
   * rule `POST /vendor/stripe/connect` follows.
   */
  app.post(
    '/vendor/agreement/accept',
    {
      onRequest: requireRoleBeforeValidation('vendor'),
      schema: {
        body: acceptVendorAgreementSchema,
        response: { 200: vendorAgreementStatusSchema },
      },
    },
    async (request) =>
      acceptVendorAgreement(
        app.db,
        assertRole(request.auth, ['vendor']).id,
        request.body.version,
        acceptanceContext(request),
      ),
  );
};
