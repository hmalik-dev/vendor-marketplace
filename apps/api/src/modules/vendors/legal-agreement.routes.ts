import { isIP } from 'node:net';
import {
  acceptVendorAgreementSchema,
  vendorAgreementStatusSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import { acceptVendorAgreement, readAgreementStatus } from './legal-agreement.service.js';

/** The address the record keeps, or `null` where the proxy reported none. */
const MAX_USER_AGENT_LENGTH = 500;

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
      acceptVendorAgreement(app.db, assertRole(request.auth, ['vendor']).id, request.body.version, {
        /*
         * Recorded, never trusted. Neither value decides anything — they exist
         * so the row is worth something in a dispute — and both are
         * attacker-controlled, so both are bounded before they reach a column.
         *
         * **`request.ip` is not an address.** The server trusts one forwarded
         * hop on a deployment (`server.ts`), and `X-Forwarded-For` is split and
         * trimmed without being parsed — so whatever text sits at that hop
         * arrives here. Over 45 characters it fails the column with a Postgres
         * 22001, which turns accepting the agreement into a 500 whose driver
         * error carries every bound parameter into the log. `isIP` is the check
         * that stops that, and it stops a shorter forgery from being filed as
         * evidence at the same time: what is not an address is recorded as no
         * address rather than as a string somebody chose.
         */
        ip: isIP(request.ip) ? request.ip : null,
        userAgent: request.headers['user-agent']?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
      }),
  );
};
