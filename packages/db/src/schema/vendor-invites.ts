import { sql } from 'drizzle-orm';
import {
  check,
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
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  VENDOR_APPLICATION_STATUSES,
} from '@vendor-marketplace/shared';
import { users } from './users.js';

/*
 * The vendor gate (VEN-406). While `platform_settings.vendor_invite_only` is
 * on, the Terms acceptance creates a vendor account only for an address in
 * `vendor_invites`; everyone else choosing vendor is sent to the application
 * form, whose rows land in `vendor_applications`.
 *
 * Both tables key on the address **lowercased**, pinned by a check, so the
 * unique index is a case-insensitive uniqueness and the gate's lookup is one
 * equality on the index rather than a `lower()` scan.
 */

export const vendorApplicationStatusEnum = pgEnum(
  'vendor_application_status',
  VENDOR_APPLICATION_STATUSES,
);

export const vendorInvites = pgTable(
  'vendor_invites',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: varchar('email', { length: MAX_EMAIL_LENGTH }).notNull(),
    /** The operator who sent it; null once that account is gone, or for a seeded invite. */
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** When the invited address opened its vendor account. */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('vendor_invites_email_key').on(table.email),
    check('vendor_invites_email_lowercase', sql`${table.email} = lower(${table.email})`),
  ],
);

export type VendorInviteRow = typeof vendorInvites.$inferSelect;

export const vendorApplications = pgTable(
  'vendor_applications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: varchar('email', { length: MAX_EMAIL_LENGTH }).notNull(),
    businessName: varchar('business_name', { length: MAX_NAME_LENGTH }).notNull(),
    category: varchar('category', { length: MAX_NAME_LENGTH }).notNull(),
    city: varchar('city', { length: MAX_NAME_LENGTH }).notNull(),
    message: text('message').notNull(),
    status: vendorApplicationStatusEnum('status').notNull().default('new'),
    /**
     * What the application was before an invite marked it `invited`, so revoking
     * that invite puts a declined applicant back to declined rather than waiting.
     * Null when there was nothing to restore.
     */
    statusBeforeInvite: vendorApplicationStatusEnum('status_before_invite'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('vendor_applications_email_key').on(table.email),
    index('vendor_applications_created_at_idx').on(table.createdAt),
    check('vendor_applications_email_lowercase', sql`${table.email} = lower(${table.email})`),
  ],
);

export type VendorApplicationRow = typeof vendorApplications.$inferSelect;
