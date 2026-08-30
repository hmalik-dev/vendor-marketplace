import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { unauthorized } from '../../lib/errors.js';
import {
  accountUpdateOutcomeSchema,
  applyAccountStatusChange,
} from '../vendors/stripe-connect.service.js';
import { keepRawJsonBody, rawBodyOf } from './raw-body.js';

const webhookResponseSchema = z.object({
  received: z.literal(true),
  outcome: accountUpdateOutcomeSchema,
});

/**
 * Accounts v2 emits *thin* events: the notification carries the event type and
 * the id of the account it concerns, and nothing else. That shape is what makes
 * the prefix test below the right predicate rather than a lazy one — every
 * `v2.core.account…` type means "something about this account changed", the
 * handler answers all of them by re-reading the account, and enumerating the
 * subset that happens to matter today would silently drop a type Stripe adds
 * tomorrow.
 */
const ACCOUNT_EVENT_PREFIX = 'v2.core.account';

export const stripeWebhookRoutes: FastifyPluginAsyncZod = async (app) => {
  keepRawJsonBody(app);

  app.post(
    '/webhooks/stripe',
    { schema: { response: { 200: webhookResponseSchema } } },
    async (request, reply) => {
      const signature = request.headers['stripe-signature'];

      if (typeof signature !== 'string') {
        throw unauthorized('Webhook signature headers are missing');
      }

      let event;
      try {
        event = app.stripe.parseEventNotification(rawBodyOf(request.body), signature);
      } catch (error) {
        request.log.warn({ err: error }, 'Rejected a Stripe webhook with an invalid signature');
        throw unauthorized('Webhook signature verification failed');
      }

      const outcome =
        event.type.startsWith(ACCOUNT_EVENT_PREFIX) && event.accountId
          ? await applyAccountStatusChange({ db: app.db, stripe: app.stripe }, event.accountId)
          : 'ignored';

      request.log.info({ stripeEvent: event.type, outcome }, 'Applied a Stripe Connect webhook');

      return reply.status(200).send({ received: true as const, outcome });
    },
  );
};
