import { and, desc, eq } from 'drizzle-orm';
import { legalAcceptances, type LegalAcceptanceRow } from '@vendor-marketplace/db';
import type { LegalAcceptanceDocument, LegalAcceptanceMethod } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * Reads and writes over `legal_acceptances`, which is append-only.
 *
 * **There is deliberately no update and no delete here.** The database refuses
 * both regardless — see the triggers in `0029` and `0030` — so this is the
 * shape of the module rather than its enforcement.
 *
 * The one write it has is an insert that **may decline to write**, because
 * `legal_acceptances_user_document_version_key` holds one row per person, per
 * document, per version (#442). Accepting a version already held is not a new
 * fact about anybody: "which version did I agree to, and when" is what the
 * record answers, and a second row carrying the same version adds nothing to
 * that answer while adding a row nobody can ever remove. A **new** version
 * still writes its row — the version is in the key.
 *
 * It sits in `modules/legal` rather than under `modules/vendors` because since
 * #429 the row is about a **user**: a customer's Terms acceptance has no vendor
 * profile at all, and the acceptance gate that reads this table runs on every
 * authenticated request regardless of role.
 */

export interface NewAcceptance {
  /** The vendor profile accepted on behalf of, or `null` for a Terms row. */
  vendorId: string | null;
  document: LegalAcceptanceDocument;
  version: string;
  /** SHA-256 of the Markdown source as served — the bytes, not the label. */
  documentSha256: string;
  acceptanceMethod: LegalAcceptanceMethod;
  acceptedByUserId: string;
  acceptedByName: string;
  /** `null` where the acceptance was made on nobody's behalf. */
  businessName: string | null;
  ip: string | null;
  userAgent: string | null;
}

/**
 * The most recent acceptances this person holds, newest first, across every
 * document.
 *
 * Bounded, because the rows can never be deleted: an account with a
 * pathological number of them would otherwise put every one of them into a
 * response, and from there into the agreements table the accepted state draws.
 * The cap is far above any real history — a document version a year would take
 * a century to reach it — and the newest rows are the ones every caller wants.
 */
const MAX_ACCEPTANCES_READ = 100;

export function findAcceptancesByUser(
  db: AppDatabase,
  userId: string,
): Promise<readonly LegalAcceptanceRow[]> {
  return db
    .select()
    .from(legalAcceptances)
    .where(eq(legalAcceptances.acceptedByUserId, userId))
    .orderBy(desc(legalAcceptances.acceptedAt))
    .limit(MAX_ACCEPTANCES_READ);
}

/**
 * When this person accepted this exact version, or `null`.
 *
 * Narrow on purpose: the callers want a timestamp or a boolean, never the row,
 * and `user_agent` is unbounded `text` that would otherwise cross the wire and
 * be decoded on a read that answers a question about one date.
 *
 * `legal_acceptances_user_document_version_key` is the index it reads, since
 * #442 added it: the three equality predicates here are exactly its columns, so
 * this is a unique single-row probe rather than the two-column prefix scan plus
 * filter it was against `legal_acceptances_user_document_idx`. The gate's own
 * read got the same lift — it does **not** come through here, it rides along in
 * the `users` lookup as a correlated `EXISTS` (`findSessionSubject`), keyed on
 * the identical three columns, because a second query on every authenticated
 * request is a second network round trip.
 */
export async function findAcceptanceOfVersion(
  db: AppDatabase,
  userId: string,
  document: LegalAcceptanceDocument,
  version: string,
): Promise<{ acceptedAt: Date } | null> {
  const [row] = await db
    .select({ acceptedAt: legalAcceptances.acceptedAt })
    .from(legalAcceptances)
    .where(
      and(
        eq(legalAcceptances.acceptedByUserId, userId),
        eq(legalAcceptances.document, document),
        eq(legalAcceptances.version, version),
      ),
    )
    .orderBy(desc(legalAcceptances.acceptedAt))
    .limit(1);

  return row ?? null;
}

/**
 * The newest acceptance of one document, or `null`.
 *
 * The vendor-agreement surfaces used to answer "does this vendor hold the
 * current version" by fetching up to a hundred rows across every document and
 * filtering in JavaScript. That is O(history) for a question with an O(1)
 * answer, and it dragged the person's Terms rows back to decide something about
 * their agreement.
 */
export async function findLatestAcceptance(
  db: AppDatabase,
  userId: string,
  document: LegalAcceptanceDocument,
): Promise<LegalAcceptanceRow | null> {
  const [row] = await db
    .select()
    .from(legalAcceptances)
    .where(
      and(eq(legalAcceptances.acceptedByUserId, userId), eq(legalAcceptances.document, document)),
    )
    .orderBy(desc(legalAcceptances.acceptedAt))
    .limit(1);

  return row ?? null;
}

/**
 * Records an acceptance, or declines to when this person already holds this
 * version of this document.
 *
 * **`null` is the second half of the outcome, not an error** (#442). Both
 * services read the held version before calling and return early when it is
 * there, so this path is normally reached only for a version nobody holds. But
 * that read is a check-then-insert, and two submissions racing from one session
 * both pass it. The unique index decides which of them wins; `DO NOTHING` is
 * what makes the other one lose *harmlessly*, instead of surfacing a 23505 as
 * an opaque 500 on the endpoint that records a legal acceptance.
 *
 * Callers do not branch on which happened, and should not: the caller's next
 * act is to re-read the status, and the status is identical either way —
 * whichever insert won, the row is there and it says the same thing. That
 * equivalence is the whole reason `DO NOTHING` is safe here rather than merely
 * quiet.
 *
 * `DO NOTHING` and not `DO UPDATE`: the row is immutable, and the trigger would
 * refuse the update anyway.
 */
export async function insertAcceptance(
  db: AppDatabase,
  acceptance: NewAcceptance,
): Promise<LegalAcceptanceRow | null> {
  const [row] = await db
    .insert(legalAcceptances)
    .values(acceptance)
    .onConflictDoNothing({
      target: [
        legalAcceptances.acceptedByUserId,
        legalAcceptances.document,
        legalAcceptances.version,
      ],
    })
    .returning();

  return row ?? null;
}
