import { pageTitle, VENDOR_AGREEMENT_TITLE } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VendorAgreementScreen } from '@/components/vendor/vendor-agreement-screen';
import { requireRole } from '@/lib/current-user';
import { vendorAgreementDocument } from '@/lib/legal-content';
import { getAgreementStatus, getPayoutStatus } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle(VENDOR_AGREEMENT_TITLE) };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

/**
 * Acceptance state changes on this vendor's own action and gates their
 * payments; never serve it stale.
 */
export const dynamic = 'force-dynamic';

/**
 * Frame `32` — step 3 of vendor onboarding.
 *
 * Not a page behind a footer link: it has an action, and accepting leaves a
 * durable record. It sits **before** Stripe Connect on purpose, so the
 * commission and the payout timing are agreed before a payout rail exists to
 * implement them.
 */
export default async function VendorAgreementPage(): Promise<React.ReactElement> {
  /*
   * Independent, so they go out together. The same 404-means-no-profile-yet
   * contract `/vendor/payments` relies on: a vendor with no business to accept
   * on behalf of belongs at step 2, not here.
   */
  const [, status, payouts] = await Promise.all([
    requireRole('vendor'),
    getAgreementStatus(),
    getPayoutStatus(),
  ]);

  if (!status) {
    redirect(PROFILE_EDIT_PATH);
  }

  return (
    /*
     * No `VendorSurface`. That component supplies its own eyebrow, 26px heading
     * and description, and frame `32` draws a different composition: the 5-step
     * rail first, then a 34px title under it. Wrapping one in the other would
     * put two headings on the screen and the step rail below the title it is
     * supposed to introduce.
     */
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <VendorAgreementScreen
        status={status}
        agreement={vendorAgreementDocument()}
        payoutsLive={payouts?.stripeOnboarded ?? false}
      />
    </div>
  );
}
