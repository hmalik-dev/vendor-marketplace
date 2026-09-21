import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PLATFORM_SETTINGS_ID } from '@vendor-marketplace/shared';
import { users } from './users.js';

/**
 * The operator's launch switches (VEN-404), as **one row**.
 *
 * A database row rather than environment variables because a switch that needs
 * a redeploy is useless in the incident it exists for. A singleton rather than
 * a key/value table because the four values are typed, read together on every
 * guarded request, and a key nobody spelled right must not silently mean "off".
 *
 * The id is a fixed uuid, pinned by the check constraint, so a second row is
 * unrepresentable and `admin_actions.subject_id` (a uuid) can name the row. The
 * row is not inserted by the migration: a missing row reads as every switch off
 * and no cap, and the first write upserts it.
 */
export const platformSettings = pgTable(
  'platform_settings',
  {
    id: uuid('id').primaryKey().default(PLATFORM_SETTINGS_ID),
    bookingRequestsPaused: boolean('booking_requests_paused').notNull().default(false),
    checkoutPaused: boolean('checkout_paused').notNull().default(false),
    payoutReleasePaused: boolean('payout_release_paused').notNull().default(false),
    /** The closed-beta ceiling on one booking's price; null is no cap. */
    maxBookingCents: integer('max_booking_cents'),
    /**
     * The vendor gate (VEN-406): a vendor account only for an invited address.
     * Off in a fresh database; the launch check requires it on in production.
     */
    vendorInviteOnly: boolean('vendor_invite_only').notNull().default(false),
    /** The operator who last changed a value; null until the first change. */
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'platform_settings_singleton',
      sql`${table.id} = ${sql.raw(`'${PLATFORM_SETTINGS_ID}'`)}`,
    ),
    check(
      'platform_settings_max_booking_cents_positive',
      sql`${table.maxBookingCents} IS NULL OR ${table.maxBookingCents} > 0`,
    ),
  ],
).enableRLS();

export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
