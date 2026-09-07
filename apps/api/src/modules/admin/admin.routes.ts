import { z } from 'zod';
import {
  adminActivityPageSchema,
  adminActivityQuerySchema,
  adminBanResultSchema,
  adminBookingPageSchema,
  adminBookingQuerySchema,
  adminCloseAccountResultSchema,
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
  adminUserDataRightsSchema,
  adminUserExportSchema,
  adminVendorFacetsSchema,
  adminVendorPageSchema,
  adminVendorQuerySchema,
  bookingSchema,
  resolveDisputeSchema,
  resolveTagSuggestionSchema,
  updateTagSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import {
  deleteReview,
  listActivity,
  listBookings,
  listCustomers,
  listPayments,
  listReviews,
  listTagSuggestions,
  listTags,
  listVendors,
  readMetrics,
  readVendorFacets,
  resolveBookingDispute,
  resolveTagSuggestion,
  setUserBanned,
  updateTag,
  type AdminContext,
} from './admin.service.js';
import { closeAccount, exportUserData, readUserDataRights } from './data-rights.service.js';
import { bookingContextFor } from '../payments/payments.service.js';

const userParamsSchema = z.object({ userId: z.uuid() });
const reviewParamsSchema = z.object({ reviewId: z.uuid() });
const suggestionParamsSchema = z.object({ suggestionId: z.uuid() });
const tagParamsSchema = z.object({ tagId: z.uuid() });
const bookingParamsSchema = z.object({ bookingId: z.uuid() });

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

  const context = (): AdminContext => bookingContextFor(app, app.log, options.webOrigin);

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

  /**
   * The record one account leaves behind — what is still held, and the legal
   * acceptances behind it (#438).
   *
   * Reads a **closed** account as well as a live one, which is the point: the
   * privacy policy promises records are kept, so the console has to show what
   * is still held rather than an empty screen implying the person is gone.
   */
  app.get(
    '/admin/users/:userId/data-rights',
    {
      onRequest: adminOnly,
      schema: { params: userParamsSchema, response: { 200: adminUserDataRightsSchema } },
    },
    async (request) => readUserDataRights(app.db, request.params.userId, app.clock()),
  );

  /**
   * *"Ask us for a copy of what we hold"*, answered (#438).
   *
   * `POST` on a read, deliberately. It is an action rather than a resource: it
   * hands a whole person's file to somebody and writes the audit row that says
   * who asked for it, and a `GET` invites the caching, prefetching and
   * link-sharing that a subject-access response must not get.
   */
  app.post(
    '/admin/users/:userId/export',
    {
      onRequest: adminOnly,
      schema: { params: userParamsSchema, response: { 200: adminUserExportSchema } },
    },
    async (request) =>
      exportUserData(context(), assertRole(request.auth, ['admin']).id, request.params.userId),
  );

  /**
   * *"To close your account, ask us through Contact support"*, answered — and
   * refused where D39 says it must be (#438).
   *
   * The refusal is a 409 naming the upcoming confirmed bookings the customer
   * has to cancel first, which routes them through D3's tiers.
   *
   * **It prices nothing against the account holder, which is not the same as
   * refunding nothing.** D39 refuses a closure while the holder's own forward
   * bookings stand precisely so this route never has to price one — and rules
   * the other direction for a vendor, whose customers are refunded in full by
   * #433's shared unwind because the vendor walked away and they did not. No
   * new money path is created here either way; the unwind's is reused.
   */
  app.post(
    '/admin/users/:userId/close',
    {
      onRequest: adminOnly,
      schema: { params: userParamsSchema, response: { 200: adminCloseAccountResultSchema } },
    },
    async (request) =>
      closeAccount(
        context(),
        assertRole(request.auth, ['admin']).id,
        request.params.userId,
        app.clock(),
      ),
  );

  /**
   * An operator settles a reported problem, one way or the other (#423).
   *
   * Here rather than in the payments plugin because the actor is an operator
   * and every route in this file is `admin` and nothing else — a dispute
   * resolution exposed on a customer- or vendor-guarded plugin would let one
   * party to the disagreement decide it. The money it moves is still
   * `payments.service.ts`'s: `resolveBookingDispute` is a wrapper that calls
   * the same function with this plugin's context, and adds the one thing only
   * this plugin knows — which operator ruled (#434).
   *
   * Deliberately not a case-management product. The hold needs an off switch
   * with two positions and it has one; the admin surfaces that already exist
   * are where an operator reads the booking.
   */
  app.put(
    '/admin/bookings/:bookingId/dispute',
    {
      onRequest: adminOnly,
      schema: {
        params: bookingParamsSchema,
        body: resolveDisputeSchema,
        response: { 200: bookingSchema },
      },
    },
    async (request) =>
      resolveBookingDispute(
        context(),
        assertRole(request.auth, ['admin']).id,
        request.params.bookingId,
        request.body.outcome,
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
    async (request) => listBookings(app.db, request.query, app.clock()),
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
      resolveTagSuggestion(
        context(),
        assertRole(request.auth, ['admin']).id,
        request.params.suggestionId,
        request.body,
        app.clock(),
      ),
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
    async (request) =>
      updateTag(
        context(),
        assertRole(request.auth, ['admin']).id,
        request.params.tagId,
        request.body,
      ),
  );

  /**
   * What the console has done, and who did it (#434).
   *
   * A read of `admin_actions`, which every mutating route above writes to. The
   * subject filter is what makes it usable rather than a firehose: it is the
   * answer to "what did the console do to this account", which is the question
   * an operator actually arrives with.
   *
   * `admin` like everything else here, and pointedly so — the log records
   * actions taken on other people's accounts, so reading it is itself a
   * privileged read.
   */
  app.get(
    '/admin/activity',
    {
      onRequest: adminOnly,
      schema: {
        querystring: adminActivityQuerySchema,
        response: { 200: adminActivityPageSchema },
      },
    },
    async (request) => listActivity(app.db, request.query),
  );
};
