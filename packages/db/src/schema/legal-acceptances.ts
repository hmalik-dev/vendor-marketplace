import { sql } from 'drizzle-orm';
import {
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
     * "The newest acceptance of this document by this person", which since #442
     * is the only read that still wants the `accepted_at` ordering:
     * `findLatestAcceptance` uses it, while the two readers that name a version
     * — `findAcceptanceOfVersion` and the gate's correlated `EXISTS` in
     * `findSessionSubject` — moved to the unique key below, whose three columns
     * are exactly their three equality predicates. Kept rather than dropped for
     * that one caller; the sort it saves is now over a handful of rows, because
     * the key caps this pair at one row per version.
     *
     * Anchored on the user rather than the vendor because a customer has no
     * vendor profile, and because since #429 the user is what a row is about.
     */
    index('legal_acceptances_user_document_idx').on(
      table.acceptedByUserId,
      table.document,
      table.acceptedAt.desc(),
    ),
    /*
     * One row per person, per document, per version — enforced here rather than
     * believed in the services (#442).
     *
     * Both writers already refuse a repeat: `acceptTerms` and
     * `acceptVendorAgreement` each read the held version and return early under
     * the comment *"Already held: answer, do not write"*. That read is a
     * check-then-insert with nothing behind it, so two submissions racing from
     * one session both read *not held* and both insert — into the one table a
     * trigger makes permanent. This turns the early return from a courtesy into
     * the guarantee those two comments already believe they have.
     *
     * **`vendor_id` is deliberately not in the key.** A vendor-agreement row
     * carries one and a Terms row carries `null`, but `vendor_profiles_user_id_key`
     * makes a profile unique per user, so `vendor_id` is functionally determined
     * by `accepted_by_user_id` and adds nothing to the key. Leaving it out also
     * keeps every column of this index `NOT NULL`, which matters: Postgres
     * treats nulls as *distinct* in a unique index, so a key carrying
     * `vendor_id` would not constrain Terms rows at all — every one of them
     * would be unique to itself and the race would stay open on the writer that
     * has the most traffic.
     *
     * A **new version** still adds its row, which is the case the append-only
     * rule exists for: the version is in the key.
     *
     * **`0039` deliberately ships no dedupe ahead of this, unlike `0008` and
     * `0023`.** Both of those cleared colliding rows in the migration before
     * the index, and the bar `0023` sets for doing so is the reason this does
     * not: it spends its header saying exactly what each deleted row discards
     * and who is affected, and ends *"if a duplicate is ever found in a real
     * database, do not run this as written"*. That justification cannot be
     * made here. These rows are legal evidence, `legal_acceptances_no_delete`
     * refuses to remove one while the person exists, and clearing a loser would
     * mean a migration running `DISABLE TRIGGER` over the one table whose value
     * is that it cannot be edited. #442 was explicit that such a repair is a
     * decision rather than a migration.
     *
     * So the deploy stopping is the intended behaviour, and it was checked
     * rather than hoped for: `legal_acceptances` does not exist in the local
     * development database or in either Neon branch, and the only database that
     * has it holds no colliding pair. If `pnpm db:migrate` ever fails here,
     * that is the check reporting a state nobody has ruled on — hand it to a
     * person rather than disabling the trigger.
     */
    uniqueIndex('legal_acceptances_user_document_version_key').on(
      table.acceptedByUserId,
      table.document,
      table.version,
    ),
  ],
);

export type LegalAcceptanceRow = typeof legalAcceptances.$inferSelect;
export type NewLegalAcceptanceRow = typeof legalAcceptances.$inferInsert;
