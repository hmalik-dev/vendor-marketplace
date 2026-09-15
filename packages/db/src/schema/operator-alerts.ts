import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { OPERATOR_ALERT_KINDS, OPERATOR_ALERT_OUTCOMES } from '@vendor-marketplace/shared';

export const operatorAlertKindEnum = pgEnum('operator_alert_kind', OPERATOR_ALERT_KINDS);
export const operatorAlertOutcomeEnum = pgEnum('operator_alert_outcome', OPERATOR_ALERT_OUTCOMES);

/**
 * One row per email sent to the operator (VEN-405), and the dedupe record.
 *
 * An immediate alert is sent only when no row for the same kind and subject is
 * younger than `OPERATOR_ALERT_DEDUPE_MS`. A digest row is the **claim** on an
 * operator-local date: the partial unique index lets exactly one instance
 * insert it, and only that instance sends.
 *
 * No body is stored, for `email_deliveries`' reason: a copy of every message is
 * a liability rather than an audit trail. The subject id and kind say which
 * record the operator was pointed at.
 */
export const operatorAlerts = pgTable(
  'operator_alerts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    kind: operatorAlertKindEnum('kind').notNull(),
    /**
     * What the alert is about — a case, booking or vendor id, `stripe` for the
     * webhook as a whole, or a `YYYY-MM-DD` date for a digest. Text rather than
     * uuid because those id spaces differ, and unconstrained for the audit
     * reason `admin_actions` gives.
     */
    subjectId: text('subject_id').notNull(),
    outcome: operatorAlertOutcomeEnum('outcome').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('operator_alerts_kind_subject_sent_at_idx').on(table.kind, table.subjectId, table.sentAt),
    uniqueIndex('operator_alerts_digest_date_key')
      .on(table.subjectId)
      .where(sql`${table.kind} = 'daily_digest'`),
  ],
);

export type OperatorAlertRow = typeof operatorAlerts.$inferSelect;
