import { desc, eq } from 'drizzle-orm';
import { legalAcceptances, type LegalAcceptanceRow } from '@vendor-marketplace/db';
import type { LegalAcceptanceDocument } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * Reads and writes over `legal_acceptances`, which is append-only.
 *
 * **There is deliberately no update and no delete here**, and there is no
 * upsert either: accepting a version the vendor already holds writes another
 * row rather than touching the first, because "I accepted it twice" is a true
 * statement about what happened and the record's whole job is to be true. The
 * database refuses the other two operations regardless — see the trigger in
 * `0029` — so this is the shape of the module rather than its enforcement.
 */

export interface NewAcceptance {
  vendorId: string;
  document: LegalAcceptanceDocument;
  version: string;
  acceptedByUserId: string;
  acceptedByName: string;
  businessName: string;
  ip: string | null;
  userAgent: string | null;
}

/**
 * The most recent acceptances this vendor holds, newest first.
 *
 * Bounded, because the rows can never be deleted: a vendor with a pathological
 * number of them would otherwise put every one of them into a response, and
 * from there into the agreements table the accepted state draws. The cap is far
 * above any real history — a document version a year would take a century to
 * reach it — and the newest rows are the ones every caller wants.
 */
const MAX_ACCEPTANCES_READ = 100;

export function findAcceptances(
  db: AppDatabase,
  vendorId: string,
): Promise<readonly LegalAcceptanceRow[]> {
  return db
    .select()
    .from(legalAcceptances)
    .where(eq(legalAcceptances.vendorId, vendorId))
    .orderBy(desc(legalAcceptances.acceptedAt))
    .limit(MAX_ACCEPTANCES_READ);
}

export async function insertAcceptance(
  db: AppDatabase,
  acceptance: NewAcceptance,
): Promise<LegalAcceptanceRow> {
  const [row] = await db.insert(legalAcceptances).values(acceptance).returning();

  if (!row) {
    /*
     * A `RETURNING` that comes back empty from an insert with no `ON CONFLICT`
     * is not a case this table has — the trigger refuses updates and deletes,
     * not inserts. Loud rather than a non-null assertion: whatever produced it
     * is worth knowing about on a path that records a legal acceptance.
     */
    throw new Error('legal_acceptances: insert returned no row');
  }

  return row;
}
