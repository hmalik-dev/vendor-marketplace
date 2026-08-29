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
import { bookingRequestStatusEnum, bookingStatusEnum } from './enums.js';
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
    eventType: varchar('event_type', { length: 200 }),
    eventLocation: varchar('event_location', { length: 500 }),
    guestCount: integer('guest_count'),
    customDetails: text('custom_details'),
    status: bookingRequestStatusEnum('status').notNull().default('pending'),
    quotedPriceCents: integer('quoted_price_cents'),
    quoteNote: text('quote_note'),
    /** Locked price: package price at request time, or the accepted quote. */
    finalPriceCents: integer('final_price_cents'),
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
    vendorPayoutCents: integer('vendor_payout_cents').notNull(),
    status: bookingStatusEnum('status').notNull().default('confirmed'),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
    stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One booking per accepted request — the idempotency guard for the
    // payment_intent.succeeded webhook, which may be delivered more than once.
    uniqueIndex('bookings_request_id_key').on(table.requestId),
    index('bookings_customer_idx').on(table.customerId),
    index('bookings_vendor_idx').on(table.vendorId),
  ],
);

export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;
