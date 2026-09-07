import { pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { legalDocument } from '@/lib/legal-content';

const document = legalDocument('terms');

export const metadata: Metadata = { title: pageTitle(document.title) };

/**
 * Frame `31 Terms of Service`, in `design/delta-legal/`.
 *
 * The footer links here from every marketing page and Stripe Connect onboarding
 * asks for this URL, so it has to resolve before a vendor can be paid. The copy
 * is placeholder and lives in `content/legal/terms.md`; the layout is the
 * deliverable.
 */
export default function TermsPage(): React.ReactElement {
  return <LegalPage document={document} />;
}
