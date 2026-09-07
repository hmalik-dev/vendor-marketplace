import {
  CURRENT_TERMS_VERSION,
  legalDocumentSha256,
  type TermsAcceptanceStatus,
} from '@vendor-marketplace/shared';
import type { UserRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { conflict, unauthorized, validationFailed } from '../../lib/errors.js';
import { findUserByClerkIdIncludingRetired } from '../users/users.dao.js';
import { displayName, syncUserFromClerk } from '../users/users.service.js';
import type { ClerkUserSnapshot } from '../users/users.service.js';
import { findAcceptanceOfVersion, insertAcceptance } from './legal-acceptance.dao.js';
import type { NewAcceptance } from './legal-acceptance.dao.js';

/**
 * The Terms of Service acceptance — the one every single user of this product
 * makes, and the one nothing recorded until #429.
 *
 * It is captured **after** authentication rather than inside the sign-up form.
 * `sign-up-form.tsx` renders Clerk's prebuilt `<SignUp>`, so there is no seam
 * in that form to put a checkbox in, and a box on the role step before it is
 * bypassed by every social sign-up that enters Clerk directly. The gate is
 * therefore a first-sign-in interstitial that every account traverses however
 * it was created, and this module is what it posts to.
 */

/** What the browser sent, for the record rather than for any decision. */
export interface AcceptanceContext {
  /** The caller's address, already validated as one by the route, or `null`. */
  ip: string | null;
  userAgent: string | null;
}

export async function readTermsStatus(
  db: AppDatabase,
  userId: string,
): Promise<TermsAcceptanceStatus> {
  const held = await findAcceptanceOfVersion(db, userId, 'terms_of_service', CURRENT_TERMS_VERSION);

  return {
    ...unacceptedTermsStatus(),
    accepted: held !== null,
    acceptedAt: held?.acceptedAt ?? null,
  };
}

/**
 * What the interstitial reads for a session with no account row yet — which is
 * every first sign-in, and needs no query to answer.
 */
export function unacceptedTermsStatus(): TermsAcceptanceStatus {
  return {
    current: CURRENT_TERMS_VERSION,
    documentSha256: legalDocumentSha256('terms_of_service'),
    accepted: false,
    acceptedAt: null,
  };
}

/** The row this module writes, assembled once for both of its callers. */
function termsAcceptanceRow(user: UserRow, context: AcceptanceContext): NewAcceptance {
  return {
    vendorId: null,
    document: 'terms_of_service',
    version: CURRENT_TERMS_VERSION,
    documentSha256: legalDocumentSha256('terms_of_service'),
    acceptanceMethod: 'clickwrap_checkbox',
    acceptedByUserId: user.id,
    /*
     * Copied and frozen, and taken from the account rather than the request: a
     * name the browser supplied would be a name the accepter chose for their
     * own record.
     */
    acceptedByName: displayName(user),
    businessName: null,
    ip: context.ip,
    userAgent: context.userAgent,
  };
}

/**
 * Records the acceptance, creating the account row in the same transaction when
 * there is not one yet.
 *
 * **What this guarantees is that no account is *usable* without an acceptance,
 * and that is enforced by the gate rather than here.** The transaction is what
 * makes the first-sign-in case atomic — an account this path creates cannot
 * exist without its acceptance, and a failure part-way leaves neither. It is
 * deliberately not a claim that a `users` row implies an acceptance row: the
 * `user.created` webhook still writes a bare row, and that row is held at the
 * interstitial exactly like an account with no row at all.
 *
 * **The version is echoed, not assumed** — the same rule the vendor agreement
 * follows. A tab left open across a release would otherwise record acceptance
 * of a document the person never read, which is the one thing this record must
 * never contain.
 *
 * **`accepted` must be `true` on the wire.** The checkbox starts unticked and
 * the submit is disabled until it is ticked, but a disabled button is a
 * courtesy to the reader and not a rule: the rule is here, where a submission
 * that does not carry the affirmative act is refused and writes nothing.
 */
export async function acceptTerms(
  db: AppDatabase,
  clerkUserId: string,
  loadSnapshot: () => Promise<ClerkUserSnapshot>,
  input: { version: string; accepted: boolean },
  context: AcceptanceContext,
): Promise<TermsAcceptanceStatus> {
  if (!input.accepted) {
    throw validationFailed('Tick the box to accept the Terms of Service.');
  }

  if (input.version !== CURRENT_TERMS_VERSION) {
    throw conflict(
      `That is not the current version of the Terms — ${CURRENT_TERMS_VERSION} is. Reload and read them before accepting.`,
    );
  }

  /*
   * Retired rows included, and refused. `findUserByClerkId` would hide one and
   * fall through to the insert below, which then collides on `clerk_user_id`
   * and fails as an opaque 500 — and if it did not, an erased account would
   * have brought itself back by ticking a box. The gate answers this identity
   * 401 before the route runs; agreeing with it here is what keeps the two
   * modules from depending on a filter neither of them states.
   */
  const existing = await findUserByClerkIdIncludingRetired(db, clerkUserId);

  if (existing?.deletedAt) {
    throw unauthorized('No account is linked to this session');
  }

  if (existing) {
    const status = await readTermsStatus(db, existing.id);

    /*
     * Already held: answer, do not write.
     *
     * The table is append-only and the database refuses to remove a row while
     * the person exists, so an insert on every call is an unbounded and
     * permanently unbounded write. A second acceptance of a version already
     * held adds no answer to "which version did I agree to, and when" — and
     * this endpoint is reachable by anyone with a session, so the
     * reload-and-repost case is not hypothetical. A **new** version still adds
     * its row.
     */
    if (status.accepted) {
      return status;
    }

    await insertAcceptance(db, termsAcceptanceRow(existing, context));

    return readTermsStatus(db, existing.id);
  }

  /*
   * The Clerk read stays outside the transaction: it is a network call, and
   * holding a database transaction open across one is how a slow upstream
   * becomes a held connection.
   */
  const snapshot = await loadSnapshot();

  const userId = await db.transaction(async (tx) => {
    const user = await syncUserFromClerk(tx, snapshot);

    if (!user) {
      throw new Error('legal acceptance: the account row could not be resolved');
    }

    await insertAcceptance(tx, termsAcceptanceRow(user, context));

    return user.id;
  });

  return readTermsStatus(db, userId);
}
