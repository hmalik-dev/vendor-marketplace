import {
  createVendorProfileSchema,
  updateVendorProfileSchema,
  vendorProfileDetailSchema,
  vendorSearchQuerySchema,
  vendorSearchResultSchema,
  publicVendorProfileSchema,
  vendorSlugParamsSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import { availabilitySchema } from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole } from '../../lib/guards.js';
import { requireRole } from '../../lib/guards.js';
import {
  createVendorProfile,
  getOwnVendorProfile,
  searchPublishedVendors,
  updateVendorProfile,
} from './vendors.service.js';
import { getPublicVendorAvailability, getPublicVendorProfile } from './vendor-profile.service.js';

/** Where a vendor's own profile lives, used as the `Location` on creation. */
const OWN_PROFILE_PATH = '/vendor/profile';

export const vendorRoutes: FastifyPluginAsyncZod = async (app) => {
  const vendorOnly = requireRole('vendor');

  /*
   * Public and unauthenticated: discovery is the front door, and requiring an
   * account to look is how a marketplace stays empty. Only published,
   * non-deleted vendors are ever visible.
   */
  app.get(
    '/vendors',
    {
      schema: {
        querystring: vendorSearchQuerySchema,
        response: { 200: vendorSearchResultSchema },
      },
    },
    async (request) => searchPublishedVendors(app.db, request.query),
  );

  /**
   * The public profile — frame `03`. Unauthenticated for the same reason the
   * search is: the page where the decision happens cannot sit behind a sign-up.
   */
  app.get(
    '/vendors/:slug',
    {
      schema: {
        params: vendorSlugParamsSchema,
        response: { 200: publicVendorProfileSchema },
      },
    },
    async (request) => getPublicVendorProfile(app.db, request.params.slug),
  );

  /** The calendar behind the profile's Availability tab. */
  app.get(
    '/vendors/:slug/availability',
    {
      schema: {
        params: vendorSlugParamsSchema,
        response: { 200: z.array(availabilitySchema) },
      },
    },
    async (request) => getPublicVendorAvailability(app.db, request.params.slug),
  );

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
