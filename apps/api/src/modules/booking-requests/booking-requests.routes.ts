import {
  bookingRequestDetailSchema,
  bookingRequestListQuerySchema,
  bookingWithContextSchema,
  createBookingRequestSchema,
  quoteBookingRequestSchema,
  uuidSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuth, requireRole } from '../../lib/guards.js';
import type { NotificationEmailDeps } from '../notifications/notification-email.js';
import {
  createBookingRequest,
  getBookingRequest,
  listBookingRequests,
  listBookings,
  transitionRequest,
} from './booking-requests.service.js';

const REQUESTS_PATH = '/booking-requests';

const requestParamsSchema = z.object({ requestId: uuidSchema });
const requestListSchema = z.array(bookingRequestDetailSchema);

export interface BookingRequestRoutesOptions {
  /**
   * `canonicalWebOrigin(env)` — the origin every emailed link is built from.
   *
   * Passed in rather than read here, the way `paymentRoutes` takes its fee
   * rate: the env is resolved once at boot, and a route module reaching for it
   * again is a second place that can disagree. It is deliberately **not**
   * `BRAND_DOMAIN`, which is the domain the product will live on rather than
   * the one this deployment answers on — `brand-literals.test.ts` bans building
   * a URL from it for exactly this reason.
   */
  webOrigin: string;
}

export const bookingRequestRoutes: FastifyPluginAsyncZod<BookingRequestRoutesOptions> = async (
  app,
  options,
) => {
  /*
   * Built per request so the log carries the request id, the way `payments`
   * builds its `PaymentContext`. The origin is `WEB_URL`'s canonical entry —
   * never `BRAND_DOMAIN`, which is the domain the product will live on rather
   * than the one this deployment answers on.
   */
  const mailFor = (log: NotificationEmailDeps['log']): NotificationEmailDeps => ({
    db: app.db,
    email: app.email,
    log,
    webOrigin: options.webOrigin,
  });

  app.post(
    REQUESTS_PATH,
    {
      preHandler: requireRole('customer'),
      schema: {
        body: createBookingRequestSchema,
        response: {
          200: bookingRequestDetailSchema,
          201: bookingRequestDetailSchema,
        },
      },
    },
    async (request, reply) => {
      const outcome = await createBookingRequest(
        app.db,
        app.events,
        authenticated(request.auth),
        request.body,
        app.clock(),
        mailFor(request.log),
      );

      // 200 for a repeat submission: nothing was created, and this is the id
      // of the request that already exists.
      return reply
        .status(outcome.created ? 201 : 200)
        .header('location', `${REQUESTS_PATH}/${outcome.request.id}`)
        .send(outcome.request);
    },
  );

  /*
   * One list endpoint for both sides. Which queue it returns is derived from
   * the session, never from a parameter — a customer cannot ask for a vendor's
   * inbox by naming it.
   */
  app.get(
    REQUESTS_PATH,
    {
      preHandler: requireAuth,
      schema: { querystring: bookingRequestListQuerySchema, response: { 200: requestListSchema } },
    },
    async (request) =>
      listBookingRequests(
        app.db,
        authenticated(request.auth),
        request.query,
        app.clock(),
        mailFor(request.log),
      ),
  );

  app.get(
    `${REQUESTS_PATH}/:requestId`,
    {
      preHandler: requireAuth,
      schema: { params: requestParamsSchema, response: { 200: bookingRequestDetailSchema } },
    },
    async (request) =>
      getBookingRequest(
        app.db,
        authenticated(request.auth),
        request.params.requestId,
        app.clock(),
        mailFor(request.log),
      ),
  );

  app.post(
    `${REQUESTS_PATH}/:requestId/quote`,
    {
      preHandler: requireRole('vendor'),
      schema: {
        params: requestParamsSchema,
        body: quoteBookingRequestSchema,
        response: { 200: bookingRequestDetailSchema },
      },
    },
    async (request) =>
      transitionRequest(app.db, request.params.requestId, 'quote', authenticated(request.auth), {
        now: app.clock(),
        quote: request.body,
        hub: app.events,
        mail: mailFor(request.log),
      }),
  );

  /*
   * Accept is the one action both roles reach: the vendor answers a new
   * request, the customer accepts a quote. The service decides which of them
   * is legal from the status it is in, so the route only requires a session.
   */
  for (const action of ['accept', 'decline', 'cancel'] as const) {
    app.post(
      `${REQUESTS_PATH}/:requestId/${action}`,
      {
        preHandler: requireAuth,
        schema: { params: requestParamsSchema, response: { 200: bookingRequestDetailSchema } },
      },
      async (request) =>
        transitionRequest(app.db, request.params.requestId, action, authenticated(request.auth), {
          now: app.clock(),
          hub: app.events,
          mail: mailFor(request.log),
        }),
    );
  }

  app.get(
    '/bookings',
    { preHandler: requireAuth, schema: { response: { 200: z.array(bookingWithContextSchema) } } },
    async (request) => listBookings(app.db, authenticated(request.auth)),
  );
};
