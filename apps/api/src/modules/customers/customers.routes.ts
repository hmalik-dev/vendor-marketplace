import {
  customerProfileSchema,
  customerReviewSchema,
  uuidSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuth, requireRole } from '../../lib/guards.js';
import {
  getCustomerProfileForVendor,
  listCustomerReviews,
  listOwnReviews,
} from './customers.service.js';

const customerParamsSchema = z.object({ customerId: uuidSchema });
const reviewListSchema = z.array(customerReviewSchema);

export const customerRoutes: FastifyPluginAsyncZod = async (app) => {
  /*
   * Declared before `/customers/:customerId/...` so the literal segment wins
   * the match — "me" is not a uuid and the param schema would 400 on it first.
   */
  app.get(
    '/customers/me/reviews',
    { preHandler: requireRole('customer'), schema: { response: { 200: reviewListSchema } } },
    async (request) => listOwnReviews(app.db, authenticated(request.auth)),
  );

  /**
   * Tiered: the response shape itself changes with the booking relationship,
   * which is resolved server-side. There is no parameter that asks for a tier.
   */
  app.get(
    '/customers/:customerId/profile',
    {
      preHandler: requireAuth,
      schema: { params: customerParamsSchema, response: { 200: customerProfileSchema } },
    },
    async (request) =>
      getCustomerProfileForVendor(app.db, authenticated(request.auth), request.params.customerId),
  );

  app.get(
    '/customers/:customerId/reviews',
    {
      preHandler: requireAuth,
      schema: { params: customerParamsSchema, response: { 200: reviewListSchema } },
    },
    async (request) =>
      listCustomerReviews(app.db, authenticated(request.auth), request.params.customerId),
  );
};
