import { pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { legalDocument } from '@/lib/legal-content';

const document = legalDocument('privacy');

export const metadata: Metadata = { title: pageTitle(document.title) };

/**
 * Frame `31 Privacy Policy` — the same shell as `/terms`, one page-specific
 * element.
 *
 * That element is the data map, which is a table because it is genuinely
 * tabular: what · held by · why. Its rows are the real stack — Stripe, Clerk,
 * Cloudflare R2 and this product — and a row that stops being true is a defect
 * rather than stale copy.
 */
export default function PrivacyPage(): React.ReactElement {
  return <LegalPage document={document} />;
}
