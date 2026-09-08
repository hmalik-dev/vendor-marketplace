import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { validationFailed } from '../../lib/errors.js';
import { applyClerkUserEvent } from './clerk.service.js';
import { bookingContextFor } from '../payments/payments.service.js';
import { clerkWebhookEventSchema } from './clerk.schemas.js';
import { keepRawJsonBody } from './raw-body.js';
import { svixVerifier, verifiedSvixBody, type WebhookVerifier } from './svix-request.js';

export type { WebhookVerifier };

export interface ClerkWebhookRoutesOptions {
  signingSecret: string;
  /**
   * `canonicalWebOrigin(env)` — the origin every emailed link is built from.
   *
   * A webhook needs one because `user.deleted` unwinds the account's bookings
   * and emails both counterparties about them (#433).
   */
  webOrigin: string;
  /** Overridden by the route suites so they need no real svix secret. */
  verifySignature?: WebhookVerifier;
}

const webhookResponseSchema = z.object({
  received: z.literal(true),
  outcome: z.enum(['created', 'updated', 'deleted', 'ignored', 'diverged']),
});

export const clerkWebhookRoutes: FastifyPluginAsyncZod<ClerkWebhookRoutesOptions> = async (
  app,
  options,
) => {
  const verify = svixVerifier(options.signingSecret, options.verifySignature);

  keepRawJsonBody(app);

  app.post(
    '/webhooks/clerk',
    { schema: { response: { 200: webhookResponseSchema } } },
    async (request, reply) => {
      const event = clerkWebhookEventSchema.safeParse(verifiedSvixBody(request, verify, 'Clerk'));
      if (!event.success) {
        throw validationFailed('Webhook payload has an unexpected shape', event.error.issues);
      }

      /*
       * The same context `adminRoutes` builds, from the same builder: a
       * deletion runs the unwind a ban runs, and that path needs Stripe, the
       * hub and the mailer.
       */
      const outcome = await applyClerkUserEvent(
        bookingContextFor(app, app.log, options.webOrigin),
        event.data,
        app.clock(),
      );
      request.log.info(
        { clerkEvent: event.data.type, outcome },
        'Applied a Clerk lifecycle webhook',
      );

      return reply.status(200).send({ received: true as const, outcome });
    },
  );
};
