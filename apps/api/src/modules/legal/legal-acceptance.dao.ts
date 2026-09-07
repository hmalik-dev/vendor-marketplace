import { and, desc, eq } from 'drizzle-orm';
import { legalAcceptances, type LegalAcceptanceRow } from '@vendor-marketplace/db';
import type { LegalAcceptanceDocument, LegalAcceptanceMethod } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * Reads and writes over `legal_acceptances`, which is append-only.
 *
 * **There is deliberately no update and no delete here**, and there is no
 * upsert either: accepting a version already held writes another row rather
 * than touching the first, because "I accepted it twice" is a true statement
 * about what happened and the record's whole job is to be true. The database
 * refuses the other two operations regardless — see the triggers in `0029` and
 * `0030` — so this is the shape of the module rather than its enforcement.
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
 * `legal_acceptances_user_document_idx` is the index it reads. Note the gate
 * itself does **not** come through here — it rides along in the `users` lookup
 * as a correlated `EXISTS` (`findSessionSubject`), because a second query on
 * every authenticated request is a second network round trip.
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

export async function insertAcceptance(
  db: AppDatabase,
  acceptance: NewAcceptance,
): Promise<LegalAcceptanceRow> {
  const [row] = await db.insert(legalAcceptances).values(acceptance).returning();

  if (!row) {
    /*
     * A `RETURNING` that comes back empty from an insert with no `ON CONFLICT`
     * is not a case this table has — the triggers refuse updates and deletes,
     * not inserts. Loud rather than a non-null assertion: whatever produced it
     * is worth knowing about on a path that records a legal acceptance.
     */
    throw new Error('legal_acceptances: insert returned no row');
  }

  return row;
}
