import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  LEGAL_ACCEPTANCE_DOCUMENTS,
  LEGAL_ACCEPTANCE_METHODS,
  LEGAL_DOCUMENT_SHA256_LENGTH,
} from '@vendor-marketplace/shared';
import { users } from './users.js';
import { vendorProfiles } from './vendor-profiles.js';

export const legalDocumentEnum = pgEnum('legal_document', LEGAL_ACCEPTANCE_DOCUMENTS);
export const legalAcceptanceMethodEnum = pgEnum(
  'legal_acceptance_method',
  LEGAL_ACCEPTANCE_METHODS,
);

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
 * removed while the person it is about still exists.** Erasing the account does
 * take their acceptances with it — the foreign key cascades — and that is the
 * delete the trigger allows, because an acceptance with nobody behind it
 * records nothing. A vendor-agreement row is additionally removable when the
 * vendor profile it names is erased, which is the cascade #427 built for and
 * the one this table has always allowed. What is made impossible is tampering:
 * an edit, or a row quietly dropped out from under a live account.
 *
 * **The anchor moved to the user in #429, and the rule had to move with it.**
 * The old discriminator was the vendor's absence alone, which on a Terms row
 * carrying a null `vendor_id` reads as "the vendor is gone" for every row — so
 * leaving it would have made every customer's acceptance freely deletable the
 * moment the column became nullable. `legal-acceptance-immutability.test.ts`
 * proves each branch by attempting it rather than by reading the DDL.
 */
export const legalAcceptances = pgTable(
  'legal_acceptances',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /**
     * The vendor profile this acceptance was made on behalf of, or `null`.
     *
     * **Context, not the subject.** It is set on a vendor-agreement row and
     * null on a customer's Terms acceptance — the acceptance every single user
     * of this product makes, and the one that had nowhere to go while this
     * column was `NOT NULL` (#429). `accepted_by_user_id` is the anchor.
     */
    vendorId: uuid('vendor_id').references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    document: legalDocumentEnum('document').notNull(),
    /** The version string as it stood when this was accepted — `v1.0`. */
    version: varchar('version', { length: 20 }).notNull(),
    /**
     * SHA-256 of the Markdown source of the document as it was served, so the
     * row says what was accepted and not only which label it carried.
     *
     * The version is a name a human chose; this is the bytes. `terms.md` is
     * explicitly placeholder copy that will be replaced, so without this an
     * edit that skipped a version bump left every existing row attesting to
     * text that no longer exists, unreconstructably. Pinned in
     * `LEGAL_DOCUMENT_MANIFEST` and asserted against the file by the suite.
     */
    documentSha256: varchar('document_sha256', {
      length: LEGAL_DOCUMENT_SHA256_LENGTH,
    }).notNull(),
    /**
     * How it was accepted — an unticked box the person ticked, or a seed.
     *
     * Recorded so a later flow that accepts some other way is distinguishable
     * from this one rather than retroactively indistinguishable from it, which
     * is unrecoverable on a table that refuses updates.
     */
    acceptanceMethod: legalAcceptanceMethodEnum('acceptance_method').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
    /** The subject of the row: the person who accepted. */
    acceptedByUserId: uuid('accepted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The person's name at the moment of acceptance, copied and frozen. */
    acceptedByName: varchar('accepted_by_name', { length: 200 }).notNull(),
    /**
     * The business the acceptance was made on behalf of, copied and frozen, or
     * `null` where there was none.
     *
     * Nullable alongside `vendor_id` rather than written as an empty string: a
     * customer accepting the Terms accepts on nobody's behalf, and `''` in this
     * column would be a claim about a business rather than the absence of one.
     */
    businessName: varchar('business_name', { length: 200 }),
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
    /*
     * The read the acceptance gate performs on **every authenticated request**:
     * does this user hold the current version of this document. Anchored on the
     * user rather than the vendor because a customer has no vendor profile, and
     * because since #429 the user is what a row is about.
     */
    index('legal_acceptances_user_document_idx').on(
      table.acceptedByUserId,
      table.document,
      table.acceptedAt.desc(),
    ),
  ],
);

export type LegalAcceptanceRow = typeof legalAcceptances.$inferSelect;
export type NewLegalAcceptanceRow = typeof legalAcceptances.$inferInsert;
