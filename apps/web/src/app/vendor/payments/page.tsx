import { BRAND_NAME, pageTitle, VENDOR_AGREEMENT_PATH } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Banner } from '@/components/ui/banner';
import { VendorSurface } from '@/components/vendor-surface';
import { ConnectPayoutsForm } from '@/components/vendor/connect-payouts-form';
import { PayoutsOverview } from '@/components/vendor/payouts-overview';
import { TaxStatementDownloads } from '@/components/vendor/tax-statement-downloads';
import { requireRole } from '@/lib/current-user';
import {
  getAgreementStatus,
  getPayoutStatus,
  getTaxStatementYears,
  getVendorPayouts,
} from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Payments') };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

/** Payout state changes underneath this page via webhook; never serve it stale. */
export const dynamic = 'force-dynamic';

interface VendorPaymentsPageProps {
  searchParams: Promise<{ resume?: string }>;
}

export default async function VendorPaymentsPage({
  searchParams,
}: VendorPaymentsPageProps): Promise<React.ReactElement> {
  /*
   * All three are independent, so they go out together rather than in a chain.
   * There is deliberately no separate profile read: `/vendor/stripe/status`
   * answers 404 when there is no vendor profile, which `getPayoutStatus` maps to
   * `null` — so the redirect below is the same guard the other vendor surfaces
   * make with a second round trip.
   */
  const [, status, agreement, params] = await Promise.all([
    requireRole('vendor'),
    getPayoutStatus(),
    getAgreementStatus(),
    searchParams,
  ]);

  if (!status) {
    redirect(PROFILE_EDIT_PATH);
  }

  /*
   * Step 3 before step 4 (#427, frame `32`). The agreement is where the
   * commission and the payout timing are agreed, and it is agreed *before* a
   * payout rail exists to implement them — so a vendor who arrives here without
   * it goes there first rather than handing Stripe their bank details without
   * having been told what the platform keeps. `POST /vendor/stripe/connect`
   * refuses for the same reason, which is what makes this a signpost rather
   * than the enforcement.
   */
  if (agreement && !agreement.isCurrent) {
    redirect(VENDOR_AGREEMENT_PATH);
  }

  // A vendor paid in a past year keeps the statement even if the account has since been restricted.
  const statementYears = status.stripeAccountId ? await getTaxStatementYears() : [];
  const hasStarted = Boolean(status.stripeAccountId);
  // Stripe sends the vendor here when the link it gave them expired or was
  // already used. Saying so is the difference between "this is broken" and
  // "press it again": the link ran out, not the setup.
  const linkExpired = params.resume === '1';

  // Frame `49`: the onboarded vendor sees their payouts, full width (VEN-768).
  if (status.stripeOnboarded) {
    const payouts = await getVendorPayouts();

    return (
      <VendorSurface
        eyebrow="Payments"
        heading="Payments"
        description={`${BRAND_NAME} takes payment from the customer and passes it to you through Stripe.`}
      >
        <PayoutsOverview payouts={payouts} />
        <TaxStatementDownloads years={statementYears} />
      </VendorSurface>
    );
  }

  return (
    <VendorSurface
      eyebrow="Payments"
      heading="Get paid for your bookings"
      description={`${BRAND_NAME} takes payment from the customer and passes it to you through Stripe. Connect your bank account to accept bookings.`}
    >
      <div className="max-w-[620px]">
        {/*
          One banner, which is the component's own contract — and on the
          `?resume=1` path the expired link is the newer, more specific
          thing to say, so it takes the slot rather than stacking above the
          gate. Steel there because nothing failed and nothing is waiting on
          the vendor except pressing the button again; gold otherwise,
          because the setup is waiting on them. Never red: `40-states.md`.
        */}
        {linkExpired ? (
          <Banner status="informational" title="That link had expired">
            Stripe&apos;s setup links expire. Start again to pick up where you left off.
          </Banner>
        ) : (
          <Banner status="pending" title="Payouts not connected">
            You can&apos;t take payment until payouts are connected.
          </Banner>
        )}

        <div className="mt-6">
          <ConnectPayoutsForm isResuming={hasStarted} />
        </div>

        <p className="mt-3.5 text-sm leading-prose text-stone-600">
          Stripe asks for your bank details and ID. {BRAND_NAME} never sees them.
        </p>
        <TaxStatementDownloads years={statementYears} />
      </div>
    </VendorSurface>
  );
}
