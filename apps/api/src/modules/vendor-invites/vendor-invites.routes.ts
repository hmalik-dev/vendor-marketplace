import { clientAddress } from '../../lib/client-address.js';
import { z } from 'zod';
import {
  adminVendorApplicationListSchema,
  adminVendorApplicationRowSchema,
  adminVendorInviteListSchema,
  adminVendorInviteQuerySchema,
  adminVendorInviteRowSchema,
  bulkInviteApplicationsResultSchema,
  bulkInviteApplicationsSchema,
  createVendorInviteSchema,
  decideVendorApplicationSchema,
  myVendorApplicationSchema,
  vendorApplicationInputSchema,
  vendorApplicationReceiptSchema,
  vendorSignUpGateSchema,
} from '@vendor-marketplace/shared';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  assertRole,
  authSubject,
  requireAuthSubject,
  requireRoleBeforeValidation,
} from '../../lib/guards.js';
import {
  bulkInviteApplications,
  createVendorInvite,
  decideVendorApplication,
  listVendorApplications,
  listVendorInvites,
  readMyVendorApplication,
  readVendorSignUpGate,
  resendVendorInvite,
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

function mailDeps(app: FastifyInstance, webOrigin: string): VendorInviteMailDeps {
  return {
    db: app.db,
    email: app.email,
    background: app.background,
    log: app.log,
    webOrigin,
    now: app.clock,
  };
}

/** The vendor gate's public half (VEN-406): whether it is on, and the waitlist form. */
export const vendorApplicationRoutes: FastifyPluginAsyncZod<VendorInviteRoutesOptions> = async (
  app,
  options,
) => {
  app.get(
    '/vendor-applications/gate',
    { schema: { response: { 200: vendorSignUpGateSchema } } },
    async () => readVendorSignUpGate(app.db),
  );

  const applicationKeyGenerator = (request: {
    authIdentity: { authUserId: string } | null;
    ip: string;
    headers: Record<string, string | string[] | undefined>;
  }): string => request.authIdentity?.authUserId ?? clientAddress(request);

  app.get(
    '/vendor-applications/me',
    {
      /*
       * A verified session, no account row required: this is exactly the
       * refused-vendor session `/sign-up/vendor-details` is for. Like the
       * Terms gate's own routes, this authorises on the Auth subject rather
       * than on `request.auth` — there may be no local row yet.
       *
       * No route-level `rateLimit`: this is a read the details and waitlist
       * screens make on every visit, not a write, so it takes the global
       * per-minute limiter like any other authenticated `GET` rather than
       * `POST`'s stricter per-hour write budget.
       */
      onRequest: requireAuthSubject,
      schema: { response: { 200: myVendorApplicationSchema } },
    },
    async (request) => {
      const identity = authSubject(request.authIdentity);
      const { email } = await identity.loadSnapshot();

      return readMyVendorApplication(app.db, email);
    },
  );

  app.post(
    '/vendor-applications',
    {
      // A verified session only (VEN-512): the gate is the sole door onto this route now.
      preParsing: requireAuthSubject,
      config: { rateLimit: { ...APPLICATION_RATE_LIMIT, keyGenerator: applicationKeyGenerator } },
      schema: {
        body: vendorApplicationInputSchema,
        response: { 200: vendorApplicationReceiptSchema },
      },
    },
    /* 200, not 201: the caller gets nothing addressable, and a repeat is the same answer. */
    async (request) => {
      const identity = authSubject(request.authIdentity);
      const { email } = await identity.loadSnapshot();

      return submitVendorApplication(mailDeps(app, options.webOrigin), request.body, email);
    },
  );
};

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

  /* 200: an action, not a creation — a per-id result, never a single Location. */
  app.post(
    '/admin/vendor-applications/invite',
    {
      onRequest: adminOnly,
      schema: {
        body: bulkInviteApplicationsSchema,
        response: { 200: bulkInviteApplicationsResultSchema },
      },
    },
    async (request) =>
      bulkInviteApplications(
        mailDeps(app, options.webOrigin),
        assertRole(request.auth, ['admin']).id,
        request.body.applicationIds,
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

      return reply
        .code(201)
        .header('location', `${app.prefix}/admin/vendor-invites/${invite.id}`)
        .send(invite);
    },
  );

  /* 200: an action on an existing invite, not a creation. */
  app.post(
    '/admin/vendor-invites/:inviteId/resend',
    {
      onRequest: adminOnly,
      schema: { params: inviteParamsSchema, response: { 200: adminVendorInviteRowSchema } },
    },
    async (request) =>
      resendVendorInvite(mailDeps(app, options.webOrigin), request.params.inviteId),
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
