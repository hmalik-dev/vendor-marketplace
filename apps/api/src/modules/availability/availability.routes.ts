import { availabilityBulkUpdateSchema, availabilitySchema } from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole } from '../../lib/guards.js';
import { listOwnAvailability, setOwnAvailability } from './availability.service.js';

const AVAILABILITY_PATH = '/vendor/availability';

const availabilityListSchema = z.array(availabilitySchema);

/**
 * Both handlers take today from `app.clock()` rather than letting the service
 * fall back to `new Date()`. The calendar's floor and the nearby-availability
 * window are the same day expressed twice; when they came from two independent
 * clocks a suite could write a blocked date through one and have the other
 * treat it as unwritten.
 */
export const availabilityRoutes: FastifyPluginAsyncZod = async (app) => {
  const vendorOnly = requireRole('vendor');

  app.get(
    AVAILABILITY_PATH,
    { preHandler: vendorOnly, schema: { response: { 200: availabilityListSchema } } },
    async (request) =>
      listOwnAvailability(app.db, assertRole(request.auth, ['vendor']).id, app.clock()),
  );

  app.put(
    AVAILABILITY_PATH,
    {
      preHandler: vendorOnly,
      schema: { body: availabilityBulkUpdateSchema, response: { 200: availabilityListSchema } },
    },
    async (request) =>
      setOwnAvailability(
        app.db,
        assertRole(request.auth, ['vendor']).id,
        request.body,
        app.clock(),
      ),
  );
};
