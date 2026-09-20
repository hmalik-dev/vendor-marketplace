import { integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * How many times a refund has been refused at Stripe, per payment intent and
 * purpose (VEN-469).
 *
 * The idempotency key is derived from this count, so it is the same for every
 * caller until a failure is recorded and different afterwards. That is both
 * halves of D36 at once: Stripe caches a *failed* idempotent result for 24
 * hours, so a retry needs a new key; and two callers racing over one refund need
 * the same key, which a key built from the wall clock could not promise across
 * an hour boundary.
 *
 * The primary key is the create-or-find: `failed_attempts` moves only through a
 * compare-and-set, so two callers that both saw the same refusal record one
 * increment between them.
 */
export const refundAttempts = pgTable(
  'refund_attempts',
  {
    paymentIntentId: text('payment_intent_id').notNull(),
    /** What the refund is for: `booking:<id>` for a cancellation, or the refusal cause. */
    scope: text('scope').notNull(),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.paymentIntentId, table.scope] })],
);
