import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  SUPPORT_CASE_ORIGINS,
  SUPPORT_CASE_STATUSES,
  SUPPORT_TOPICS,
} from '@vendor-marketplace/shared';
import { bookings } from './bookings.js';
import { users } from './users.js';

export const supportCaseOriginEnum = pgEnum('support_case_origin', SUPPORT_CASE_ORIGINS);
export const supportCaseStatusEnum = pgEnum('support_case_status', SUPPORT_CASE_STATUSES);
export const supportTopicEnum = pgEnum('support_topic', SUPPORT_TOPICS);

/**
 * Every dispute the platform has to answer, however it arrived (#431).
 *
 * Before this table there were three mechanisms and none of them met: the
 * customer's complaint lived in a support inbox (`POST /support/messages` sent
 * one email and stored nothing), the payout hold it justified lived in
 * `bookings.dispute_reason`, which no admin schema exposed, and the resolution
 * lived in an endpoint with no UI. An operator could filter
 * `/admin/bookings?status=disputed` and see a pill; they could not see why, and
 * they could not act.
 *
 * **One table for both doors, and that is the design rather than a shortcut.** A
 * customer's report and a card network's chargeback are the same object to the
 * operator working them — both freeze a payout, both need a ruling — so the
 * origin is a column. Two tables would have been two queues, and an operator
 * working two queues works neither. #436's in-product reports land here too.
 *
 * **It is not the audit log and must not be confused with one.** `admin_actions`
 * is immutable by trigger because it records what the console did; this table
 * records what the world sent us and is mutated in the ordinary way as a case is
 * worked. The audit row for a resolution is still written, to `admin_actions`,
 * by the admin service.
 *
 * **Nothing here is a second copy of the money.** The amounts, the refund and
 * the payout state stay on `bookings`; this row carries the booking's id and the
 * case detail joins for the rest. A case that cached the total would be a second
 * source for the one figure an operator rules on.
 */
export const supportCases = pgTable(
  'support_cases',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /**
     * `ORL-4K7Q-P2` — the handle the sender was already shown, reused as the
     * case's public id rather than minted again.
     *
     * Unique, because it is quoted down a phone line and read back to somebody
     * who then has to find exactly one case. `generateSupportReference` draws
     * from ~729 million values, so a collision is a retry rather than a design
     * problem, and the constraint is what turns it into one.
     */
    reference: text('reference').notNull().unique(),
    origin: supportCaseOriginEnum('origin').notNull(),
    status: supportCaseStatusEnum('status').notNull().default('open'),
    /** `null` on a chargeback, which nobody typed a topic for. */
    topic: supportTopicEnum('topic'),
    /**
     * The sender's account where there is one. `set null`, not `cascade`: a
     * retired account must not take the complaint about it with it, and the
     * reply-to address below is what is left to answer.
     */
    senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Where a reply goes. `null` on a chargeback, which has nobody to answer. */
    senderEmail: text('sender_email'),
    /**
     * What was actually said. For a chargeback this is the platform's own
     * sentence about the network event, never a field Stripe filled in.
     */
    message: text('message').notNull(),
    /**
     * The booking under dispute, or `null` for a general question.
     *
     * `set null` for the same reason as the sender: the case outlives its
     * subject. No product path deletes a booking today, so this is the shape of
     * the guarantee rather than a path anyone walks.
     */
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    /**
     * Stripe's dispute id, and **the idempotency key for the whole chargeback
     * path**. A replayed `charge.dispute.created` finds this row and does
     * nothing rather than opening a second case and placing a second hold.
     *
     * Unique, and nullable — Postgres allows many nulls under a unique
     * constraint, so every support-message case is unaffected by it.
     */
    stripeDisputeId: text('stripe_dispute_id').unique(),
    /**
     * Why the hold could not be placed, where a chargeback's could not.
     *
     * `placeDisputeHold` refuses a released payout and a future event. Both
     * refusals are right for a customer's own report and neither is something a
     * card network's decision can be turned away by, so the hold is attempted
     * and its refusal is recorded rather than swallowed. A chargeback case
     * sitting on a `completed` booking otherwise reads as an operator error
     * rather than as money that had already left.
     */
    holdRefusal: text('hold_refusal'),
    /**
     * When the report failed to reach the support inbox.
     *
     * The send is what the whole chain exists for, and its failure already
     * unwinds the hold and answers 502 — but the row is written before the send
     * is attempted, so without this column a case would sit in the queue looking
     * delivered. It is the one state an operator has to chase rather than work.
     */
    emailFailedAt: timestamp('email_failed_at', { withTimezone: true }),
    /**
     * How the card network closed it — Stripe's `won`, `lost`,
     * `warning_closed`. **Their vocabulary in a `text` column, not a `pgEnum` of
     * ours**: enumerating it would claim ownership of a list Stripe changes, and
     * a member we had not heard of would fail the insert on a webhook we are
     * obliged to acknowledge.
     *
     * Recorded, and deliberately not acted on. Stripe's outcome and the
     * platform's disposition are different facts — `status` above stays the
     * console's — and reconciling them is the operator's job.
     */
    networkOutcome: text('network_outcome'),
    /** The operator who closed it. `set null` so the disposition outlives them. */
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /*
     * The queue's own order: open cases, oldest first.
     *
     * `ASC` and therefore `NULLS LAST` is what Drizzle emits, and `created_at`
     * is `NOT NULL`, so a plain `ORDER BY created_at ASC` is satisfiable by this
     * — unlike the `DESC` indexes on `admin_actions`, where the reader has to
     * spell the nulls ordering out. The status column leads because the default
     * screen is always filtered by it.
     */
    index('support_cases_status_created_at_idx').on(table.status, table.createdAt),
    /* "Is there already a case about this booking" — asked on every chargeback. */
    index('support_cases_booking_idx').on(table.bookingId),
  ],
);

export type SupportCaseRow = typeof supportCases.$inferSelect;
export type NewSupportCaseRow = typeof supportCases.$inferInsert;
