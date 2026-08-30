import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { unauthorized } from '../../lib/errors.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import {
  applyAccountStatusChange,
  type AccountUpdateOutcome,
} from '../vendors/stripe-connect.service.js';

export interface StripeWebhookRoutesOptions {
  stripe: StripeConnectGateway;
  returnOrigin: string;
}

const webhookResponseSchema = z.object({
  received: z.literal(true),
  outcome: z.enum(['onboarded', 'not-onboarded', 'unchanged', 'ignored']),
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

export const stripeWebhookRoutes: FastifyPluginAsyncZod<StripeWebhookRoutesOptions> = async (
  app,
  options,
) => {
  /*
   * Stripe signs the exact bytes it sent, so this route keeps the body as a
   * string rather than letting Fastify parse it first. Content type parsers are
   * encapsulated per plugin, so this does not disturb the Clerk webhook's own
   * parser or any JSON route.
   */
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body);
  });

  app.post(
    '/webhooks/stripe',
    { schema: { response: { 200: webhookResponseSchema } } },
    async (request, reply) => {
      const rawBody = typeof request.body === 'string' ? request.body : '';
      const signature = request.headers['stripe-signature'];

      if (typeof signature !== 'string') {
        throw unauthorized('Webhook signature headers are missing');
      }

      let event;
      try {
        event = options.stripe.parseEventNotification(rawBody, signature);
      } catch (error) {
        request.log.warn({ err: error }, 'Rejected a Stripe webhook with an invalid signature');
        throw unauthorized('Webhook signature verification failed');
      }

      let outcome: AccountUpdateOutcome = 'ignored';

      if (event.type.startsWith(ACCOUNT_EVENT_PREFIX) && event.accountId) {
        outcome = await applyAccountStatusChange(
          { db: app.db, stripe: options.stripe, returnOrigin: options.returnOrigin },
          event.accountId,
        );
      }

      request.log.info({ stripeEvent: event.type, outcome }, 'Applied a Stripe Connect webhook');

      return reply.status(200).send({ received: true as const, outcome });
    },
  );
};
