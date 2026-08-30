import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { unauthorized } from '../../lib/errors.js';
import { PAYMENT_INTENT_SUCCEEDED, type StripeEventNotification } from '../../lib/stripe.js';
import { recordSuccessfulPayment } from '../payments/payments.service.js';
import {
  accountUpdateOutcomeSchema,
  applyAccountStatusChange,
} from '../vendors/stripe-connect.service.js';
import { keepRawJsonBody, rawBodyOf } from './raw-body.js';

/**
 * What the handler did, in one word, for the log line and the response body.
 *
 * The payment outcomes are separate values rather than folded into the account
 * ones because the two halves fail differently: `booked` and `already-booked`
 * are both successes and Stripe must stop retrying on either, while `ignored`
 * means the event was not ours to act on at all.
 */
const paymentOutcomeSchema = z.enum(['booked', 'already-booked']);

const webhookResponseSchema = z.object({
  received: z.literal(true),
  outcome: z.union([accountUpdateOutcomeSchema, paymentOutcomeSchema]),
});

/**
 * Accounts v2 emits *thin* events: the notification carries the event type and
 * the id of the account it concerns, and nothing else. That shape is what makes
 * a prefix test the right predicate rather than a lazy one — every event about
 * an account means "something about this account changed", the handler answers
 * all of them by re-reading the account, and enumerating the subset that
 * matters today would silently drop a type Stripe adds tomorrow.
 *
 * The two forms are `v2.core.account.updated` and
 * `v2.core.account[configuration.recipient].capability_status_updated`. Both
 * separators are matched, and a bare `v2.core.account` prefix is deliberately
 * **not**: it would also catch `v2.core.account_person.*`, whose
 * `related_object` is a person rather than an account, so every one of those
 * would look up a `person_…` id, find no vendor and log `ignored` — a lookup
 * that was never going to succeed, reported as though it might have.
 */
const ACCOUNT_EVENT_PREFIXES = ['v2.core.account.', 'v2.core.account['] as const;

/**
 * The v1 snapshot Connect types that say the same thing.
 *
 * These are the ones that actually arrive today — a v2 account still emits
 * them, and thin `v2.core.*` delivery needs an event destination provisioned
 * before it produces anything. Enumerated rather than prefix-matched, because
 * the v1 namespace is flat and `account.` would also catch
 * `account.external_account.*` and `account.application.*`, whose payload
 * objects are not the account.
 */
const SNAPSHOT_ACCOUNT_EVENTS = new Set(['account.updated', 'capability.updated']);

/**
 * The one payment event that changes anything here.
 *
 * `payment_intent.payment_failed` is deliberately absent. A failed charge
 * leaves no trace worth writing — the intent is still live, the customer is
 * still on the checkout screen being told inline what went wrong, and the
 * booking they were paying for is untouched. Recording a row for it would
 * describe a state the customer can already see and is about to leave.
 *
 * `charge.refunded` is absent for the same reason in the other direction:
 * refunds here are only ever started by our own cancellation route, which has
 * already written the row by the time Stripe echoes the event back.
 */
const PAYMENT_SUCCEEDED_EVENT = `payment_intent.${PAYMENT_INTENT_SUCCEEDED}`;

function isAccountEvent(type: string): boolean {
  return (
    SNAPSHOT_ACCOUNT_EVENTS.has(type) ||
    ACCOUNT_EVENT_PREFIXES.some((prefix) => type.startsWith(prefix))
  );
}

export interface StripeWebhookRoutesOptions {
  /** `STRIPE_PLATFORM_FEE_RATE`, resolved and coerced at boot. */
  platformFeeRate: number;
}

export const stripeWebhookRoutes: FastifyPluginAsyncZod<StripeWebhookRoutesOptions> = async (
  app,
  options,
) => {
  keepRawJsonBody(app);

  app.post(
    '/webhooks/stripe',
    { schema: { response: { 200: webhookResponseSchema } } },
    async (request, reply) => {
      const signature = request.headers['stripe-signature'];

      if (typeof signature !== 'string') {
        throw unauthorized('Webhook signature headers are missing');
      }

      let event: StripeEventNotification;
      try {
        event = app.stripe.parseEventNotification(rawBodyOf(request.body), signature);
      } catch (error) {
        /*
         * The message only, never the error object. Stripe's
         * `SignatureVerificationError` carries `header` and `payload` as own
         * properties, and pino's `err` serialiser copies every own property —
         * so logging the error would re-emit the very header `server.ts`
         * redacts, and would write up to a megabyte of attacker-chosen body
         * into the log stream on an endpoint that needs no credential.
         */
        request.log.warn(
          { reason: error instanceof Error ? error.message : 'unknown' },
          'Rejected a Stripe webhook with an invalid signature',
        );
        throw unauthorized('Webhook signature verification failed');
      }

      const outcome = await applyEvent();

      async function applyEvent(): Promise<z.infer<typeof webhookResponseSchema>['outcome']> {
        if (isAccountEvent(event.type) && event.accountId) {
          return applyAccountStatusChange(
            { db: app.db, stripe: app.stripe, log: request.log },
            event.accountId,
          );
        }

        if (event.type !== PAYMENT_SUCCEEDED_EVENT || !event.objectId) {
          return 'ignored';
        }

        /*
         * Re-read from Stripe rather than trusting the payload, exactly as the
         * account branch does. The event body is attacker-shaped input that
         * happens to be signed, and the amount it carries decides what the
         * booking records as paid — so the figure that reaches the row is the
         * one Stripe answers with, not the one that arrived.
         */
        const intent = await app.stripe.retrievePaymentIntent(event.objectId);

        if (intent.status !== PAYMENT_INTENT_SUCCEEDED) {
          return 'ignored';
        }

        const { created } = await recordSuccessfulPayment(
          {
            db: app.db,
            stripe: app.stripe,
            hub: app.events,
            log: request.log,
            platformFeeRate: options.platformFeeRate,
          },
          intent,
        );

        return created ? 'booked' : 'already-booked';
      }

      request.log.info({ stripeEvent: event.type, outcome }, 'Applied a Stripe webhook');

      return reply.status(200).send({ received: true as const, outcome });
    },
  );
};
