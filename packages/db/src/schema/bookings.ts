import type { EventType } from '@vendor-marketplace/shared';
import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  bookingCancelledByEnum,
  bookingRequestStatusEnum,
  bookingStatusEnum,
  payoutModelEnum,
} from './enums.js';
import { servicePackages } from './service-packages.js';
import { users } from './users.js';
import { vendorProfiles } from './vendor-profiles.js';

/**
 * A request with a `package_id` is a package request; without one it is a
 * custom request the vendor must quote. `final_price_cents` locks the agreed
 * price at acceptance so later package price edits cannot change it.
 */
export const bookingRequests = pgTable(
  'booking_requests',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    // Kept on record even if the vendor later retires the package.
    packageId: uuid('package_id').references(() => servicePackages.id, { onDelete: 'set null' }),
    eventDate: date('event_date').notNull(),
    /** Local wall-clock start, `HH:MM`. No zone: the venue's clock is the clock. */
    eventStartTime: time('event_start_time'),
    /**
     * The occasion, as the slug `EVENT_TYPES` declares — never the display
     * label. `varchar` rather than `pgEnum` on purpose (see `EVENT_TYPES`):
     * widening the vocabulary must not need a migration. `$type` is the half
     * of that trade that costs nothing — TypeScript only, no column change and
     * no diff from `db:generate` — and it is what makes writing `'Wedding'`
     * here a compile error rather than a row the product cannot render. Three
     * seeds wrote the label before it was annotated.
     *
     * It narrows reads too, which is a claim about legacy rows this column
     * cannot make. That stays inside `packages/db`: the API re-parses the
     * column as `z.string()` on the way out, deliberately.
     */
    eventType: varchar('event_type', { length: 200 }).$type<EventType>(),
    eventLocation: varchar('event_location', { length: 500 }),
    guestCount: integer('guest_count'),
    customDetails: text('custom_details'),
    status: bookingRequestStatusEnum('status').notNull().default('pending'),
    quotedPriceCents: integer('quoted_price_cents'),
    quoteNote: text('quote_note'),
    /** Locked price: package price at request time, or the accepted quote. */
    finalPriceCents: integer('final_price_cents'),
    /**
     * When the vendor accepted. Checkout opens on "Maya accepted your request
     * on May 2", and `updated_at` cannot supply that date — writing the intent
     * id below moves it, so the line would start reporting when the customer
     * last opened checkout rather than when the vendor said yes.
     */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    /**
     * The intent the customer is paying through, recorded before they confirm.
     *
     * This is the reconciliation handle. A webhook that never arrives leaves a
     * charged customer with no booking row, and without this column that state
     * is indistinguishable from a customer who opened checkout and walked away
     * — there would be nothing to ask Stripe about.
     */
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('booking_requests_customer_status_idx').on(table.customerId, table.status),
    index('booking_requests_vendor_status_idx').on(table.vendorId, table.status),
    // Serves the lazy expiry sweep, which only ever scans pending requests.
    index('booking_requests_expires_at_idx')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'pending'`),
    /*
     * One live request per natural key, so a repeat submission — a client
     * retry, a mobile touch-and-click double fire, a network-level retry —
     * is settled by the database rather than by application timing.
     *
     * Partial on the *live* statuses, which is `pending` and `quoted`: those
     * are the ones still awaiting a decision and still sitting in the vendor's
     * queue. `pending` alone would leave the hole open, because a vendor who
     * quotes a custom request moves it out of `pending` without settling it.
     * Once a request is accepted, declined, expired or cancelled the customer
     * may legitimately ask the same vendor for the same date again.
     * `LIVE_BOOKING_REQUEST_STATUSES` is the same list, and `schema.test.ts`
     * holds the two together.
     *
     * Two indexes rather than one because `package_id` is nullable and
     * Postgres treats NULLs as distinct, which would let two identical
     * *custom* requests through a single combined index.
     */
    uniqueIndex('booking_requests_live_package_key')
      .on(table.customerId, table.vendorId, table.eventDate, table.packageId)
      .where(sql`${table.status} in ('pending', 'quoted') and ${table.packageId} is not null`),
    uniqueIndex('booking_requests_live_custom_key')
      .on(table.customerId, table.vendorId, table.eventDate)
      .where(sql`${table.status} in ('pending', 'quoted') and ${table.packageId} is null`),
  ],
);

export type BookingRequestRow = typeof bookingRequests.$inferSelect;
export type NewBookingRequestRow = typeof bookingRequests.$inferInsert;

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    requestId: uuid('request_id')
      .notNull()
      .references(() => bookingRequests.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'restrict' }),
    eventDate: date('event_date').notNull(),
    eventLocation: varchar('event_location', { length: 500 }),
    totalAmountCents: integer('total_amount_cents').notNull(),
    /** Platform commission at the rate in force when payment succeeded. */
    platformFeeCents: integer('platform_fee_cents').notNull(),
    /**
     * What the vendor is still owed, in cents.
     *
     * The split settled at payment, and it stays that figure for the life of an
     * ordinary booking. **A cancellation before the payout is released rewrites
     * it to the share the vendor keeps** — the proportion of the total that was
     * *not* refunded (D31, D3's tiers). Under the destination charge that share
     * was already in the vendor's balance and Stripe reversed only the refunded
     * proportion; under separate charges nobody holds it but Orla, so the
     * amount still owed has to be written down or it is silently kept by the
     * platform. A full refund writes `0`, and the sweep ignores a zero payout.
     */
    vendorPayoutCents: integer('vendor_payout_cents').notNull(),
    /**
     * How this booking's money was arranged when it was paid.
     *
     * **`destination` is the default, and that is the load-bearing part.** Every
     * row written before #423 was a destination charge, and so is every row the
     * old image writes during the deploy window between the migration and the
     * new code serving — neither sets this column, so both identify themselves
     * without the backfill having to reach them. Only the sweep's own model
     * releases: `separate` is written by `recordSuccessfulPayment` and by
     * nothing else.
     */
    payoutModel: payoutModelEnum('payout_model').notNull().default('destination'),
    status: bookingStatusEnum('status').notNull().default('confirmed'),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
    /**
     * The transfer that actually moved the vendor's share, once it has moved.
     *
     * Null for the life of this column until #423, because the charge was a
     * *destination* charge and its transfer was implicit — Stripe split the
     * money as the card succeeded and there was no object for the platform to
     * record. Under separate charges and transfers the platform makes the
     * transfer itself, and this is the receipt: the handle a reversal needs,
     * and the one thing that ties a booking to a movement in Stripe.
     */
    stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /**
     * When the payout sweep transferred the vendor's share. Written **only** on
     * success, together with `stripe_transfer_id`.
     *
     * A separate column rather than `stripe_transfer_id is not null` doing the
     * work, so a *failed* transfer is never indistinguishable from one that was
     * never attempted or one that completed (#423 acceptance 7). The three
     * states read off this row: never attempted is `payout_attempts = 0` with
     * this null; failed is `payout_attempts > 0` with this null and a reason;
     * released is this set. `status` cannot carry any of it — a booking is
     * `confirmed` both before and after the money moves.
     */
    payoutReleasedAt: timestamp('payout_released_at', { withTimezone: true }),
    /**
     * How many times the sweep has tried and failed to transfer this payout.
     *
     * A failed transfer leaves the booking releasable, so the next run retries
     * it — and without a counter a payout failing every quarter of an hour
     * forever looks exactly like one nobody has reached yet.
     */
    payoutAttempts: integer('payout_attempts').notNull().default(0),
    /** Why the last transfer attempt failed. Cleared when one succeeds. */
    payoutFailureReason: text('payout_failure_reason'),
    /**
     * The customer's own words about the problem they reported, kept while the
     * complaint is open and cleared when it is resolved.
     *
     * **`status = 'disputed'` is the hold, and there is deliberately no second
     * column recording that a dispute is open.** A `disputed_at` beside this one
     * would move in the same statement as the status, every time, in both
     * directions — one fact written twice and free to disagree, which is the
     * same criticism this file's `completed_at` derivation avoids. What a
     * *surface* needs is not the timestamp but the payout state, and that is
     * `payoutStatusOf`, which is the one place the status enum is read.
     */
    disputeReason: text('dispute_reason'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    /**
     * Who ended it. Null on a booking that has not been cancelled, and on the
     * rows that predate this column — a cancelled booking written before #415
     * genuinely does not record it, and guessing `customer` for those would put
     * a claim about who acted in front of the person it was done to.
     */
    cancelledBy: bookingCancelledByEnum('cancelled_by'),
    /**
     * What actually came back to the customer, in cents.
     *
     * Not derivable from this row: `calculateRefund` picks a tier from the
     * event date and the moment of cancellation (D3), and a retry that finds
     * an existing refund settles for the amount already sent rather than the
     * tier it would have chosen now. The figure the customer is told has to be
     * the one Stripe moved, so it is written down when it moves.
     */
    refundAmountCents: integer('refund_amount_cents'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One booking per accepted request — the idempotency guard for the
    // payment_intent.succeeded webhook, which may be delivered more than once.
    uniqueIndex('bookings_request_id_key').on(table.requestId),
    index('bookings_customer_idx').on(table.customerId),
    /*
     * "Which booking did Stripe just charge back?" (#431).
     *
     * The column has been written since the first payment and read by nothing
     * that filters on it until now — `findBookingForDispute` is the first
     * equality lookup, and it sits inside a webhook Stripe times out and
     * retries. Without this the handler sequentially scans every booking the
     * platform has ever taken, so the cost of answering a chargeback grows with
     * lifetime volume rather than staying flat.
     */
    index('bookings_payment_intent_idx').on(table.stripePaymentIntentId),
    index('bookings_vendor_idx').on(table.vendorId),
    /*
     * Serves the payout sweep, which runs every quarter of an hour forever and
     * only ever asks for bookings that are still owed a transfer.
     *
     * **Both halves of the predicate are load-bearing.** `payout_released_at is
     * null` is the obvious one. `status <> 'cancelled'` is the one that keeps
     * this index from growing without bound: a cancelled booking is never
     * released, so it would sit here for the life of the platform — and since
     * the scan walks the index from the *oldest* event date upward, the
     * accumulated cancellations are exactly the rows it would wade through
     * first, heap-fetching each one only to reject it on `status`. That makes
     * every sweep proportional to lifetime cancellations rather than to what is
     * actually due.
     *
     * `disputed` stays indexed, which is why the predicate excludes one status
     * rather than listing the releasable pair: resolving a dispute makes a
     * booking due again and writes neither of these columns.
     */
    index('bookings_payout_due_idx')
      .on(table.eventDate)
      .where(
        sql`${table.payoutReleasedAt} is null and ${table.payoutModel} = 'separate' and ${table.vendorPayoutCents} > 0`,
      ),
    /*
     * Serves the console's failing-payout list and its Overview count (#432) —
     * the two readers of `payoutFailingClauses`.
     *
     * Partial on the same predicate, for the same reason as the sweep's index
     * above: a failing payout is a handful of rows against every booking the
     * platform has ever taken, and both queries run on every view of the
     * Payments screen. Without it each is a sequential scan plus a sort of the
     * whole table, on the one screen an operator opens *because* money is
     * stuck.
     *
     * **`nullsFirst` is not a preference, it is what makes the sort usable.**
     * Drizzle's `desc(bookings.paidAt)` renders as a bare `ORDER BY paid_at
     * DESC`, and Postgres defaults `DESC` to `NULLS FIRST` — so an index built
     * `DESC NULLS LAST` does not match that ordering and the planner sorts in
     * memory anyway, silently, while the index still serves the filter. The
     * two have to be spelled the same way. `paid_at is not null` joins the
     * predicate as well, because the query carries it and a partial index that
     * indexes rows the query excludes is larger for nothing.
     *
     * Deliberately not an index for the unfiltered list, which shares neither
     * the predicate nor the selectivity — that one wants a plain `paid_at`
     * index and is nothing this ticket changed.
     */
    index('bookings_payout_failing_idx')
      .on(table.paidAt.desc().nullsFirst())
      .where(
        sql`${table.paidAt} is not null and ${table.payoutReleasedAt} is null and ${table.payoutAttempts} > 0`,
      ),
  ],
);

export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;
