import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { notFound, validationFailed } from '../../lib/errors.js';
import { applyResendDeliveryEvent } from '../notifications/email-delivery.service.js';
import { keepRawJsonBody } from './raw-body.js';
import { resendEventSchema } from './resend.schemas.js';
import { svixVerifier, verifiedSvixBody, type WebhookVerifier } from './svix-request.js';

export interface ResendWebhookRoutesOptions {
  signingSecret: string;
  /** Overridden by the route suites so they need no real svix secret. */
  verifySignature?: WebhookVerifier;
}

/**
 * What the handler did, in one word — for the three answers that are a success.
 *
 * `applied` and `superseded` are both successes and both answer 200: a replay
 * is the normal case, not an error, and Resend must stop retrying on either.
 * `ignored` is an event type that changes no record, which no amount of
 * retrying will change either.
 *
 * `unknown` is deliberately **not** here; see the handler.
 */
const webhookResponseSchema = z.object({
  received: z.literal(true),
  outcome: z.enum(['applied', 'superseded', 'ignored']),
});

/**
 * Resend's delivery events, recorded against the attempt rows the send wrote.
 *
 * Signature-verified through the same svix seam the Clerk webhook uses, because
 * Resend signs with svix too — and idempotent under replay by the rank
 * predicate in `applyDeliveryEvent` rather than by a table of event ids.
 *
 * **Registered only when the signing secret exists**, and `server.ts` makes
 * that call: an unconfigured deployment gets no endpoint rather than a handler
 * that can never do anything. See the `RESEND_WEBHOOK_SECRET` registry row.
 */
export const resendWebhookRoutes: FastifyPluginAsyncZod<ResendWebhookRoutesOptions> = async (
  app,
  options,
) => {
  const verify = svixVerifier(options.signingSecret, options.verifySignature);

  keepRawJsonBody(app);

  app.post(
    '/webhooks/resend',
    { schema: { response: { 200: webhookResponseSchema } } },
    async (request, reply) => {
      const event = resendEventSchema.safeParse(verifiedSvixBody(request, verify, 'Resend'));
      if (!event.success) {
        throw validationFailed('Webhook payload has an unexpected shape', event.error.issues);
      }

      const outcome = await applyResendDeliveryEvent(app.db, event.data, app.clock);

      /*
       * A **recent** event naming no record, answered 404 so Resend redelivers.
       *
       * The attempt row is written after the provider accepts the message, so
       * a delivery event can arrive before its row is committed — a slow insert
       * behind a saturated pool, a redeploy in between. Answering 200 there
       * would discard the outcome permanently and leave the row reading `sent`
       * for a message that bounced, which is precisely the failure this table
       * exists to surface.
       *
       * An **older** one is answered 200 as `ignored` instead, because it is
       * not ours and never will be — this platform's own support report is
       * sent through the same Resend account and deliberately writes no row.
       * `DELIVERY_EVENT_RETRY_WINDOW_MS` carries the whole argument, including
       * why refusing those indefinitely would get the endpoint disabled.
       */
      if (outcome === 'unmatched') {
        request.log.warn(
          { resendEvent: event.data.type, providerMessageId: event.data.data.email_id },
          'No delivery record matches this Resend message yet; asking for a redelivery',
        );
        throw notFound('No delivery record matches this message');
      }

      /*
       * The message id only. Never `to`, and never the bounce diagnostic — the
       * receiving server quotes the address back inside it, which is exactly
       * the shape `log-redaction.ts` cannot strip from free text. The column
       * holds it; the log stream does not.
       */
      request.log.info(
        { resendEvent: event.data.type, providerMessageId: event.data.data.email_id, outcome },
        'Applied a Resend delivery webhook',
      );

      return reply.status(200).send({ received: true as const, outcome });
    },
  );
};
