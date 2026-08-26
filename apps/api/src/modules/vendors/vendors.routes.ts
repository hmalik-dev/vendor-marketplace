import {
  createVendorProfileSchema,
  updateVendorProfileSchema,
  vendorProfileDetailSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole } from '../../lib/guards.js';
import { requireRole } from '../../lib/guards.js';
import {
  createVendorProfile,
  getOwnVendorProfile,
  updateVendorProfile,
} from './vendors.service.js';

/** Where a vendor's own profile lives, used as the `Location` on creation. */
const OWN_PROFILE_PATH = '/vendor/profile';

export const vendorRoutes: FastifyPluginAsyncZod = async (app) => {
  const vendorOnly = requireRole('vendor');

  app.get(
    OWN_PROFILE_PATH,
    { preHandler: vendorOnly, schema: { response: { 200: vendorProfileDetailSchema } } },
    async (request) => getOwnVendorProfile(app.db, assertRole(request.auth, ['vendor']).id),
  );

  app.post(
    OWN_PROFILE_PATH,
    {
      preHandler: vendorOnly,
      schema: { body: createVendorProfileSchema, response: { 201: vendorProfileDetailSchema } },
    },
    async (request, reply) => {
      const profile = await createVendorProfile(
        app.db,
        assertRole(request.auth, ['vendor']).id,
        request.body,
      );

      return reply.status(201).header('location', OWN_PROFILE_PATH).send(profile);
    },
  );

  app.put(
    OWN_PROFILE_PATH,
    {
      preHandler: vendorOnly,
      schema: { body: updateVendorProfileSchema, response: { 200: vendorProfileDetailSchema } },
    },
    async (request) =>
      updateVendorProfile(app.db, assertRole(request.auth, ['vendor']).id, request.body),
  );
};
