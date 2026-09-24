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
 *
 * `cap` is the highest `EMAIL_DAILY_SEND_CAP` any instance has enforced today
 * (VEN-688). Raising the cap is a rolling deploy, so an old instance keeps
 * serving with its lower cap after the new one has reopened the day; every
 * reservation compares `sent` with the greater of its own cap and this column,
 * so the old instance cannot close the day the new one just opened. Null on a
 * day nothing has recorded a cap for, which every instance reads as its own.
 */
export const emailSendDays = pgTable(
  'email_send_days',
  {
    day: date('day', { mode: 'string' }).primaryKey(),
    /** Send attempts reserved against the cap, whatever the provider then said. */
    sent: integer('sent').notNull().default(0),
    closedReason: text('closed_reason').$type<'cap' | 'quota'>(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    cap: integer('cap'),
  },
  (table) => [
    check(
      'email_send_days_closed_reason_known',
      sql`${table.closedReason} IS NULL OR ${table.closedReason} IN ('cap', 'quota')`,
    ),
  ],
).enableRLS();
