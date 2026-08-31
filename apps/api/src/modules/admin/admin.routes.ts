import { z } from 'zod';
import {
  adminBanResultSchema,
  adminBookingPageSchema,
  adminBookingQuerySchema,
  adminCustomerPageSchema,
  adminCustomerQuerySchema,
  adminMetricsSchema,
  adminPaymentPageSchema,
  adminPaymentQuerySchema,
  adminReviewPageSchema,
  adminReviewQuerySchema,
  adminTagListSchema,
  adminTagRowSchema,
  adminTagSuggestionPageSchema,
  adminTagSuggestionQuerySchema,
  adminTagSuggestionResultSchema,
  adminVendorFacetsSchema,
  adminVendorPageSchema,
  adminVendorQuerySchema,
  resolveTagSuggestionSchema,
  updateTagSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import {
  deleteReview,
  listBookings,
  listCustomers,
  listPayments,
  listReviews,
  listTagSuggestions,
  listTags,
  listVendors,
  readMetrics,
  readVendorFacets,
  resolveTagSuggestion,
  setUserBanned,
  updateTag,
  type AdminContext,
} from './admin.service.js';

const userParamsSchema = z.object({ userId: z.uuid() });
const reviewParamsSchema = z.object({ reviewId: z.uuid() });
const suggestionParamsSchema = z.object({ suggestionId: z.uuid() });
const tagParamsSchema = z.object({ tagId: z.uuid() });

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

  app.get(
    '/admin/metrics',
    { preHandler: adminOnly, schema: { response: { 200: adminMetricsSchema } } },
    async () => readMetrics(app.db, app.clock()),
  );

  /*
   * Registered before `/admin/vendors` would ever shadow it — it would not, the
   * paths differ in depth — but kept adjacent to the list it feeds so the two
   * cannot drift into offering filters over values the table does not hold.
   */
  app.get(
    '/admin/vendors/facets',
    { preHandler: adminOnly, schema: { response: { 200: adminVendorFacetsSchema } } },
    async () => readVendorFacets(app.db),
  );

  app.get(
    '/admin/customers',
    {
      preHandler: adminOnly,
      schema: {
        querystring: adminCustomerQuerySchema,
        response: { 200: adminCustomerPageSchema },
      },
    },
    async (request) => listCustomers(app.db, request.query),
  );

  app.get(
    '/admin/bookings',
    {
      preHandler: adminOnly,
      schema: { querystring: adminBookingQuerySchema, response: { 200: adminBookingPageSchema } },
    },
    async (request) => listBookings(app.db, request.query),
  );

  app.get(
    '/admin/payments',
    {
      preHandler: adminOnly,
      schema: { querystring: adminPaymentQuerySchema, response: { 200: adminPaymentPageSchema } },
    },
    async (request) => listPayments(app.db, request.query),
  );

  app.get(
    '/admin/reviews',
    {
      preHandler: adminOnly,
      schema: { querystring: adminReviewQuerySchema, response: { 200: adminReviewPageSchema } },
    },
    async (request) => listReviews(app.db, request.query),
  );

  /*
   * Deleting a review re-derives the rating it contributed to — see
   * `deleteReviewAndRecalculate`. 204: there is nothing left to return, and the
   * recomputed rating belongs to the vendor's own row rather than to this
   * response.
   */
  app.delete(
    '/admin/reviews/:reviewId',
    {
      preHandler: adminOnly,
      schema: { params: reviewParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await deleteReview(app.db, request.params.reviewId);

      return reply.status(204).send(null);
    },
  );

  app.get(
    '/admin/tag-suggestions',
    {
      preHandler: adminOnly,
      schema: {
        querystring: adminTagSuggestionQuerySchema,
        response: { 200: adminTagSuggestionPageSchema },
      },
    },
    async (request) => listTagSuggestions(app.db, request.query),
  );

  // `onRequest`, for the reason given above `PUT /admin/users/:userId/ban`.
  app.put(
    '/admin/tag-suggestions/:suggestionId',
    {
      onRequest: requireRoleBeforeValidation('admin'),
      schema: {
        params: suggestionParamsSchema,
        body: resolveTagSuggestionSchema,
        response: { 200: adminTagSuggestionResultSchema },
      },
    },
    async (request) =>
      resolveTagSuggestion(context(), request.params.suggestionId, request.body, app.clock()),
  );

  app.get(
    '/admin/tags',
    { preHandler: adminOnly, schema: { response: { 200: adminTagListSchema } } },
    async () => listTags(app.db),
  );

  app.put(
    '/admin/tags/:tagId',
    {
      onRequest: requireRoleBeforeValidation('admin'),
      schema: {
        params: tagParamsSchema,
        body: updateTagSchema,
        response: { 200: adminTagRowSchema },
      },
    },
    async (request) => updateTag(app.db, request.params.tagId, request.body),
  );
};
