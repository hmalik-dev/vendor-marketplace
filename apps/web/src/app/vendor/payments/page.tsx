import { BRAND_NAME, pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Banner } from '@/components/ui/banner';
import { ConnectPayoutsForm } from '@/components/vendor/connect-payouts-form';
import { requireRole } from '@/lib/current-user';
import { getOwnVendorProfile, getPayoutStatus } from '@/lib/vendor-data';

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
  await requireRole('vendor');

  const profile = await getOwnVendorProfile();
  if (!profile) {
    redirect(PROFILE_EDIT_PATH);
  }

  const status = await getPayoutStatus();
  const isOnboarded = status?.stripeOnboarded ?? false;
  const hasStarted = Boolean(status?.stripeAccountId);

  /*
   * Stripe sends the vendor here when the link it gave them has expired or was
   * already used. Saying so is the difference between "this is broken" and
   * "press it again": the link, not the setup, is what ran out.
   */
  const linkExpired = (await searchParams).resume === '1';

  return (
    <div className="w-full max-w-[620px] px-4 pt-5.5 pb-12 sm:px-6 lg:px-0 lg:pl-6">
      <h1 className="text-display-sm text-stone-900">Payments</h1>

      {isOnboarded ? (
        <>
          <p className="mt-2.5 text-base leading-prose text-stone-700">
            Your payouts are connected. Customers can book you, and the money for each event
            reaches your bank after it happens.
          </p>
          <Banner status="settled" title="Payouts connected" className="mt-5">
            Stripe holds each payment until the event is complete, then pays it out to you.
          </Banner>
        </>
      ) : (
        <>
          <p className="mt-2.5 text-base leading-prose text-stone-700">
            {BRAND_NAME} takes payment from the customer and passes it to you through Stripe.
            Connecting your bank account is what lets you accept a booking.
          </p>

          {linkExpired ? (
            <Banner status="informational" title="That link had expired" className="mt-5">
              Stripe links only last a few minutes. Start again and you will pick up where you left
              off.
            </Banner>
          ) : null}

          {/*
            Gold, because this is waiting on the vendor rather than something
            that failed — `40-states.md`, and the sentence is the approved one
            from `31-content-voice.md`.
          */}
          <Banner status="pending" title="Payouts not connected" className="mt-5">
            You can&rsquo;t take payment until payouts are connected. It takes about five minutes.
          </Banner>

          <div className="mt-6">
            <ConnectPayoutsForm isResuming={hasStarted} />
          </div>

          <p className="mt-3.5 text-sm leading-prose text-stone-600">
            Stripe asks for your bank details and enough identification to pay you legally.{' '}
            {BRAND_NAME} never sees them.
          </p>
        </>
      )}
    </div>
  );
}
