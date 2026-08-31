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
import { assertRole, requireRoleBeforeValidation } from '../../lib/guards.js';
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
export interface AdminRoutesOptions {
  /** `canonicalWebOrigin(env)` — the origin every emailed link is built from. */
  webOrigin: string;
}

export const adminRoutes: FastifyPluginAsyncZod<AdminRoutesOptions> = async (app, options) => {
  /*
   * `onRequest`, not `preHandler`, on **every** route in this plugin.
   *
   * Fastify runs `preHandler` *after* validation, so an anonymous
   * `GET /admin/vendors?status=bogus` answered 400 with the enum's members in
   * `details.params.values` where the same request without a query answered
   * 401 — schema disclosure on the one plugin that reads other people's
   * accounts. The four mutating routes already used the earlier hook for the
   * neighbouring reason (a malformed body tripping the JSON parser, whose 400
   * would outrun the 403 a wrong-role caller is owed); the reads now share it.
   *
   * Nothing is lost by moving: the guard reads the local `users.role` column
   * and needs nothing the validator produces.
   */
  const adminOnly = requireRoleBeforeValidation('admin');

  const context = (): AdminContext => ({
    db: app.db,
    stripe: app.stripe,
    hub: app.events,
    log: app.log,
    mail: { db: app.db, email: app.email, log: app.log, webOrigin: options.webOrigin },
  });

  app.get(
    '/admin/vendors',
    {
      onRequest: adminOnly,
      schema: {
        querystring: adminVendorQuerySchema,
        response: { 200: adminVendorPageSchema },
      },
    },
    async (request) => listVendors(app.db, request.query),
  );

  app.put(
    '/admin/users/:userId/ban',
    {
      onRequest: adminOnly,
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
      onRequest: adminOnly,
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
    { onRequest: adminOnly, schema: { response: { 200: adminMetricsSchema } } },
    async () => readMetrics(app.db, app.clock()),
  );

  /*
   * Registered before `/admin/vendors` would ever shadow it — it would not, the
   * paths differ in depth — but kept adjacent to the list it feeds so the two
   * cannot drift into offering filters over values the table does not hold.
   */
  app.get(
    '/admin/vendors/facets',
    { onRequest: adminOnly, schema: { response: { 200: adminVendorFacetsSchema } } },
    async () => readVendorFacets(app.db),
  );

  app.get(
    '/admin/customers',
    {
      onRequest: adminOnly,
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
      onRequest: adminOnly,
      schema: { querystring: adminBookingQuerySchema, response: { 200: adminBookingPageSchema } },
    },
    async (request) => listBookings(app.db, request.query),
  );

  app.get(
    '/admin/payments',
    {
      onRequest: adminOnly,
      schema: { querystring: adminPaymentQuerySchema, response: { 200: adminPaymentPageSchema } },
    },
    async (request) => listPayments(app.db, request.query),
  );

  app.get(
    '/admin/reviews',
    {
      onRequest: adminOnly,
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
      onRequest: adminOnly,
      schema: { params: reviewParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await deleteReview(
        context(),
        assertRole(request.auth, ['admin']).id,
        request.params.reviewId,
      );

      return reply.status(204).send(null);
    },
  );

  app.get(
    '/admin/tag-suggestions',
    {
      onRequest: adminOnly,
      schema: {
        querystring: adminTagSuggestionQuerySchema,
        response: { 200: adminTagSuggestionPageSchema },
      },
    },
    async (request) => listTagSuggestions(app.db, request.query),
  );

  app.put(
    '/admin/tag-suggestions/:suggestionId',
    {
      onRequest: adminOnly,
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
    { onRequest: adminOnly, schema: { response: { 200: adminTagListSchema } } },
    async () => listTags(app.db),
  );

  app.put(
    '/admin/tags/:tagId',
    {
      onRequest: adminOnly,
      schema: {
        params: tagParamsSchema,
        body: updateTagSchema,
        response: { 200: adminTagRowSchema },
      },
    },
    async (request) => updateTag(app.db, request.params.tagId, request.body),
  );
};
