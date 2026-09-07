import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  EMAIL_DELIVERY_ENTITIES,
  EMAIL_DELIVERY_OUTCOMES,
  MAX_EMAIL_FAILURE_REASON_LENGTH,
} from '@vendor-marketplace/shared';
import { users } from './users.js';

export const emailDeliveryOutcomeEnum = pgEnum('email_delivery_outcome', EMAIL_DELIVERY_OUTCOMES);
export const emailDeliveryEntityEnum = pgEnum('email_delivery_entity', EMAIL_DELIVERY_ENTITIES);

/**
 * One row per transactional email **attempt**, written beside the send.
 *
 * Fourteen notification types reach an inbox and every send was fire and
 * forget: `notification-email.ts` catches, logs and continues — correctly,
 * because a failed email must not fail a booking. But nothing recorded that it
 * happened, and `notifications` holds the in-app bell only. So *"was the
 * customer actually told their booking was cancelled?"* had no answer in the
 * console, in the database, or anywhere but a log search against a process that
 * may have rotated (#439).
 *
 * **Per attempt, not per notification.** A retry writes a second row rather
 * than overwriting the first, so a send that failed and then succeeded reads as
 * exactly that. The consequence is that `notification_id` is deliberately not
 * unique here.
 *
 * **What must never be stored: the rendered body.** This is metadata — who,
 * which type, when, what outcome — and a copy of every email the platform has
 * ever sent is a liability rather than an audit trail. The columns below are
 * the whole permitted set; there is no `subject`, no `html` and no `text`, and
 * `failure_reason` holds the provider's diagnostic rather than the message.
 *
 * **What is deliberately not here: the support form's message** (#421), which
 * is the API's one other `email.send` call site. It is not an omission the
 * columns merely happen to forbid — it answers a different question. That mail
 * is written *by* a visitor and read by us, so it has no recipient `users` row
 * to hang off and no notification behind it, which is why `user_id` and
 * `notification_id` are both `NOT NULL` here. #439 asks whether *the customer
 * was told*; a message travelling the other way is not that. A future sender
 * that does notify a user records here, and the `NOT NULL` columns are what
 * make forgetting fail loudly rather than silently.
 *
 * **Nothing is backfilled, and nothing can be.** Every email sent before this
 * table existed left no trace but a log line on a process that may have
 * rotated, so there is no source to migrate from — the rows simply begin here,
 * and a delivery history that starts on the deployment date is the honest
 * shape. This is not the `.claude/rules/db-schema.md` legacy trap: no existing
 * row becomes *worse*, because there are no existing rows.
 *
 * The recipient address is stored even though `user_id` resolves to one,
 * because the two answer different questions. `users.email` is *the address
 * that account has now*; this is the address the message actually went to, and
 * a bounce recorded against an address the account has since changed is the
 * only shape in which "we were sending to the wrong place until March" is
 * visible at all.
 */
export const emailDeliveries = pgTable(
  'email_deliveries',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /**
     * The notification this email rendered.
     *
     * No foreign key, for `admin_actions`' reason: the record has to survive
     * the thing it is about. It is also the value the send passes to Resend as
     * its idempotency key, so it is what ties the rows of one event together.
     */
    notificationId: uuid('notification_id').notNull(),
    /** Who was written to. Cascades: a delivery record with nobody behind it names nobody. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The address the message was actually sent to — see the note above. */
    recipientEmail: text('recipient_email').notNull(),
    /** One of `NOTIFICATION_TYPES`; varchar for `notifications.type`'s reason. */
    notificationType: varchar('notification_type', { length: 50 }).notNull(),
    /**
     * What the email was about, and which id space that id belongs to.
     *
     * Both null together, for the types that concern an account rather than a
     * booking — `stripe_onboarding_complete`, `tag_suggestion_approved`. The id
     * is unconstrained for the same reason as `notification_id`, which is also
     * why the type has to be stored: see `EMAIL_DELIVERY_ENTITIES`.
     */
    relatedEntityType: emailDeliveryEntityEnum('related_entity_type'),
    relatedEntityId: uuid('related_entity_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    outcome: emailDeliveryOutcomeEnum('outcome').notNull(),
    /**
     * Resend's id for the accepted message, and the only key a delivery event
     * can be matched on. Null on a `failed` row, which never got one.
     */
    providerMessageId: text('provider_message_id'),
    /** Why it failed, truncated to `MAX_EMAIL_FAILURE_REASON_LENGTH`. Never the body. */
    failureReason: varchar('failure_reason', { length: MAX_EMAIL_FAILURE_REASON_LENGTH }),
    /** When a provider event last moved `outcome`. Null while the row is as sent. */
    outcomeUpdatedAt: timestamp('outcome_updated_at', { withTimezone: true }),
  },
  (table) => [
    /*
     * The webhook's only lookup, and unique because Resend keys every event on
     * this id: two rows carrying one id would make "which record does this
     * bounce belong to" unanswerable. Partial, because a `failed` row never got
     * an id — Postgres already treats nulls as distinct, and the predicate also
     * keeps those rows out of the structure the webhook probes.
     */
    uniqueIndex('email_deliveries_provider_message_id_idx')
      .on(table.providerMessageId)
      .where(sql`${table.providerMessageId} is not null`),
    /*
     * The two read paths, and **neither has a caller yet** — #437 adds the
     * console views that use them, and #439 deliberately stops at the data
     * layer and the webhook.
     *
     * They ship with the table anyway, and that is a timing argument rather
     * than a speculative one. `CREATE INDEX` takes an `ACCESS EXCLUSIVE` lock
     * and drizzle-kit does not emit `CONCURRENTLY`, so building these on an
     * empty table now costs nothing, while adding them later means locking the
     * highest-write-rate table the feature introduces. The write cost until
     * then is two index entries per email sent, which is the cheaper side of
     * that trade by a wide margin.
     *
     * `DESC` on both, for `admin_actions`' measured reason: Postgres treats
     * `DESC` and plain ascending as different pathkeys, so the reader has to
     * ask for the ordering the index was built with.
     */

    /*
     * "What has this person been sent, newest first" — the customer and vendor
     * delivery history, and the query behind the bounced-address signal on an
     * account.
     */
    index('email_deliveries_user_idx').on(table.userId, table.sentAt.desc()),
    /*
     * "Which emails did this booking generate", in order. The id leads because
     * it is the selective half and no lookup ever supplies a type without one —
     * `admin_actions_subject_idx`'s reasoning, and the same shape.
     *
     * Partial, because the types that concern an account rather than a booking
     * store both columns null (see above) and can never match a lookup, which
     * always supplies an id. Keeping them out is the same call the
     * `provider_message_id` index makes about failed attempts.
     */
    index('email_deliveries_related_entity_idx')
      .on(table.relatedEntityId, table.relatedEntityType, table.sentAt.desc())
      .where(sql`${table.relatedEntityId} is not null`),
  ],
);

export type EmailDeliveryRow = typeof emailDeliveries.$inferSelect;
export type NewEmailDeliveryRow = typeof emailDeliveries.$inferInsert;
