import { z } from 'zod';
import {
  adminVendorApplicationListSchema,
  adminVendorApplicationRowSchema,
  adminVendorInviteListSchema,
  adminVendorInviteQuerySchema,
  adminVendorInviteRowSchema,
  createVendorInviteSchema,
  decideVendorApplicationSchema,
  vendorApplicationInputSchema,
  vendorApplicationReceiptSchema,
  vendorSignUpGateSchema,
} from '@vendor-marketplace/shared';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import {
  createVendorInvite,
  decideVendorApplication,
  listVendorApplications,
  listVendorInvites,
  readVendorSignUpGate,
  revokeVendorInvite,
  submitVendorApplication,
  type VendorInviteMailDeps,
} from './vendor-invites.service.js';

export interface VendorInviteRoutesOptions {
  /** `canonicalWebOrigin(env)`, which the invite email's sign-up link is built on. */
  webOrigin: string;
}

/**
 * The same allowance `/support/messages` has, for the same reason: the route is
 * public and writes a row per call, and the global limiter is sized for reads.
 */
const APPLICATION_RATE_LIMIT = { max: 6, timeWindow: '1 hour' } as const;

const inviteParamsSchema = z.object({ inviteId: z.uuid() });
const applicationParamsSchema = z.object({ applicationId: z.uuid() });

/** The vendor gate's public half (VEN-406): whether it is on, and the waitlist form. */
export const vendorApplicationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/vendor-applications/gate',
    { schema: { response: { 200: vendorSignUpGateSchema } } },
    async () => readVendorSignUpGate(app.db),
  );

  app.post(
    '/vendor-applications',
    {
      /*
       * Deliberately unauthenticated: the applicant the gate sends here has a
       * Auth session and no account, and a visitor from `/for-vendors` has
       * neither. Keyed by account where there is one, by IP where there is not.
       */
      config: {
        rateLimit: {
          ...APPLICATION_RATE_LIMIT,
          keyGenerator: (request: { auth: { id: string } | null; ip: string }) =>
            request.auth?.id ?? request.ip,
        },
      },
      schema: {
        body: vendorApplicationInputSchema,
        response: { 200: vendorApplicationReceiptSchema },
      },
    },
    /* 200, not 201: the caller gets nothing addressable, and a repeat is the same answer. */
    async (request) =>
      submitVendorApplication(
        app.db,
        request.body,
        request.authIdentity ? (await request.authIdentity.loadSnapshot()).email : null,
      ),
  );
};

function mailDeps(app: FastifyInstance, webOrigin: string): VendorInviteMailDeps {
  return {
    db: app.db,
    email: app.email,
    background: app.background,
    log: app.log,
    webOrigin,
  };
}

/**
 * The vendor gate's console half (VEN-406): the waitlist, and the invites.
 * `admin` only, on `onRequest`, like every other console route.
 */
export const adminVendorInviteRoutes: FastifyPluginAsyncZod<VendorInviteRoutesOptions> = async (
  app,
  options,
) => {
  const adminOnly = requireRoleBeforeValidation('admin');

  app.get(
    '/admin/vendor-applications',
    {
      onRequest: adminOnly,
      schema: {
        querystring: adminVendorInviteQuerySchema,
        response: { 200: adminVendorApplicationListSchema },
      },
    },
    async (request) => listVendorApplications(app.db, request.query),
  );

  app.put(
    '/admin/vendor-applications/:applicationId',
    {
      onRequest: adminOnly,
      schema: {
        params: applicationParamsSchema,
        body: decideVendorApplicationSchema,
        response: { 200: adminVendorApplicationRowSchema },
      },
    },
    async (request) =>
      decideVendorApplication(
        mailDeps(app, options.webOrigin),
        assertRole(request.auth, ['admin']).id,
        request.params.applicationId,
        request.body.decision,
      ),
  );

  app.get(
    '/admin/vendor-invites',
    {
      onRequest: adminOnly,
      schema: {
        querystring: adminVendorInviteQuerySchema,
        response: { 200: adminVendorInviteListSchema },
      },
    },
    async (request) => listVendorInvites(app.db, request.query),
  );

  app.post(
    '/admin/vendor-invites',
    {
      onRequest: adminOnly,
      schema: { body: createVendorInviteSchema, response: { 201: adminVendorInviteRowSchema } },
    },
    async (request, reply) => {
      const invite = await createVendorInvite(
        mailDeps(app, options.webOrigin),
        assertRole(request.auth, ['admin']).id,
        request.body.email,
      );

      return reply.code(201).header('location', `/admin/vendor-invites/${invite.id}`).send(invite);
    },
  );

  app.delete(
    '/admin/vendor-invites/:inviteId',
    { onRequest: adminOnly, schema: { params: inviteParamsSchema } },
    async (request, reply) => {
      await revokeVendorInvite(
        app.db,
        assertRole(request.auth, ['admin']).id,
        request.params.inviteId,
      );

      return reply.code(204).send();
    },
  );
};
