import { sql } from 'drizzle-orm';
import { index, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { BOOKING_EVENT_SUBJECTS } from '@vendor-marketplace/shared';

export const bookingEventSubjectEnum = pgEnum('booking_event_subject', BOOKING_EVENT_SUBJECTS);

/**
 * Every status a booking request or a booking has held, in order, and who moved
 * it there (VEN-647). **Append-only**: never updated, never deleted.
 *
 * `booking_requests` and `bookings` keep only their current `status`, so who
 * declined, when a quote was revised, and how long a request sat before it was
 * paid were lost the moment the next write landed — and a funnel (request →
 * quote → paid) cannot be rebuilt from rows that no longer say how they got
 * where they are.
 *
 * **Written by triggers, not by the services** (`0082`'s
 * `record_booking_request_event` / `record_booking_event`). A row is inserted in
 * the same statement — so the same transaction — as every insert into either
 * table and every update that changes `status` (or, on a request, the quoted
 * price). A rule kept in each service is one the next writer forgets; there
 * are a dozen writers already, across four modules and the seeds.
 *
 * - `actor_user_id` is the `users.id` that caused the transition, read from the
 *   transaction-local `app.booking_actor` (`asBookingActor`) or, failing that,
 *   the request identity's `app.user_id`. **Null means the system** — the
 *   expiry sweep, a webhook, the payout sweep. No foreign key: the history
 *   outlives an account's closure, and an append-only row cannot be set null.
 * - `subject_id` carries no foreign key either, for the reason `admin_actions`
 *   gives: the record has to survive the row it is about.
 * - `payload` is the handful of figures the transition set (a quoted price, a
 *   refund amount), never free text.
 */
export const bookingEvents = pgTable(
  'booking_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    subjectType: bookingEventSubjectEnum('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    /** Null on the event that created the row. */
    fromStatus: varchar('from_status', { length: 32 }),
    toStatus: varchar('to_status', { length: 32 }).notNull(),
    actorUserId: uuid('actor_user_id'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>(),
  },
  (table) => [index('booking_events_subject_idx').on(table.subjectId, table.at)],
).enableRLS();

export type BookingEventRow = typeof bookingEvents.$inferSelect;
