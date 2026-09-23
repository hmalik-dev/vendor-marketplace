import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * The transactional-email send budget (VEN-661), one row per UTC day.
 *
 * A table rather than a counter in memory because the process is exactly what
 * cannot be trusted with it: a redeploy or a crash loop restarts the count, and
 * the payout sweep sends on every boot. `sent` is reserved with one conditional
 * upsert before each send, so two instances cannot both take the last slot.
 *
 * `closed_reason` shuts the day: `cap` when our own ceiling is reached, `quota`
 * when Resend said its quota was spent. Setting it is a `WHERE closed_reason IS
 * NULL` update, which is what makes the Sentry page fire once per day.
 */
export const emailSendDays = pgTable(
  'email_send_days',
  {
    day: date('day', { mode: 'string' }).primaryKey(),
    /** Send attempts reserved against the cap, whatever the provider then said. */
    sent: integer('sent').notNull().default(0),
    closedReason: text('closed_reason').$type<'cap' | 'quota'>(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'email_send_days_closed_reason_known',
      sql`${table.closedReason} IS NULL OR ${table.closedReason} IN ('cap', 'quota')`,
    ),
  ],
).enableRLS();
