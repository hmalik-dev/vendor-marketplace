import { LEGAL_PATHS, pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { vendorAgreementDocument } from '@/lib/legal-content';

const document = vendorAgreementDocument();

export const metadata: Metadata = {
  title: pageTitle(document.title),
  alternates: { canonical: LEGAL_PATHS['vendor-agreement'] },
};

/**
 * The vendor agreement, for reading before signing up (VEN-402).
 *
 * `/for-vendors` links here from its closing band and its footer legal row. The
 * only other route the agreement has is `/vendor/agreement`, which is gated to
 * vendors — and `/for-vendors` sends vendors away, so every reader who could see
 * those links was turned away by them. This page is public and read-only: the
 * accept action stays in onboarding step 3, where there is a vendor to record.
 *
 * Built to frame `31`'s reading layout, the same `LegalPage` the three footer
 * documents use, over the same parsed document the accept step clips.
 */
export default function VendorAgreementReadingPage(): React.ReactElement {
  return <LegalPage document={document} />;
}
