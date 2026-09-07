import {
  CURRENT_VENDOR_AGREEMENT_VERSION,
  type LegalAcceptance,
  type VendorAgreementStatus,
} from '@vendor-marketplace/shared';
import type { LegalAcceptanceRow } from '@vendor-marketplace/db';
import type { AppDatabase } from '../../lib/database.js';
import { conflict, notFound } from '../../lib/errors.js';
import { findUserById } from '../users/users.dao.js';
import { findVendorProfileByUserId } from './vendors.dao.js';
import { findAcceptances, insertAcceptance } from './legal-agreement.dao.js';

/**
 * The vendor agreement — step 3 of vendor onboarding, and the only legal
 * surface in this product with an action in it.
 *
 * The order is deliberate and stated in frame `32`: the agreement precedes
 * Stripe Connect, because the commission and the payout timing are agreed
 * *before* a payout rail exists to implement them. Accepting afterwards would
 * mean a vendor hands over bank details before knowing the commission, and a
 * refusal at step 4 would leave a verified Connect account attached to a
 * listing nobody can pay.
 */

/** What the browser sent, for the record rather than for any decision. */
export interface AcceptanceContext {
  /** The caller's address as the proxy reported it, or `null`. */
  ip: string | null;
  userAgent: string | null;
}

function toAcceptance(row: LegalAcceptanceRow): LegalAcceptance {
  return {
    document: row.document,
    version: row.version,
    acceptedAt: row.acceptedAt,
    acceptedByName: row.acceptedByName,
    businessName: row.businessName,
  };
}

/**
 * Whether this vendor holds the current agreement.
 *
 * Read from the newest **vendor agreement** row rather than from the newest row
 * of any kind: the table also carries terms-of-service acceptances, and a
 * vendor who accepted the terms yesterday has not thereby accepted the
 * agreement.
 */
export function holdsCurrentAgreement(rows: readonly LegalAcceptanceRow[]): boolean {
  return rows.some(
    (row) =>
      row.document === 'vendor_agreement' && row.version === CURRENT_VENDOR_AGREEMENT_VERSION,
  );
}

export async function readAgreementStatus(
  db: AppDatabase,
  userId: string,
): Promise<VendorAgreementStatus> {
  const vendor = await findVendorProfileByUserId(db, userId);

  if (!vendor) {
    throw notFound('You have not created a vendor profile yet');
  }

  const rows = await findAcceptances(db, vendor.id);
  const latest = rows.find((row) => row.document === 'vendor_agreement') ?? null;

  return {
    current: CURRENT_VENDOR_AGREEMENT_VERSION,
    businessName: vendor.businessName,
    accepted: latest ? toAcceptance(latest) : null,
    isCurrent: holdsCurrentAgreement(rows),
    history: rows.map(toAcceptance),
  };
}

/**
 * Records an acceptance, and answers with the status the step re-renders from.
 *
 * **The version is echoed, not assumed.** A tab left open across a release
 * would otherwise record acceptance of a document the vendor never read, which
 * is the one thing this record must never contain — so a mismatch is a 409 and
 * the step reloads at the version in force.
 *
 * The name and the business name are copied from the profile at this instant
 * and frozen on the row. Neither is taken from the request: the checkbox names
 * the business the vendor is accepting on behalf of, and a name the browser
 * supplied would be a name the vendor chose for their own record.
 */
export async function acceptVendorAgreement(
  db: AppDatabase,
  userId: string,
  version: string,
  context: AcceptanceContext,
): Promise<VendorAgreementStatus> {
  if (version !== CURRENT_VENDOR_AGREEMENT_VERSION) {
    throw conflict(
      `That is not the current agreement — ${CURRENT_VENDOR_AGREEMENT_VERSION} is. Reload and read it before accepting.`,
    );
  }

  const [vendor, user] = await Promise.all([
    findVendorProfileByUserId(db, userId),
    findUserById(db, userId),
  ]);

  if (!vendor || !user) {
    throw notFound('You have not created a vendor profile yet');
  }

  /*
   * Already held: answer, do not write.
   *
   * The table is append-only and the database refuses to remove a row while
   * the vendor exists — so an insert here on every call is an unbounded, and
   * permanently unbounded, write. A vendor who holds `v1.0` and posts `v1.0`
   * again a thousand times a minute would plant a thousand rows a minute that
   * nobody can ever clear, each carrying up to 500 bytes of a user agent they
   * chose, and `history` on this same response would carry all of them back.
   *
   * Answering instead loses nothing. "Which version did I agree to, and when"
   * is what the record is for, and the second acceptance of a version already
   * held adds no answer to it. A **new** version still adds its row, which is
   * the case the append-only rule exists for.
   */
  const held = await findAcceptances(db, vendor.id);

  if (holdsCurrentAgreement(held)) {
    return readAgreementStatus(db, userId);
  }

  await insertAcceptance(db, {
    vendorId: vendor.id,
    document: 'vendor_agreement',
    version,
    acceptedByUserId: userId,
    acceptedByName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
    businessName: vendor.businessName,
    ip: context.ip,
    userAgent: context.userAgent,
  });

  return readAgreementStatus(db, userId);
}
