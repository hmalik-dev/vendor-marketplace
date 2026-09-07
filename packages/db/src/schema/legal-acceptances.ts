import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { LEGAL_ACCEPTANCE_DOCUMENTS } from '@vendor-marketplace/shared';
import { users } from './users.js';
import { vendorProfiles } from './vendor-profiles.js';

export const legalDocumentEnum = pgEnum('legal_document', LEGAL_ACCEPTANCE_DOCUMENTS);

/**
 * One row per acceptance of one legal document, and **it is never updated and
 * never deleted**.
 *
 * "Which version did I agree to" is a real question the moment the agreement
 * changes, and it is the question a vendor asks when they are disputing a
 * commission. An `accepted_version` column on `vendor_profiles` would answer it
 * with whatever is true today; this answers it with what was true then. A new
 * version therefore **adds a row** — it does not replace one — and the PDF a
 * vendor downloads renders the version stored on their row rather than the
 * current one.
 *
 * The columns past the foreign keys are the evidence, not decoration:
 * `accepted_by_name` and `business_name` are copies, deliberately, because a
 * vendor who later renames their business must not thereby rewrite who accepted
 * what on whose behalf. `ip` and `user_agent` are what makes the record worth
 * anything in a dispute.
 *
 * **Immutability is enforced in the database**, by the trigger the migration
 * installs — not by a DAO that happens to have no update method. A rule kept in
 * application code is one each new writer has to remember, and this table will
 * outlive the writers it has today.
 *
 * The invariant is exact: **a row can never be altered, and can never be
 * removed while the vendor it is about still exists.** Erasing the whole vendor
 * account does take the acceptances with it — both foreign keys cascade — and
 * that is the one delete the trigger allows, because an acceptance with no
 * vendor behind it records nothing. What is made impossible is tampering: an
 * edit, or a row quietly dropped out from under a live vendor.
 * `legal-acceptance-immutability.test.ts` proves all three by attempting them
 * rather than by reading the DDL.
 */
export const legalAcceptances = pgTable(
  'legal_acceptances',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    document: legalDocumentEnum('document').notNull(),
    /** The version string as it stood when this was accepted — `v1.0`. */
    version: varchar('version', { length: 20 }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedByUserId: uuid('accepted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The person's name at the moment of acceptance, copied and frozen. */
    acceptedByName: varchar('accepted_by_name', { length: 200 }).notNull(),
    /** The business the acceptance was made on behalf of, copied and frozen. */
    businessName: varchar('business_name', { length: 200 }).notNull(),
    /** `null` where the request carried no forwarded address to record. */
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
  },
  (table) => [
    /*
     * The read this table exists to serve: does this vendor hold the current
     * version of this document. Newest first, because every caller wants the
     * latest row and none wants the first.
     */
    index('legal_acceptances_vendor_document_idx').on(
      table.vendorId,
      table.document,
      table.acceptedAt.desc(),
    ),
  ],
);

export type LegalAcceptanceRow = typeof legalAcceptances.$inferSelect;
export type NewLegalAcceptanceRow = typeof legalAcceptances.$inferInsert;
