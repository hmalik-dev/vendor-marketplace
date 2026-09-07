import {
  bookingSchema,
  bookingWithContextSchema,
  cancelBookingSchema,
  cancelledBookingSchema,
  checkoutIntentSchema,
  uuidSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuth } from '../../lib/guards.js';
import { notFound } from '../../lib/errors.js';
import {
  bookingContextFor,
  cancelBooking,
  completeBooking,
  findOwnBookingForReport,
  openCheckout,
  reconcileBooking,
  type PaymentContext,
} from './payments.service.js';

const requestParamsSchema = z.object({ requestId: uuidSchema });
const bookingParamsSchema = z.object({ bookingId: uuidSchema });

export interface PaymentRoutesOptions {
  /** `STRIPE_PLATFORM_FEE_RATE`, resolved and coerced at boot. */
  platformFeeRate: number;
  /** `canonicalWebOrigin(env)` — the origin every emailed link is built from. */
  webOrigin: string;
}

export const paymentRoutes: FastifyPluginAsyncZod<PaymentRoutesOptions> = async (app, options) => {
  const contextFor = (log: PaymentContext['log']): PaymentContext => ({
    ...bookingContextFor(app, log, options.webOrigin),
    platformFeeRate: options.platformFeeRate,
  });

  /*
   * POST because it can create the intent, and 200 rather than 201 because what
   * it returns is not a resource of this API's — the intent lives at Stripe, and
   * a `Location` pointing at something the client cannot fetch would be worse
   * than none. Repeating the call is the supported path, not an error: it is how
   * a reopened checkout tab finds its way back to the same charge.
   */
  app.post(
    '/customer/booking-requests/:requestId/checkout',
    {
      preHandler: requireAuth,
      schema: { params: requestParamsSchema, response: { 200: checkoutIntentSchema } },
    },
    async (request) =>
      openCheckout(contextFor(request.log), authenticated(request.auth), request.params.requestId),
  );

  /**
   * The booking a request produced — the confirmed screen's read, and the one
   * place reconciliation runs.
   *
   * A 404 here means "not paid yet", which is why it is not an error state on
   * the client: the confirmed screen is reached by having paid, and anything
   * else is a customer who navigated to it early.
   */
  app.get(
    '/customer/booking-requests/:requestId/booking',
    {
      preHandler: requireAuth,
      schema: { params: requestParamsSchema, response: { 200: bookingWithContextSchema } },
    },
    async (request) => {
      const booking = await reconcileBooking(
        contextFor(request.log),
        authenticated(request.auth),
        request.params.requestId,
      );

      if (!booking) {
        throw notFound('That booking has not been paid for yet');
      }

      return booking;
    },
  );

  /**
   * One booking of the customer's own, read by its id (#425).
   *
   * `/support?booking=<id>` is a URL anyone can paste, and the screen has to
   * decide from the row whether a report can still place a hold. A point read
   * rather than a filter over the customer's list: the list is paginated, so a
   * booking past its first page resolved to nothing, and a pasted id belonging
   * to nobody cost a full list fan-out on a public route.
   */
  app.get(
    '/customer/bookings/:bookingId',
    {
      preHandler: requireAuth,
      schema: { params: bookingParamsSchema, response: { 200: bookingSchema } },
    },
    async (request) =>
      findOwnBookingForReport(
        contextFor(request.log),
        authenticated(request.auth),
        request.params.bookingId,
      ),
  );

  /** An action on an existing booking, so 200 rather than 201. */
  app.put(
    '/vendor/bookings/:bookingId/complete',
    {
      preHandler: requireAuth,
      schema: { params: bookingParamsSchema, response: { 200: bookingSchema } },
    },
    async (request) =>
      completeBooking(
        contextFor(request.log),
        authenticated(request.auth),
        request.params.bookingId,
        app.clock(),
      ),
  );

  app.put(
    '/customer/bookings/:bookingId/cancel',
    {
      preHandler: requireAuth,
      schema: {
        params: bookingParamsSchema,
        body: cancelBookingSchema,
        response: { 200: cancelledBookingSchema },
      },
    },
    async (request) =>
      cancelBooking(
        contextFor(request.log),
        authenticated(request.auth),
        request.params.bookingId,
        request.body.reason,
        app.clock(),
      ),
  );
};
