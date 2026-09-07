import { supportMessageReceiptSchema, supportMessageSchema } from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { bookingContextFor } from '../payments/payments.service.js';
import { sendSupportMessage } from './support.service.js';

export interface SupportRoutesOptions {
  /** `SUPPORT_EMAIL_TO`. Threaded in so the service never reads `process.env`. */
  supportEmailTo: string;
  /**
   * `canonicalWebOrigin(env)` — the origin the vendor's hold notice links back
   * from, threaded in exactly as `paymentRoutes` takes it (#425).
   */
  webOrigin: string;
}

/**
 * One send an hour is generous for a person and useless for a script.
 *
 * The route is public and it makes this process send mail, which is the pair
 * that makes an open relay: the global per-IP limiter is sized for reads
 * (`RATE_LIMIT_MAX`, 120/minute) and would let one address emit thousands of
 * messages a day into the support inbox and to any address it names. Six an
 * hour is above anything a real visitor does — a report, a correction, a
 * follow-up — and orders of magnitude below anything worth automating.
 */
const SUPPORT_RATE_LIMIT = { max: 6, timeWindow: '1 hour' } as const;

export const supportRoutes: FastifyPluginAsyncZod<SupportRoutesOptions> = async (app, options) => {
  const { supportEmailTo } = options;

  app.post(
    '/support/messages',
    {
      /*
       * Deliberately unauthenticated: the visitor most likely to need this is
       * the one who cannot get in. `request.auth` is resolved by the global
       * auth hook either way, so a signed-in sender is still identified — the
       * route is open, not anonymous-only.
       *
       * Keyed by account where there is one, so a shared office IP cannot
       * spend one person's allowance on everybody behind it, and by IP where
       * there is not.
       */
      config: {
        rateLimit: {
          ...SUPPORT_RATE_LIMIT,
          keyGenerator: (request: { auth: { id: string } | null; ip: string }) =>
            request.auth?.id ?? request.ip,
        },
      },
      schema: {
        body: supportMessageSchema,
        response: { 200: supportMessageReceiptSchema },
      },
    },
    /*
     * 200, not 201: this creates nothing addressable. There is no message
     * resource to `Location` at, which is the same fact the screen states in
     * words — one email, no ticket to track.
     */
    async (request) =>
      sendSupportMessage(
        {
          db: app.db,
          email: app.email,
          log: request.log,
          to: supportEmailTo,
          bookings: bookingContextFor(app, request.log, options.webOrigin),
        },
        request.body,
        request.auth,
        app.clock(),
      ),
  );
};
