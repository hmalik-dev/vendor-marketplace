import {
  CURRENT_TERMS_VERSION,
  legalDocumentSha256,
  type SignUpRole,
  type TermsAcceptanceStatus,
} from '@vendor-marketplace/shared';
import type { UserRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { conflict, unauthorized, validationFailed } from '../../lib/errors.js';
import { findUserByAuthId, findUserByAuthIdIncludingRetired } from '../users/users.dao.js';
import { displayName, normalizeRole, syncUserFromAuth } from '../users/users.service.js';
import { deleteSignUpRole, findSignUpRole } from '../users/sign-up-roles.dao.js';
import {
  admitVendor,
  invitedRoleHint,
  readVendorWaitlistStatus,
  seedApplicationOnRefusal,
} from '../vendor-invites/vendor-invites.service.js';
import { createDraftVendorProfile } from '../vendors/vendors.service.js';
import type { AuthUserSnapshot } from '../users/users.service.js';
import {
  findAcceptanceOfVersion,
  findAcceptancesByUser,
  insertAcceptance,
} from './legal-acceptance.dao.js';
import type { NewAcceptance } from './legal-acceptance.dao.js';

/**
 * The Terms of Service acceptance — the one every single user of this product
 * makes, and the one nothing recorded until #429.
 *
 * It is captured **after** authentication rather than inside the sign-up form.
 * `sign-up-form.tsx` renders the auth provider's prebuilt `<SignUp>`, so there is no seam
 * in that form to put a checkbox in, and a box on the role step before it is
 * bypassed by every social sign-up that enters the auth provider directly. The gate is
 * therefore a first-sign-in interstitial that every account traverses however
 * it was created, and this module is what it posts to.
 */

/** What the browser sent, for the record rather than for any decision. */
export interface AcceptanceContext {
  /** The caller's address, already validated as one by the route, or `null`. */
  ip: string | null;
  userAgent: string | null;
}

/**
 * What the interstitial reads.
 *
 * An account row answers from the database — the acceptance it holds and the
 * **stored** role, which is what the screen shows read-only. A session with no
 * row yet (every first sign-in) answers with the role recorded for this
 * identity at sign-up (VEN-662), which the screen states rather than asks, and
 * whether its address carries an unused invite or a waitlist row.
 */
export async function readTermsStatus(
  db: AppDatabase,
  authUserId: string,
  loadSnapshot: () => Promise<AuthUserSnapshot>,
): Promise<TermsAcceptanceStatus> {
  const user = await findUserByAuthId(db, authUserId);

  if (user) {
    return termsStatusOf(db, user);
  }

  const signUpRole = await findSignUpRole(db, authUserId);

  /*
   * Best effort: the suggestion only preselects a choice the person confirms,
   * so an identity provider that is briefly down must not take this screen —
   * the only one that can create the account — down with it.
   */
  const email = await loadSnapshot().then(
    (snapshot) => snapshot.email,
    () => null,
  );

  if (email === null) {
    return { ...unacceptedTermsStatus(), signUpRole };
  }

  const [suggestedRole, vendorWaitlist] = await Promise.all([
    invitedRoleHint(db, email).then((hint) => hint ?? null),
    readVendorWaitlistStatus(db, email),
  ]);

  return { ...unacceptedTermsStatus(), signUpRole, suggestedRole, vendorWaitlist };
}

/** The status of an account that exists: its acceptance and the role the server stored. */
async function termsStatusOf(db: AppDatabase, user: UserRow): Promise<TermsAcceptanceStatus> {
  const held = await findAcceptanceOfVersion(
    db,
    user.id,
    'terms_of_service',
    CURRENT_TERMS_VERSION,
  );
  /*
   * An earlier version on file is what separates a re-acceptance (explicit
   * tick) from a first one (a notice, made with the account). A retired row is
   * never asked; the gate answers it 401 first.
   */
  const acceptedEarlier =
    held === null &&
    (await findAcceptancesByUser(db, user.id)).some((row) => row.document === 'terms_of_service');

  return {
    ...unacceptedTermsStatus(),
    accepted: held !== null,
    acceptedAt: held?.acceptedAt ?? null,
    explicitTickRequired: acceptedEarlier,
    account: { exists: true, role: user.role },
  };
}

/** A session with no account row: nothing accepted, no role stored, nothing suggested. */
function unacceptedTermsStatus(): TermsAcceptanceStatus {
  return {
    current: CURRENT_TERMS_VERSION,
    documentSha256: legalDocumentSha256('terms_of_service'),
    accepted: false,
    acceptedAt: null,
    explicitTickRequired: false,
    account: { exists: false, role: null },
    signUpRole: null,
    suggestedRole: null,
    vendorWaitlist: { exists: false, complete: false },
  };
}

/**
 * The vendor gate, and — for a vendor it just admitted — the draft profile
 * built from their waitlist application (VEN-514). A no-op for any other role,
 * same as {@link admitVendor} itself; kept together because both callers below
 * need exactly this pair, in this order, inside the same transaction.
 */
async function admitVendorWithDraftProfile(
  tx: AppDatabase,
  user: UserRow,
  log: { warn: (details: unknown, message: string) => void } | undefined,
): Promise<void> {
  await admitVendor(tx, user.role, user.email);

  if (user.role === 'vendor') {
    await createDraftVendorProfile(tx, user.id, user.email, log);
  }
}

/** The row this module writes, assembled once for both of its callers. */
function termsAcceptanceRow(
  user: UserRow,
  context: AcceptanceContext,
  method: 'clickwrap_checkbox' | 'continue_notice',
): NewAcceptance {
  return {
    vendorId: null,
    document: 'terms_of_service',
    version: CURRENT_TERMS_VERSION,
    documentSha256: legalDocumentSha256('terms_of_service'),
    acceptanceMethod: method,
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
 * **A first acceptance is made by continuing, under a notice** (VEN-507): the
 * screen names the Terms and the Privacy Policy beside the submit, and the row
 * says so (`continue_notice`) — it never claims a box was ticked. **A new
 * version is different**: an account that accepted an earlier one must send
 * `accepted: true`, from a box the person ticked, or nothing is written. An
 * explicit `false` is refused in both cases.
 */
export async function acceptTerms(
  db: AppDatabase,
  authUserId: string,
  loadSnapshot: () => Promise<AuthUserSnapshot>,
  input: { version: string; accepted?: boolean | undefined; role?: SignUpRole | undefined },
  context: AcceptanceContext,
  log?: { warn: (details: unknown, message: string) => void },
): Promise<TermsAcceptanceStatus> {
  if (input.accepted === false) {
    throw validationFailed('Tick the box to accept the Terms of Service.');
  }

  if (input.version !== CURRENT_TERMS_VERSION) {
    throw conflict(
      `That is not the current version of the Terms — ${CURRENT_TERMS_VERSION} is. Reload and read them before accepting.`,
    );
  }

  /*
   * Retired rows included, and refused. `findUserByAuthId` would hide one and
   * fall through to the insert below, which then collides on `auth_user_id`
   * and fails as an opaque 500 — and if it did not, an erased account would
   * have brought itself back by ticking a box. The gate answers this identity
   * 401 before the route runs; agreeing with it here is what keeps the two
   * modules from depending on a filter neither of them states.
   */
  const existing = await findUserByAuthIdIncludingRetired(db, authUserId);

  if (existing?.deletedAt) {
    throw unauthorized('No account is linked to this session');
  }

  if (existing) {
    const status = await termsStatusOf(db, existing);

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

    /*
     * A new version needs the tick. The status says whether this is one: an
     * earlier acceptance is on file and the current one is not.
     */
    if (status.explicitTickRequired && input.accepted !== true) {
      throw validationFailed('Tick the box to accept the Terms of Service.');
    }

    /*
     * The vendor gate (VEN-406) for a row that has no acceptance yet: it is not
     * an account until this one, so it is held to the same rule as the path
     * below. An account that has accepted *any* version already exists and is
     * not re-gated by a new version of the Terms.
     */
    try {
      await db.transaction(async (tx) => {
        if (!status.explicitTickRequired) {
          await admitVendorWithDraftProfile(tx, existing, log);
        }

        await insertAcceptance(
          tx,
          termsAcceptanceRow(
            existing,
            context,
            status.explicitTickRequired ? 'clickwrap_checkbox' : 'continue_notice',
          ),
        );
      });
    } catch (error) {
      await seedApplicationOnRefusal(db, error, existing.email);
    }

    return termsStatusOf(db, existing);
  }

  /*
   * **A role is required, and nothing defaults one.** The account is created
   * with the role recorded for this identity at sign-up (VEN-662) — which wins
   * over one in the body, so the choice the form said "can't be changed later"
   * is the one that stands — and only where nothing was recorded, with the
   * body's (a page served before the record existed still sends it). Never an
   * invite that may not be theirs, or a default: a vendor who verified on
   * another device would otherwise become a customer for good (VEN-507).
   * Refused before the identity read, so nothing is fetched or written for a
   * request that cannot succeed.
   */
  const role = (await findSignUpRole(db, authUserId)) ?? normalizeRole(input.role);

  /*
   * The identity read stays outside the transaction: it is a network call, and
   * holding a database transaction open across one is how a slow upstream
   * becomes a held connection.
   */
  const snapshot = { ...(await loadSnapshot()), roleHint: role };

  let user: UserRow;

  try {
    user = await db.transaction(async (tx) => {
      const row = await syncUserFromAuth(tx, snapshot);

      if (!row) {
        throw new Error('legal acceptance: the account row could not be resolved');
      }

      /*
       * The vendor gate (VEN-406), on the row as saved rather than the choice:
       * a concurrent accept for this identity can win the insert, and then the
       * row returned carries **its** role — first commit wins, and this request
       * reports it. A refusal rolls the whole transaction back, so no account this
       * path wrote and no acceptance survives it.
       */
      await admitVendorWithDraftProfile(tx, row, log);

      await insertAcceptance(tx, termsAcceptanceRow(row, context, 'continue_notice'));

      // Spent with the account it created; a refused vendor keeps theirs for a return visit.
      await deleteSignUpRole(tx, authUserId);

      return row;
    });
  } catch (error) {
    await seedApplicationOnRefusal(db, error, snapshot.email);
    throw error;
  }

  return termsStatusOf(db, user);
}
