import { availabilityBulkUpdateSchema, availabilitySchema } from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole } from '../../lib/guards.js';
import { listOwnAvailability, setOwnAvailability } from './availability.service.js';

const AVAILABILITY_PATH = '/vendor/availability';

const availabilityListSchema = z.array(availabilitySchema);

export const availabilityRoutes: FastifyPluginAsyncZod = async (app) => {
  const vendorOnly = requireRole('vendor');

  app.get(
    AVAILABILITY_PATH,
    { preHandler: vendorOnly, schema: { response: { 200: availabilityListSchema } } },
    async (request) => listOwnAvailability(app.db, assertRole(request.auth, ['vendor']).id),
  );

  app.put(
    AVAILABILITY_PATH,
    {
      preHandler: vendorOnly,
      schema: { body: availabilityBulkUpdateSchema, response: { 200: availabilityListSchema } },
    },
    async (request) =>
      setOwnAvailability(app.db, assertRole(request.auth, ['vendor']).id, request.body),
  );
};
