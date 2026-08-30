import {
  createReviewSchema,
  reviewSchema,
  uuidSchema,
  vendorReviewsPageSchema,
  vendorReviewsQuerySchema,
  vendorSlugParamsSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuth } from '../../lib/guards.js';
import { createReview, getBookingReviews, getVendorReviews } from './reviews.service.js';

const bookingParamsSchema = z.object({ bookingId: uuidSchema });
const reviewListSchema = z.array(reviewSchema);

export const reviewRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/reviews',
    {
      preHandler: requireAuth,
      schema: {
        body: createReviewSchema,
        response: { 201: reviewSchema },
      },
    },
    async (request, reply) => {
      const review = await createReview(
        app.db,
        app.events,
        authenticated(request.auth),
        request.body,
      );

      return reply
        .status(201)
        .header('location', `/bookings/${review.bookingId}/reviews`)
        .send(review);
    },
  );

  /** Both reviews on one booking, when they exist — never more than two. */
  app.get(
    '/bookings/:bookingId/reviews',
    {
      preHandler: requireAuth,
      schema: { params: bookingParamsSchema, response: { 200: reviewListSchema } },
    },
    async (request) =>
      getBookingReviews(app.db, authenticated(request.auth), request.params.bookingId),
  );

  /**
   * Public and unauthenticated, like the profile it fills — frame `03`'s
   * Reviews tab. `page`/`limit` rather than `page`/`pageSize`: "Show more
   * reviews" appends, and never renders page numbers.
   */
  app.get(
    '/vendors/:slug/reviews',
    {
      schema: {
        params: vendorSlugParamsSchema,
        querystring: vendorReviewsQuerySchema,
        response: { 200: vendorReviewsPageSchema },
      },
    },
    async (request) => getVendorReviews(app.db, request.params.slug, request.query),
  );
};
