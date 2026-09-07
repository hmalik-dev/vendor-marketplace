import { Webhook } from 'svix';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { unauthorized, validationFailed } from '../../lib/errors.js';
import { applyClerkUserEvent } from './clerk.service.js';
import { bookingContextFor } from '../payments/payments.service.js';
import { clerkWebhookEventSchema } from './clerk.schemas.js';
import { keepRawJsonBody, rawBodyOf } from './raw-body.js';

/** Verifies a svix signature over the raw request body. */
export type WebhookVerifier = (payload: string, headers: Record<string, string>) => unknown;

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
  outcome: z.enum(['created', 'updated', 'deleted', 'ignored']),
});

const SVIX_HEADERS = ['svix-id', 'svix-timestamp', 'svix-signature'] as const;

export const clerkWebhookRoutes: FastifyPluginAsyncZod<ClerkWebhookRoutesOptions> = async (
  app,
  options,
) => {
  const verify =
    options.verifySignature ??
    ((payload: string, headers: Record<string, string>) =>
      new Webhook(options.signingSecret).verify(payload, headers));

  keepRawJsonBody(app);

  app.post(
    '/webhooks/clerk',
    { schema: { response: { 200: webhookResponseSchema } } },
    async (request, reply) => {
      const rawBody = rawBodyOf(request.body);

      const headers: Record<string, string> = {};
      for (const name of SVIX_HEADERS) {
        const value = request.headers[name];
        if (typeof value !== 'string') {
          throw unauthorized('Webhook signature headers are missing');
        }
        headers[name] = value;
      }

      try {
        verify(rawBody, headers);
      } catch (error) {
        request.log.warn({ err: error }, 'Rejected a Clerk webhook with an invalid signature');
        throw unauthorized('Webhook signature verification failed');
      }

      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        throw validationFailed('Webhook body is not valid JSON');
      }

      const event = clerkWebhookEventSchema.safeParse(parsedBody);
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
