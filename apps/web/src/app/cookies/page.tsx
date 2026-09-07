import { pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { legalDocument } from '@/lib/legal-content';

const document = legalDocument('cookies');

export const metadata: Metadata = { title: pageTitle(document.title) };

/**
 * Frame `31 Cookie notice` — deliberately thin, and deliberately without a
 * consent mechanism.
 *
 * **There is no banner, no preferences modal and no stored consent state**, and
 * that is a statement about this codebase rather than a shortcut: the tree sets
 * no cookies of its own and loads no analytics, advertising or session-recording
 * script. The only cookie is Clerk's `__session`, which is strictly necessary
 * and needs no consent. A banner over nothing is theatre, and
 * `no-cookie-consent.test.ts` asserts the absence rather than leaving it to be
 * noticed. If anything measuring behaviour is ever added, this page changes
 * first and the banner arrives with it.
 *
 * No jump rail: the page has fewer sections than `LEGAL_JUMP_RAIL_MIN_SECTIONS`,
 * so the measure re-centres rather than leaving an empty 212px column.
 */
export default function CookiesPage(): React.ReactElement {
  return <LegalPage document={document} />;
}
