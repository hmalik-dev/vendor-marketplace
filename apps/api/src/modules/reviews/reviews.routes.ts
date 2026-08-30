import {
  createReviewSchema,
  MAX_PAGE,
  reviewSchema,
  slugSchema,
  uuidSchema,
  vendorReviewsPageSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuth } from '../../lib/guards.js';
import { createReview, getVendorReviews } from './reviews.service.js';

const bookingParamsSchema = z.object({ bookingId: uuidSchema });
const vendorSlugParamsSchema = z.object({ slug: slugSchema });
const reviewsQuerySchema = z.object({
  /*
   * Coerced, floored and capped, because this is a URL. `?page=0` and
   * `?page=-1` are both reachable by hand and both turn into a negative
   * OFFSET, which Postgres rejects — a 500 for a string anyone can paste. The
   * ceiling is `paginationQuerySchema`'s, for the reason stated there; without
   * it the offset band above it was reachable and untested.
   */
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1).default(1),
});

export const reviewRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * The Reviews tab. Unauthenticated for the same reason the profile is — the
   * reviews are most of why someone opens the page.
   *
   * `requireAuth` is deliberately absent rather than optional-with-a-guard: the
   * auth plugin already resolves `request.auth` to `null` for a signed-out
   * caller, and the `viewer` block is built from that. A signed-in reader gets
   * their own eligibility in the same payload; a signed-out one gets a `viewer`
   * that permits nothing.
   */
  app.get(
    '/vendors/:slug/reviews',
    {
      schema: {
        params: vendorSlugParamsSchema,
        querystring: reviewsQuerySchema,
        response: { 200: vendorReviewsPageSchema },
      },
    },
    async (request) =>
      getVendorReviews(app.db, request.params.slug, request.query.page, request.auth?.id ?? null),
  );

  /**
   * Filed against the booking, which is what makes the review provable.
   *
   * The booking is in the **path**, not the body: it is the resource being
   * reviewed, and putting it in the body would let a client change which
   * booking a review belongs to without changing the URL it posted to.
   *
   * Which review type this becomes is decided server-side from the booking's
   * two parties — never from a field the client sends.
   */
  app.post(
    '/bookings/:bookingId/reviews',
    {
      preHandler: requireAuth,
      schema: {
        params: bookingParamsSchema,
        body: createReviewSchema,
        response: { 201: reviewSchema },
      },
    },
    /*
     * 201 with no `Location`, which deviates from `api-layering.md` knowingly:
     * a review has no addressable resource of its own to point at. There is no
     * `GET /reviews/:id` and no reason to build one — a review is read as part
     * of the vendor's tab or the customer's own list, never alone — and a
     * header pointing at a collection is not what `Location` means. Follows the
     * one prior omission at `messaging.routes.ts`.
     */
    async (request, reply) => {
      const created = await createReview(
        app.db,
        app.events,
        authenticated(request.auth).id,
        request.params.bookingId,
        request.body,
      );

      return reply.status(201).send(created);
    },
  );
};
