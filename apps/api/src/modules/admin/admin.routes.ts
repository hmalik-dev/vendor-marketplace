import { z } from 'zod';
import {
  adminBanResultSchema,
  adminVendorPageSchema,
  adminVendorQuerySchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import { listVendors, setUserBanned, type AdminContext } from './admin.service.js';

const userParamsSchema = z.object({ userId: z.uuid() });

/**
 * The operations control plane (#15).
 *
 * Every route here is `admin` and nothing else — an unguarded route beside these
 * would be a privilege-escalation defect, not a style problem, because these
 * read and write other people's accounts by design.
 *
 * The role is read from the local `users.role` column by `requireRole`, never
 * from Clerk metadata: the account holder can write that field, and `admin` is
 * refused at sync (`normalizeRole`) precisely so it can only be granted here.
 */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  const adminOnly = requireRole('admin');

  const context = (): AdminContext => ({
    db: app.db,
    stripe: app.stripe,
    hub: app.events,
    log: app.log,
  });

  app.get(
    '/admin/vendors',
    {
      preHandler: adminOnly,
      schema: {
        querystring: adminVendorQuerySchema,
        response: { 200: adminVendorPageSchema },
      },
    },
    async (request) => listVendors(app.db, request.query),
  );

  /*
   * `onRequest` rather than `preHandler`, and no body schema.
   *
   * A ban is guarded by role alone, so a wrong-role caller can send a payload
   * malformed enough to trip Fastify's own JSON parser — and that 400 would
   * outrun the 403 this route owes them. The same reasoning as
   * `POST /vendor/stripe/connect`; see `requireRoleBeforeValidation`.
   */
  app.put(
    '/admin/users/:userId/ban',
    {
      onRequest: requireRoleBeforeValidation('admin'),
      schema: { params: userParamsSchema, response: { 200: adminBanResultSchema } },
    },
    async (request) =>
      setUserBanned(
        context(),
        assertRole(request.auth, ['admin']).id,
        request.params.userId,
        true,
        app.clock(),
      ),
  );

  app.put(
    '/admin/users/:userId/unban',
    {
      onRequest: requireRoleBeforeValidation('admin'),
      schema: { params: userParamsSchema, response: { 200: adminBanResultSchema } },
    },
    async (request) =>
      setUserBanned(
        context(),
        assertRole(request.auth, ['admin']).id,
        request.params.userId,
        false,
        app.clock(),
      ),
  );
};
