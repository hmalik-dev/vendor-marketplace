import { BRAND_NAME } from './brand.js';
import {
  BOOKING_REQUEST_EXPIRY_DAYS,
  DEFAULT_PLATFORM_FEE_RATE,
  FULL_REFUND_CUTOFF_HOURS,
  LATE_CANCELLATION_REFUND_RATE,
  PAYOUT_RELEASE_HOURS,
} from './index.js';

/**
 * The legal surfaces — frames `31`, `32` and `33` in `design/delta-legal/`.
 *
 * Everything here is vocabulary both apps read from. **The prose is
 * placeholder and the facts are not**: the copy under `content/legal/` ships as
 * replaceable filler, but every number in it resolves through
 * `LEGAL_FACT_TOKENS` below rather than being typed into the markdown, so a
 * page cannot promise something the money code will not do.
 */

/** The three reading pages, and the order the footer's legal row lists them. */
export const LEGAL_DOCUMENT_SLUGS = ['terms', 'privacy', 'cookies'] as const;
export type LegalDocumentSlug = (typeof LEGAL_DOCUMENT_SLUGS)[number];

/**
 * Every document written in the legal Markdown, routed or not.
 *
 * The vendor agreement is the one that is not a page: it is read inside step 3
 * of onboarding, in a card that clips to 150px and expands in place. It is
 * written in the same format and rendered by the same blocks, because it is the
 * same kind of document and two prose pipelines would drift.
 */
export const LEGAL_CONTENT_SLUGS = [...LEGAL_DOCUMENT_SLUGS, 'vendor-agreement'] as const;
export type LegalContentSlug = (typeof LEGAL_CONTENT_SLUGS)[number];

/** Where each page lives, so a link is never a hand-typed string. */
export const LEGAL_PATHS: Record<LegalDocumentSlug, string> = {
  terms: '/terms',
  privacy: '/privacy',
  cookies: '/cookies',
};

/**
 * A page shows the jump rail only at this many top-level sections or more.
 *
 * `/terms` and `/privacy` clear it; `/cookies` does not and must not render an
 * empty 212px column beside a short page — its measure re-centres instead.
 */
export const LEGAL_JUMP_RAIL_MIN_SECTIONS = 6;

/**
 * The documents an account can be asked to accept.
 *
 * **Both have a writer.** `vendor_agreement` is step 3 of vendor onboarding;
 * `terms_of_service` is the first-sign-in gate at `TERMS_ACCEPTANCE_PATH`,
 * which every account traverses however it was created. It was an unwritten
 * enum value until #429 — the shape `disputed` had before #425 gave it one —
 * and the reason it could not be written was that the row was anchored to a
 * vendor profile a customer does not have.
 */
export const LEGAL_ACCEPTANCE_DOCUMENTS = ['vendor_agreement', 'terms_of_service'] as const;
export type LegalAcceptanceDocument = (typeof LEGAL_ACCEPTANCE_DOCUMENTS)[number];

/**
 * What each document is called on a vendor's own surfaces.
 *
 * Read rather than written into the table's first column, which hardcoded
 * `Vendor agreement` for every row — so the first `terms_of_service` row would
 * have been labelled as the wrong document in the one place a vendor goes to
 * find out what they accepted.
 */
export const LEGAL_ACCEPTANCE_LABELS: Record<LegalAcceptanceDocument, string> = {
  vendor_agreement: 'Vendor agreement',
  terms_of_service: 'Terms of Service',
};

/**
 * The version of the vendor agreement a vendor must hold to take payments.
 *
 * **Acceptance is one immutable row per acceptance.** Raising this string does
 * not rewrite anybody's record — it adds a row when they accept the new one,
 * and until they do, `hasCurrentVendorAgreement` reads false and the dashboard
 * carries the blocker banner. "Which version did I agree to" stays answerable.
 */
export const CURRENT_VENDOR_AGREEMENT_VERSION = 'v1.0';

/** How the agreement names itself on the vendor's own surfaces. */
export const VENDOR_AGREEMENT_TITLE = 'Vendor agreement';

/**
 * Step 3 of onboarding, and afterwards the vendor's own record of it.
 *
 * One route for both states rather than a step and a settings page: they read
 * the same row and answer the same question, and a second URL for the accepted
 * half would be a second place to keep in step with the first.
 */
export const VENDOR_AGREEMENT_PATH = '/vendor/agreement';

/**
 * Every number the legal copy is allowed to state, resolved from the constant
 * that decides it.
 *
 * **This is the whole of acceptance 15.** A markdown file that types `12%`
 * is correct today and wrong the first hour the rate moves, and nothing fails
 * when it becomes so — so the markdown types `{{commission}}` and this table
 * is the only place the digits exist. `legal-facts.test.ts` asserts both
 * halves: that each value derives from its constant, and that no file under
 * `content/legal/` contains the digits directly.
 */
export function legalFactTokens(): Record<string, string> {
  return {
    brand: BRAND_NAME,
    commission: formatRate(DEFAULT_PLATFORM_FEE_RATE),
    fullRefundCutoffHours: `${FULL_REFUND_CUTOFF_HOURS} hours`,
    lateRefundShare: formatRate(LATE_CANCELLATION_REFUND_RATE),
    payoutReleaseHours: `${PAYOUT_RELEASE_HOURS} hours`,
    requestExpiryDays: `${BOOKING_REQUEST_EXPIRY_DAYS} days`,
  };
}

/**
 * A fraction as the percentage a reader recognises — `0.12` -> `12%`.
 *
 * Trailing zeroes dropped, because `12.00%` in a sentence reads as a rate
 * quoted to two decimals it does not have.
 */
export function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`;
}

/**
 * The one sentence every surface uses for when the vendor is paid.
 *
 * `PAYOUT_RELEASE_HOURS` (D35) is read, never restated: the vendor agreement's
 * four-terms panel, the accepted-state strip and `/terms` section 4 all say
 * this, and three copies of "72" is three places to miss when it changes.
 *
 * Module-private, and reached through `vendorAgreementTerms` below. It is one
 * fact stated once, not a formatter a caller picks from.
 */
function payoutTimingSentence(): string {
  return `Released ${PAYOUT_RELEASE_HOURS} hours after the event date, then Stripe's own transfer time to the bank.`;
}

/** The same interval as a display figure — the panel's 27px serif value. */
function payoutTimingFigure(): string {
  return `Event + ${PAYOUT_RELEASE_HOURS}h`;
}

/**
 * The four terms that cost a vendor money, stated once.
 *
 * A vendor who reads only this panel has still read the commercially material
 * terms — that is the design intent of frame `32`, and it is why the figures
 * come from the constants rather than from prose written beside them.
 *
 * **The design's "repeated cancellations can end your listing" is cut**, not
 * reworded. Nothing in this product describes an enforcement process, and a
 * threat that cannot be executed is worse than silence.
 */
export function vendorAgreementTerms(): readonly {
  label: string;
  figure: string | null;
  body: string;
}[] {
  return [
    {
      label: 'Commission',
      figure: formatRate(DEFAULT_PLATFORM_FEE_RATE),
      body: 'Deducted from each booking when it is released. Nothing monthly, nothing for listing.',
    },
    {
      label: 'Payout timing',
      figure: payoutTimingFigure(),
      body: payoutTimingSentence(),
    },
    {
      label: 'Cancellations',
      figure: null,
      body: 'If you cancel a confirmed booking the customer is refunded in full and no commission is taken.',
    },
    {
      label: 'Your prices',
      figure: null,
      body: `You set them and you keep them accurate. ${BRAND_NAME} adds no fee on top, so the customer pays exactly what you published.`,
    },
  ];
}

/**
 * The version of the Terms of Service every account must hold.
 *
 * The same shape as `CURRENT_VENDOR_AGREEMENT_VERSION` and for the same
 * reason: raising it does not rewrite anybody's record, it adds a row when they
 * accept the new one, and until they do the account is held at the acceptance
 * gate. It is a version a human chose — never derived from the document hash,
 * because a typo fix nobody needs to re-accept would move a derived one and put
 * every signed-in account back through the gate for a corrected comma.
 */
export const CURRENT_TERMS_VERSION = 'v1.0';

/**
 * How an acceptance was made, recorded on the row.
 *
 * Without it a later flow that accepts some other way is retroactively
 * indistinguishable from this one, and "how did they accept" is the first
 * question asked of a clickwrap record that is challenged.
 *
 * - `clickwrap_checkbox` — an unticked box the person ticked, with the document
 *   named and linked beside it. Both real writers use this.
 * - `seed_fixture` — written by `db:seed:e2e` so an automated pass can reach the
 *   surfaces behind the gate. It is **not** a claim that a person accepted
 *   anything, and labelling it as one would put a fabricated act in the one
 *   table whose whole value is that it is true.
 */
export const LEGAL_ACCEPTANCE_METHODS = ['clickwrap_checkbox', 'seed_fixture'] as const;
export type LegalAcceptanceMethod = (typeof LEGAL_ACCEPTANCE_METHODS)[number];

/**
 * Which Markdown file each acceptable document is, so the hash recorded on a
 * row and the prose the person read cannot be sourced from different places.
 */
export const LEGAL_ACCEPTANCE_CONTENT: Record<LegalAcceptanceDocument, LegalContentSlug> = {
  vendor_agreement: 'vendor-agreement',
  terms_of_service: 'terms',
};

/**
 * The first-sign-in acceptance gate — the only page an account that has not
 * accepted the current Terms can reach.
 *
 * It is on `/after-sign-in`'s path rather than inside the sign-up form because
 * `sign-up-form.tsx` renders Clerk's prebuilt `<SignUp>`: there is no seam in
 * that form to put a checkbox in, and a box on the role step before it is
 * bypassed by every social sign-up that enters Clerk directly. Every account
 * traverses this, however it was created.
 */
export const TERMS_ACCEPTANCE_PATH = '/accept-terms';
